import { beforeEach, expect, test } from "bun:test";
import {
	clearCustomAdapters,
	setBuiltInAdapters,
	setDefaultAdapter,
} from "./adapters/registry";
import { MemoryCache } from "./cache/memory";
import { preview } from "./preview";
import type { FetchFn, PreviewOptions, PreviewResult } from "./types";

const V1_BUDGET_MS = 2000;
const WARM_PATH_BUDGET_MS = 50;

const OG_HTML = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Perf Page">
<meta property="og:description" content="A page used to exercise the warm-path perf budget.">
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

test("perf: mocked warm-path (cache hit) resolves well under the 2s v1 budget", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	await preview("https://example.com/", opts);

	const start = performance.now();
	const result = await preview("https://example.com/", opts);
	const elapsedMs = performance.now() - start;

	expect(result.fromCache).toBe(true);
	expect(elapsedMs).toBeLessThan(WARM_PATH_BUDGET_MS);
	expect(elapsedMs).toBeLessThan(V1_BUDGET_MS);
});

test("perf: mocked cold path (fetch + parse + extract) resolves under the 2s v1 budget", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html(OG_HTML),
	});
	const cache = new MemoryCache<PreviewResult>();
	const opts: PreviewOptions = { fetch, cache };

	const start = performance.now();
	const result = await preview("https://example.com/", opts);
	const elapsedMs = performance.now() - start;

	expect(result.fromCache).toBe(false);
	expect(elapsedMs).toBeLessThan(V1_BUDGET_MS);
});
