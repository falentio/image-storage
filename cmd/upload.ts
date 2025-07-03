import { client } from "./_shared";

const { token } = await client.upload["create-token"]
	.$post(undefined, {
		headers: {
			Authorization: "Bearer foo",
		},
	})
	.then((r) => r.json());

const result = await client.upload[":token"].$put(
	{
		param: { token },
		form: { image: new File([new Uint8Array([1, 2, 3])], "foo.png") },
	},
	{
		headers: {
			Authorization: `Bearer ${token}`,
		},
	},
);
