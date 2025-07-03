import { hc } from "hono/client";
import type { App } from "../src/app";

export const authorization = "Bearer !!!";
export const client = hc<App>("https://image-storage-kf.falent.workers.dev", {
	fetch: async (url: string, init: RequestInit) => {
		console.log(JSON.stringify({ url, init }, null, 2));
		const res = await fetch(url, init);
		console.log("status: ", res.status);
		console.log(
			"headers: ",
			JSON.stringify(Object.fromEntries(res.headers), null, 2),
		);
		console.log(
			"body: \n",
			await res
				.clone()
				.text()
				.then((t) => t.slice(0, 1024)),
		);
		return res;
	},
});
