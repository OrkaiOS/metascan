import { expect, mock, test } from "bun:test";
import {
	PreviewError,
	type PreviewErrorCode,
	type PreviewResult,
} from "@metascan/core";
import { _setPreviewFn, APP_NAME, app, loadConfig, VERSION } from "./index";

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

const ERROR_CODE_STATUS: Array<{
	code: PreviewErrorCode;
	status: 400 | 502 | 504;
}> = [
	{ code: "INVALID_URL", status: 400 },
	{ code: "TIMEOUT", status: 504 },
	{ code: "FETCH_ERROR", status: 502 },
	{ code: "PARSE_ERROR", status: 502 },
	{ code: "TOO_MANY_REDIRECTS", status: 502 },
];

for (const { code, status } of ERROR_CODE_STATUS) {
	test(`GET /preview maps ${code} → ${status} with { error: { code, message } }`, async () => {
		const message = `${code} failure`;
		const error = new PreviewError(code, message, { url: "https://x.test" });
		const previewMock = mock(() => Promise.reject(error));
		_setPreviewFn(previewMock);

		const res = await app.request("/preview?url=https://x.test");
		expect(res.status).toBe(status);
		const body = (await res.json()) as {
			error: { code: string; message: string };
		};
		expect(body.error).toEqual({ code, message });
	});
}

test("loadConfig defaults PORT to 3000 and leaves core options unset", () => {
	const cfg = loadConfig({});
	expect(cfg.port).toBe(3000);
	expect(cfg.coreOptions.timeoutMs).toBeUndefined();
	expect(cfg.coreOptions.maxRedirects).toBeUndefined();
	expect(cfg.coreOptions.cacheTtlMs).toBeUndefined();
});

test("loadConfig reads PORT, METASCAN_TIMEOUT_MS, METASCAN_CACHE_TTL, METASCAN_MAX_REDIRECTS", () => {
	const cfg = loadConfig({
		PORT: "8080",
		METASCAN_TIMEOUT_MS: "2500",
		METASCAN_CACHE_TTL: "600000",
		METASCAN_MAX_REDIRECTS: "5",
	});
	expect(cfg.port).toBe(8080);
	expect(cfg.coreOptions.timeoutMs).toBe(2500);
	expect(cfg.coreOptions.cacheTtlMs).toBe(600000);
	expect(cfg.coreOptions.maxRedirects).toBe(5);
});

test("loadConfig ignores non-positive / non-integer env values", () => {
	const cfg = loadConfig({
		PORT: "0",
		METASCAN_TIMEOUT_MS: "-1",
		METASCAN_CACHE_TTL: "abc",
		METASCAN_MAX_REDIRECTS: "2.5",
	});
	expect(cfg.port).toBe(3000);
	expect(cfg.coreOptions.timeoutMs).toBeUndefined();
	expect(cfg.coreOptions.cacheTtlMs).toBeUndefined();
	expect(cfg.coreOptions.maxRedirects).toBeUndefined();
});
