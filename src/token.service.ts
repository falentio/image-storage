import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { hkdf } from "@panva/hkdf";
import { FriendlyError } from "./friendly-error";

export type TokenPayload<T = undefined> = {
	permissions: string[];
	expiration: string;
	data: T;
} & Omit<JWTPayload, "exp">;

const ALG = "HS256";
const ISSUER = "falentio/image-storage";

function getSecret(secret: string, timestamp: number) {
	return hkdf(
		"sha256",
		secret,
		timestamp.toString(),
		"falentio/image-storage/secret",
		32,
	);
}

function getStartOfDay(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export class TokenService {
	#secret: [Uint8Array, Uint8Array] | undefined;
	constructor(private readonly secret: string) {}

	// cheap key rotating for small apps, and non critical apps
	private async getSecret() {
		if (this.#secret) return this.#secret;
		const twoWeeks = 14 * 24 * 60 * 60 * 1000;
		const timestamp = (Date.now() / twoWeeks) | 0;

		this.#secret = await Promise.all([
			getSecret(this.secret, timestamp),
			getSecret(this.secret, timestamp - 1),
		]);
		return this.#secret;
	}

	async sign<T>(payload: TokenPayload<T>, looseIssuedAt = false) {
		const [secret] = await this.getSecret();
		// to workaround into cache, because sometime it used for getting an image,
		const issuedAt = looseIssuedAt ? getStartOfDay(new Date()) : new Date();
		return new SignJWT(payload)
			.setProtectedHeader({ alg: ALG })
			.setExpirationTime(payload.expiration)
			.setIssuedAt(issuedAt)
			.setIssuer(ISSUER)
			.sign(secret);
	}

	async verify<T = undefined>(
		token: string,
		permissions: string[],
	): Promise<TokenPayload<T>> {
		const [secret, oldSecret] = await this.getSecret();
		const { payload } = await Promise.race([
			jwtVerify<TokenPayload<T>>(token, secret, {
				issuer: ISSUER,
				algorithms: [ALG],
			}),
			jwtVerify<TokenPayload<T>>(token, oldSecret, {
				issuer: ISSUER,
				algorithms: [ALG],
			}),
		]).catch(
			FriendlyError.mapper("Invalid token", {
				httpStatus: 401,
				publicMessage: "Invalid token",
			}),
		);
		const satisfyAllPermissions = permissions.every((p) =>
			payload.permissions.includes(p),
		);
		if (!satisfyAllPermissions) {
			throw new FriendlyError(
				`Insufficient permissions, token permissions : "${payload.permissions.join(", ")}"`,
			).with({
				httpStatus: 403,
				publicMessage: "Insufficient permissions",
			});
		}
		return payload;
	}
}
