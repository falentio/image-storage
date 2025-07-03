import type { TokenService } from "./token.service";
import { Hono } from "hono";
import { FriendlyError } from "./friendly-error";
import * as v from "valibot";
import { vValidator } from "@hono/valibot-validator";
import type { AuthMiddleware } from "./auth.service";

export type UploadRequest = {
	filename: string;
	contentType?: string;
	body: File;
};

export type UploadImage = {
	filename: string;
	contentType?: string;
	body: ReadableStream;
};

export class UploadService {
	constructor(
		private readonly r2: R2Bucket,
		private readonly tokenService: TokenService,
	) {}

	async getToken() {
		return this.tokenService.sign({
			permissions: ["file:upload"],
			expiration: "5 minutes",
			data: undefined,
		});
	}

	async upload(token: string, req: UploadRequest) {
		await this.tokenService.verify(token, ["file:upload"]);
		const path = `image/${crypto.randomUUID()}/${req.filename}`;
		await this.r2.put(path, req.body, {
			httpMetadata: {
				contentType: req.body.type,
			},
		});
		return path;
	}

	async getImage(path: string) {
		// TODO: return the compressed image
		const image = await this.r2.get(path);
		if (!image) {
			throw new FriendlyError("Image not found").with({
				httpStatus: 404,
				publicMessage: "Image not found",
			});
		}
		return {
			filename: path,
			contentType: image.httpMetadata?.contentType,
			body: image.body,
		} as UploadImage;
	}
}

export function uploadRouter(
	uploadService: UploadService,
	authMiddleware: AuthMiddleware,
) {
	return new Hono()
		.post("/upload/create-token", authMiddleware.check, async (c) => {
			const token = await uploadService.getToken();
			return c.json({ token });
		})
		.put(
			"/upload/:token",
			vValidator(
				"form",
				v.object({
					image: v.instance(File),
				}),
			),
			async (c) => {
				const token = c.req.param("token");
				const req = {
					filename:
						c.req.header("Content-Disposition")?.split("filename=")[1] ||
						crypto.randomUUID(),
					contentType: c.req.header("Content-Type"),
					body: c.req.valid("form").image,
				};
				const filename = await uploadService.upload(token, req);
				return c.json({ filename });
			},
		);
}
