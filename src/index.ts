import { createApp } from "./app";

export default {
	fetch(req: Request, env: Record<string, unknown>, _ctx: ExecutionContext) {
		const app = createApp(env);
		return app.fetch(req);
	},
};
