import { authorization, client } from "./_shared";

const image =
	"image/5f7fecec-9c29-4c01-9399-b16de3c67be2/b4ef8cdc-7f6b-4152-a966-afebc702cec1";

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
				authorization,
			},
		},
	)
	.then((r) => r.json());

await client.transform[":token"].$get({
	param: { token },
});
