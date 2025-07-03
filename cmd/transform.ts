import { client } from "./_shared";

const image =
	"image/f8104611-edfe-48a4-b1f3-39e09c79f8f2/a6ed207a-c810-47bc-ac01-8e92f797d940";

const { token } = await client.transform["generate"]
	.$post(
		{
			json: {
				filename: image,
				options: "h:100/w:100",
			},
		},
		{
			headers: {
				Authorization: "Bearer foo",
			},
		},
	)
	.then((r) => r.json());

await client.transform[":token"].$get({
	param: { token },
});
