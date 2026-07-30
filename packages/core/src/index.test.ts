import { beforeEach, expect, test } from "bun:test";
import {
	type Adapter,
	clearCustomAdapters,
	type FetchFn,
	MemoryCache,
	PreviewError,
	type PreviewOptions,
	type PreviewResult,
	preview,
	registerAdapter,
	VERSION,
} from "./index";

test("@metascan/core smoke: VERSION is a non-empty semver string", () => {
	expect(typeof VERSION).toBe("string");
	expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

const OG_HTML = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Example Page">
<meta property="og:description" content="An example page for the public API.">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:site_name" content="Example">
</head><body></body></html>`;

function html(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

function scriptedFetch(routes: Record<string, () => Response>): FetchFn {
	return async (input) => {
		const url = input.toString();
		const handler = routes[url];
		if (!handler) throw new TypeError(`no route for ${url}`);
		return handler();
	};
}

beforeEach(() => {
	clearCustomAdapters();
});

test("end-to-end: preview() returns a correct PreviewResult from the public API", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const opts: PreviewOptions = {
		fetch,
		cache: new MemoryCache<PreviewResult>(),
	};

	const result = await preview("https://example.com/", opts);

	expect(result.url).toBe("https://example.com/");
	expect(result.title).toBe("Example Page");
	expect(result.description).toBe("An example page for the public API.");
	expect(result.image).toEqual({ url: "https://example.com/og.png" });
	expect(result.siteName).toBe("Example");
	expect(result.adapter).toBe("default");
	expect(typeof result.fetchedAt).toBe("number");
	expect(result.fromCache).toBe(false);
});

test("end-to-end: second call is served from cache (fromCache=true)", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	const first = await preview("https://example.com/", opts);
	expect(first.fromCache).toBe(false);

	const second = await preview("https://example.com/", opts);
	expect(second.fromCache).toBe(true);
	expect(second.title).toBe(first.title);
	expect(second.url).toBe(first.url);
});

test("end-to-end: registerAdapter runs before built-ins", async () => {
	const custom: Adapter = {
		name: "custom",
		match: (u) => u.hostname === "example.com",
		extract: (ctx) => ({
			url: ctx.url.href,
			title: "Custom Adapter Title",
			description: "from custom adapter",
		}),
	};
	registerAdapter(custom);

	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const opts: PreviewOptions = {
		fetch,
		cache: new MemoryCache<PreviewResult>(),
	};

	const result = await preview("https://example.com/", opts);
	expect(result.adapter).toBe("custom");
	expect(result.title).toBe("Custom Adapter Title");
	expect(result.description).toBe("from custom adapter");
});

test("end-to-end: PreviewError is thrown for invalid URLs", async () => {
	const fetch = scriptedFetch({});
	const opts: PreviewOptions = {
		fetch,
		cache: new MemoryCache<PreviewResult>(),
	};

	const error = await preview("not-a-url", opts).catch((e) => e);
	expect(error).toBeInstanceOf(PreviewError);
	expect((error as PreviewError).code).toBe("INVALID_URL");
});
