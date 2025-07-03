import { client } from "./_shared";

await client.check.$get();
await client.check.$get(undefined, {
	headers: {
		Authorization: "Bearer foo",
	},
});
