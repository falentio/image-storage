import type { StatusCode } from "hono/utils/http-status";

export type FriendlyMessage = {
	publicMessage?: string;
	httpStatus: StatusCode;
};

export class FriendlyError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "FriendlyError";
	}

	friendlyMessage: FriendlyMessage = {
		httpStatus: 500,
	};

	with(friendlyMessage?: FriendlyMessage) {
		this.friendlyMessage = friendlyMessage ?? this.friendlyMessage;
		return this;
	}

	static mapper(message: string, friendlyMessage?: FriendlyMessage) {
		return (e: unknown) => {
			throw new FriendlyError(message, { cause: e }).with(friendlyMessage);
		};
	}
}
