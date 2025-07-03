/// <reference types="@types/node" />
import { authorization, client } from "./_shared";
import { openSync, readFileSync } from "node:fs";
const { token } = await client.upload["create-token"]
	.$post(undefined, {
		headers: { authorization },
	})
	.then((r) => r.json());

const image = openSync("./cmd/_test.png", "r");
const data = readFileSync(image);
const mime = "image/png";
const file = new File([data], "foo.png", { type: mime });

const result = await client.upload[":token"].$put(
	{
		param: { token },
		form: { image: file },
	},
	{
		headers: { authorization },
	},
);
