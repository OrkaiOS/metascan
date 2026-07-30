import { expect, mock, test } from "bun:test";
import { PreviewError, type PreviewResult } from "@metascan/core";
import { _setPreviewFn, APP_NAME, app, VERSION } from "./index";

test("metascan-server smoke: imports core via workspace link", () => {
	expect(APP_NAME).toBe("metascan-server");
	expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

test('GET /health returns { status: "ok" }', async () => {
	const res = await app.request("/health");
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual({ status: "ok" });
});

test("GET /preview returns PreviewResult JSON from core preview()", async () => {
	const result: PreviewResult = {
		url: "https://example.com/page",
		title: "Example",
		description: "An example page",
		adapter: "default",
		fetchedAt: 1234567890,
		fromCache: false,
	};
	const previewMock = mock(() => Promise.resolve(result));
	_setPreviewFn(previewMock);

	const res = await app.request("/preview?url=https://example.com/page");
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual(result);
	expect(previewMock).toHaveBeenCalledTimes(1);
});

test("GET /preview without url returns 400 INVALID_URL", async () => {
	const res = await app.request("/preview");
	expect(res.status).toBe(400);
	const body = (await res.json()) as {
		error: { code: string; message: string };
	};
	expect(body.error.code).toBe("INVALID_URL");
});

test("GET /preview maps PreviewError to the right status code", async () => {
	const error = new PreviewError("FETCH_ERROR", "boom", {
		url: "https://x.test",
	});
	const previewMock = mock(() => Promise.reject(error));
	_setPreviewFn(previewMock);

	const res = await app.request("/preview?url=https://x.test");
	expect(res.status).toBe(502);
	const body = (await res.json()) as {
		error: { code: string; message: string };
	};
	expect(body.error).toEqual({ code: "FETCH_ERROR", message: "boom" });
});
