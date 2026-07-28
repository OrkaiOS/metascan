import { expect, test } from "bun:test";
import { PreviewError, type PreviewErrorCode } from "./errors";

const CODES: PreviewErrorCode[] = [
	"INVALID_URL",
	"TIMEOUT",
	"FETCH_ERROR",
	"PARSE_ERROR",
	"TOO_MANY_REDIRECTS",
];

test("PreviewError carries code, message, url, and cause", () => {
	const cause = new TypeError("boom");
	const error = new PreviewError("FETCH_ERROR", "something broke", {
		url: "https://example.com",
		cause,
	});
	expect(error).toBeInstanceOf(Error);
	expect(error).toBeInstanceOf(PreviewError);
	expect(error.code).toBe("FETCH_ERROR");
	expect(error.message).toBe("something broke");
	expect(error.url).toBe("https://example.com");
	expect(error.cause).toBe(cause);
});

for (const code of CODES) {
	test(`PreviewError accepts code '${code}'`, () => {
		const error = new PreviewError(code);
		expect(error.code).toBe(code);
		expect(error.name).toBe("PreviewError");
		expect(error.message).toBe(code);
	});
}

test("PreviewError omits url when not provided", () => {
	const error = new PreviewError("TIMEOUT");
	expect(error.url).toBeUndefined();
	expect("url" in error).toBe(true);
});
