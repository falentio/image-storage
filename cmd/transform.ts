import { authorization, client } from "./_shared";

const image =
	"image/dcb20d92-0694-4883-a706-46cda9411a51/c6a3f74c-5857-446e-935e-99b66ec62c6e";

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
