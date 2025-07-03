import { createMiddleware } from "hono/factory";
import { FriendlyError } from "./friendly-error";

export class AuthService {
	constructor(private readonly authorization: string) {}

	check(token: string) {
		return token === this.authorization;
	}
}

export function authMiddleware(authService: AuthService) {
	return {
		check: createMiddleware(async (c, next) => {
			const token = c.req.header("Authorization")?.split(" ")[1];
			if (!token) {
				throw new FriendlyError("Unauthorized").with({
					httpStatus: 401,
					publicMessage: "Unauthorized",
				});
			}
			if (!authService.check(token)) {
				throw new FriendlyError(
					`Unauthorized, received token is invalid, token: ${token}`,
				).with({
					httpStatus: 401,
					publicMessage: "Unauthorized",
				});
			}
			await next();
		}),
	};
}

export type AuthMiddleware = ReturnType<typeof authMiddleware>;
