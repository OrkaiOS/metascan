import { beforeEach, expect, test } from "bun:test";
import {
	clearCustomAdapters,
	setBuiltInAdapters,
	setDefaultAdapter,
} from "./adapters/registry";
import { MemoryCache } from "./cache/memory";
import type { Cache } from "./cache/types";
import { preview } from "./preview";
import type { FetchFn, PreviewOptions, PreviewResult } from "./types";

type Call = { url: string; init?: RequestInit };

function html(body: string, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html; charset=utf-8", ...headers },
	});
}

function scriptedFetch(
	routes: Record<string, () => Response>,
): FetchFn & { calls: Call[] } {
	const calls: Call[] = [];
	const fn: FetchFn = async (input, init) => {
		const url = input.toString();
		calls.push({ url, init });
		const handler = routes[url];
		if (!handler) throw new TypeError(`no route for ${url}`);
		return handler();
	};
	return Object.assign(fn, { calls });
}

const OG_HTML = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Cached Page">
<meta property="og:description" content="A page used to exercise the preview cache.">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:site_name" content="Example">
</head><body></body></html>`;

function resetAdapters(): void {
	clearCustomAdapters();
	setBuiltInAdapters([]);
	setDefaultAdapter({
		name: "default",
		match: () => true,
		extract: () => ({ url: "", title: "", description: "" }),
	});
}

beforeEach(() => {
	resetAdapters();
});

test("second identical call is served from cache without re-fetching", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	const first = await preview("https://example.com/", opts);
	expect(first.fromCache).toBe(false);
	expect(fetch.calls).toHaveLength(1);

	const second = await preview("https://example.com/", opts);
	expect(second.fromCache).toBe(true);
	expect(second.title).toBe(first.title);
	expect(second.url).toBe(first.url);
	expect(fetch.calls).toHaveLength(1);
});

test("cached result preserves all PreviewResult fields", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	const first = await preview("https://example.com/", opts);
	await preview("https://example.com/", opts);

	const stored = await cache.get("https://example.com/");
	expect(stored).toBeDefined();
	expect(stored).not.toBeNull();
	if (stored) {
		expect(stored.title).toBe(first.title);
		expect(stored.description).toBe(first.description);
		expect(stored.image).toEqual(first.image);
		expect(stored.siteName).toBe(first.siteName);
		expect(stored.adapter).toBe(first.adapter);
		expect(stored.fromCache).toBe(false);
	}
});

test("a custom Cache implementation is accepted and used", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});

	class RecordingCache implements Cache<PreviewResult> {
		gets = 0;
		sets = 0;
		deletes = 0;
		private store = new Map<string, PreviewResult>();

		async get(key: string): Promise<PreviewResult | undefined> {
			this.gets += 1;
			return this.store.get(key);
		}
		async set(key: string, value: PreviewResult): Promise<void> {
			this.sets += 1;
			this.store.set(key, value);
		}
		async delete(key: string): Promise<void> {
			this.deletes += 1;
			this.store.delete(key);
		}
	}

	const cache = new RecordingCache();
	const opts: PreviewOptions = { fetch, cache };

	const first = await preview("https://example.com/", opts);
	expect(first.fromCache).toBe(false);
	expect(cache.gets).toBeGreaterThanOrEqual(1);
	expect(cache.sets).toBe(1);

	const second = await preview("https://example.com/", opts);
	expect(second.fromCache).toBe(true);
	expect(cache.sets).toBe(1);
	expect(fetch.calls).toHaveLength(1);
});

test("expired cache entries re-fetch on the next call", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>({ defaultTtlMs: 40 });
	const opts: PreviewOptions = { fetch, cache, cacheTtlMs: 40 };

	const first = await preview("https://example.com/", opts);
	expect(first.fromCache).toBe(false);
	expect(fetch.calls).toHaveLength(1);

	const second = await preview("https://example.com/", opts);
	expect(second.fromCache).toBe(true);
	expect(fetch.calls).toHaveLength(1);

	await new Promise((r) => setTimeout(r, 50));

	const third = await preview("https://example.com/", opts);
	expect(third.fromCache).toBe(false);
	expect(fetch.calls).toHaveLength(2);
});

test("error results are never cached", async () => {
	let calls = 0;
	const fetch: FetchFn = async (_input) => {
		calls += 1;
		throw new TypeError("network down");
	};
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	await expect(preview("https://example.com/", opts)).rejects.toMatchObject({
		code: "FETCH_ERROR",
	});
	expect(calls).toBe(1);

	await expect(preview("https://example.com/", opts)).rejects.toMatchObject({
		code: "FETCH_ERROR",
	});
	expect(calls).toBe(2);

	const stored = await cache.get("https://example.com/");
	expect(stored).toBeUndefined();
});

test("INVALID_URL is not cached and does not reach fetch", async () => {
	const fetch = scriptedFetch({});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	await expect(preview("not-a-url", opts)).rejects.toMatchObject({
		code: "INVALID_URL",
	});
	expect(fetch.calls).toHaveLength(0);

	const stored = await cache.get("not-a-url");
	expect(stored).toBeUndefined();
});

test("normalizes the cache key by stripping the fragment", async () => {
	const page = () => html(OG_HTML);
	const fetch = scriptedFetch({
		"https://example.com/": page,
		"https://example.com/#section": page,
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	await preview("https://example.com/#section", opts);
	expect(fetch.calls).toHaveLength(1);

	const second = await preview("https://example.com/", opts);
	expect(second.fromCache).toBe(true);
	expect(fetch.calls).toHaveLength(1);
});

test("explicit cache option overrides the shared default cache", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});

	const cacheA = new MemoryCache<PreviewResult>();
	const cacheB = new MemoryCache<PreviewResult>();

	await preview("https://example.com/", { fetch, cache: cacheA });
	const fromB = await preview("https://example.com/", {
		fetch,
		cache: cacheB,
	});
	expect(fromB.fromCache).toBe(false);
	expect(fetch.calls).toHaveLength(2);

	const fromA = await preview("https://example.com/", {
		fetch,
		cache: cacheA,
	});
	expect(fromA.fromCache).toBe(true);
	expect(fetch.calls).toHaveLength(2);
});
