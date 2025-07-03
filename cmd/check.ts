import { authorization, client } from "./_shared";

await client.check.$get();
await client.check.$get(undefined, {
	headers: { authorization },
});
