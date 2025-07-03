import * as v from "valibot";
import type { TokenService } from "./token.service";
import { encodeBase64Url } from "@std/encoding/base64url";
import { decodeHex } from "@std/encoding/hex";
import { FriendlyError } from "./friendly-error";
import type { AuthMiddleware } from "./auth.service";
import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
export type TokenPayload = {
	options: string;
	filename: string;
};

async function getCacheKey(filename: string, options: string) {
	const buf = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(`${filename}?${options}`),
	);
	return encodeBase64Url(buf);
}

export class ImgProxySigner {
	constructor(
		private readonly secret: string,
		private readonly salt: string,
		private readonly endpoint: string,
	) {}

	async sign(url: string, options: string) {
		const path = `/${options}/${encodeBase64Url(url)}`;
		const key = await crypto.subtle.importKey(
			"raw",
			decodeHex(this.secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);

		const saltBytes = decodeHex(this.salt);
		const pathBytes = new TextEncoder().encode(path);

		const dataToSign = new Uint8Array(saltBytes.length + pathBytes.length);
		dataToSign.set(saltBytes, 0);
		dataToSign.set(pathBytes, saltBytes.length);

		const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
		const encodedSignature = encodeBase64Url(signature);
		const result = `${this.endpoint}/${encodedSignature}${path}`;
		return result;
	}
}

export class TransformerService {
	constructor(
		private readonly r2: R2Bucket,
		private readonly tokenService: TokenService,
		private readonly imgproxySigner: ImgProxySigner,
		private readonly r2Domain: string,
	) {}

	generateToken(filename: string, options: string) {
		return this.tokenService.sign<TokenPayload>(
			{
				permissions: ["file:transform"],
				expiration: "24h",
				data: { options, filename },
			},
			true,
		);
	}

	async getImage(token: string) {
		const {
			data: { filename, options },
		} = await this.tokenService.verify<TokenPayload>(token, ["file:transform"]);
		const cachedKey = await getCacheKey(filename, options);
		const cachedUrl = `${this.r2Domain}/cache/${cachedKey}`;
		const publicUrl = `${this.r2Domain}/${filename}`;
		// const publicUrl ="https://fastly.picsum.photos/id/664/200/300.jpg?hmac=Ov1G0ZpIuC3e0t33HURn4DPJFK6o7bz602P6M-o_SDc";
		const imgproxyUrl = await this.imgproxySigner.sign(publicUrl, options);

		if (await this.r2.head(cachedKey)) {
			return cachedUrl;
		}

		const object = await this.r2.get(filename);
		if (!object) {
			throw new FriendlyError("Image not found").with({
				httpStatus: 404,
			});
		}

		const response = await fetch(imgproxyUrl, {
			headers: {
				accept: "image/*",
			},
		});
		if (!response.ok) {
			throw new FriendlyError(
				`Failed to transform image, status: ${response.status}, statusText: ${response.statusText}, body: ${await response.text()} `,
			).with({
				httpStatus: 500,
			});
		}

		await this.r2.put(cachedKey, response.body, {
			httpMetadata: {
				contentType: response.headers.get("content-type") ?? undefined,
			},
		});
		return cachedUrl;
	}

	getRawImage(filename: string) {
		return this.r2.get(filename);
	}
}

export function transformerRouter(
	transformerService: TransformerService,
	authMiddleware: AuthMiddleware,
) {
	return new Hono()
		.post(
			"/transform/generate",
			authMiddleware.check,
			vValidator(
				"json",
				v.object({
					filename: v.string(),
					options: v.string(),
				}),
			),
			async (c) => {
				const { filename, options } = c.req.valid("json");
				const token = await transformerService.generateToken(filename, options);
				return c.json({ token });
			},
		)
		.get("/transform/:token", async (c) => {
			const token = c.req.param("token");
			const image = await transformerService.getImage(token);
			if (!image) {
				throw new FriendlyError("Image not found").with({
					httpStatus: 404,
				});
			}
			c.header(
				"Cache-Control",
				"public, max-age=86400, stale-while-revalidate=600",
			);
			return c.redirect(image);
		})
		.get("/raw/:filename", authMiddleware.check, async (c) => {
			const filename = c.req.param("filename");

			const image = await transformerService.getRawImage(filename);

			if (!image) {
				throw new FriendlyError("Image not found").with({
					httpStatus: 404,
				});
			}

			const headers = new Headers();
			if (image.httpMetadata?.contentType) {
				headers.set("Content-Type", image.httpMetadata.contentType);
			}
			if (image.httpMetadata?.cacheControl) {
				headers.set("Cache-Control", image.httpMetadata.cacheControl);
			} else {
				headers.set("Cache-Control", "public, max-age=86400"); // 24 hours
			}

			return new Response(image.body, {
				status: 200,
				headers,
			});
		});
}
