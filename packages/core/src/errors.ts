export type PreviewErrorCode =
	| "INVALID_URL"
	| "TIMEOUT"
	| "FETCH_ERROR"
	| "PARSE_ERROR"
	| "TOO_MANY_REDIRECTS";

export interface PreviewErrorOptions {
	url?: string;
	cause?: unknown;
}

export class PreviewError extends Error {
	readonly code: PreviewErrorCode;
	readonly url?: string;

	constructor(
		code: PreviewErrorCode,
		message?: string,
		options?: PreviewErrorOptions,
	) {
		super(
			message ?? code,
			options?.cause !== undefined ? { cause: options.cause } : undefined,
		);
		this.name = "PreviewError";
		this.code = code;
		if (options?.url !== undefined) this.url = options.url;
	}
}
