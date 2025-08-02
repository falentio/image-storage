import * as v from "valibot";
import {
	ImgProxySigner,
	transformerRouter,
	TransformerService,
} from "./tranformer.service";
import { TokenService } from "./token.service";
import { authMiddleware, AuthService } from "./auth.service";
import { uploadRouter, UploadService } from "./upload.service";
import { Hono } from "hono";
import { FriendlyError } from "./friendly-error";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";

export const AppConfig = v.object({
	IMAGE_STORAGE_DOMAIN: v.pipe(v.string(), v.nonEmpty()),
	IMAGE_STORAGE: v.custom<R2Bucket>((v): v is R2Bucket => {
		const asR2 = v as R2Bucket;
		return "get" in asR2 && "put" in asR2 && "list" in asR2 && "delete" in asR2;
	}),
	ACCESS_TOKEN: v.pipe(v.string(), v.nonEmpty()),
	IMGPROXY_ENDPOINT: v.pipe(v.string(), v.nonEmpty()),
	IMGPROXY_SALT: v.pipe(v.string(), v.nonEmpty()),
	IMGPROXY_KEY: v.pipe(v.string(), v.nonEmpty()),
	SECRET: v.pipe(v.string(), v.nonEmpty()),
});

export function createApp(env: Record<string, unknown>) {
	const cfg = v.parse(AppConfig, env);
	const tokenService = new TokenService(cfg.SECRET);
	const imgproxySigner = new ImgProxySigner(
		cfg.IMGPROXY_KEY,
		cfg.IMGPROXY_SALT,
		cfg.IMGPROXY_ENDPOINT,
	);
	const authService = new AuthService(cfg.ACCESS_TOKEN);
	const transformerService = new TransformerService(
		cfg.IMAGE_STORAGE,
		tokenService,
		imgproxySigner,
		cfg.IMAGE_STORAGE_DOMAIN,
	);
	const uploadService = new UploadService(cfg.IMAGE_STORAGE, tokenService);
	const am = authMiddleware(authService);
	const app = new Hono()
		.onError((e, ctx) => {
			if (e instanceof FriendlyError) {
				return ctx.json(
					{
						error: e.friendlyMessage.publicMessage || "internal server error",
					},
					e.friendlyMessage.httpStatus as ContentfulStatusCode,
				);
			}

			console.error(e);
			return ctx.json(
				{
					error: "internal server error",
				},
				500,
			);
		})
		.use(
			cors({
				origin: "*",
				allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				allowHeaders: ["Authorization", "Content-Type"],
				credentials: false,
			}),
		)
		.get("/check", am.check, (c) => c.json({ ok: true }))
		.route("/", uploadRouter(uploadService, am))
		.route("/", transformerRouter(transformerService, am));
	return app;
}

export type App = ReturnType<typeof createApp>;
