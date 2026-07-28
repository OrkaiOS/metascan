import { expect, test } from "bun:test";
import { PreviewError } from "./errors";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_REDIRECTS,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_USER_AGENT,
	fetchDocument,
} from "./fetch";

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

type Call = { url: string; init?: RequestInit };

function html(body: string, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/html; charset=utf-8", ...headers },
	});
}

function redirect(location: string, status = 301): Response {
	return new Response(null, { status, headers: { location } });
}

function scriptedFetch(
	routes: Record<string, () => Response>,
): FetchLike & { calls: Call[] } {
	const calls: Call[] = [];
	const fn: FetchLike = async (input, init) => {
		const url = input.toString();
		calls.push({ url, init });
		const handler = routes[url];
		if (!handler) throw new TypeError(`no route for ${url}`);
		return handler();
	};
	return Object.assign(fn, { calls });
}

function hangingFetch(): FetchLike {
	return (_input, init) =>
		new Promise((_resolve, reject) => {
			const signal = init?.signal;
			if (signal?.aborted) reject(toAbort());
			else signal?.addEventListener("abort", () => reject(toAbort()));
		});
}

function toAbort(): DOMException {
	return new DOMException("aborted", "AbortError");
}

function sentHeader(
	init: RequestInit | undefined,
	name: string,
): string | null {
	const h = init?.headers;
	if (!h) return null;
	return new Headers(h).get(name);
}

test("happy path: 200 text/html returns body, final url, and content-type", async () => {
	const fetch = scriptedFetch({
		"https://example.com/": () => html("<title>Hi</title>"),
	});
	const result = await fetchDocument("https://example.com/", { fetch });
	expect(result.url).toBe("https://example.com/");
	expect(result.html).toBe("<title>Hi</title>");
	expect(result.contentType).toBe("text/html; charset=utf-8");
	expect(sentHeader(fetch.calls[0]?.init, "User-Agent")).toBe(
		DEFAULT_USER_AGENT,
	);
	expect(sentHeader(fetch.calls[0]?.init, "Accept")).toBe(
		"text/html,application/xhtml+xml",
	);
});

test("follows redirects up to the cap and returns the final url", async () => {
	const fetch = scriptedFetch({
		"https://example.com/a": () => redirect("/b"),
		"https://example.com/b": () => redirect("https://example.com/c", 302),
		"https://example.com/c": () => html("<title>final</title>"),
	});
	const result = await fetchDocument("https://example.com/a", { fetch });
	expect(result.url).toBe("https://example.com/c");
	expect(result.html).toBe("<title>final</title>");
	expect(fetch.calls).toHaveLength(3);
});

test("INVALID_URL: malformed url string", async () => {
	await expect(fetchDocument("not-a-url")).rejects.toBeInstanceOf(PreviewError);
	await expect(fetchDocument("not-a-url")).rejects.toMatchObject({
		code: "INVALID_URL",
	});
});

test("INVALID_URL: non-http scheme rejected before any fetch", async () => {
	const fetch = scriptedFetch({});
	await expect(
		fetchDocument("ftp://example.com/", { fetch }),
	).rejects.toMatchObject({ code: "INVALID_URL" });
	expect(fetch.calls).toHaveLength(0);
});

test("TIMEOUT: aborts and maps to TIMEOUT code", async () => {
	await expect(
		fetchDocument("https://example.com/", {
			fetch: hangingFetch(),
			timeoutMs: 50,
		}),
	).rejects.toMatchObject({ code: "TIMEOUT" });
});

test("FETCH_ERROR: network rejection maps to FETCH_ERROR", async () => {
	const fetch = async () => Promise.reject(new TypeError("fetch failed"));
	await expect(
		fetchDocument("https://example.com/", { fetch: fetch as FetchLike }),
	).rejects.toMatchObject({ code: "FETCH_ERROR" });
});

test("TOO_MANY_REDIRECTS: exceeded cap throws", async () => {
	const fetch = scriptedFetch({
		"https://example.com/loop": () => redirect("https://example.com/loop"),
	});
	await expect(
		fetchDocument("https://example.com/loop", { fetch, maxRedirects: 3 }),
	).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
	expect(fetch.calls).toHaveLength(DEFAULT_MAX_REDIRECTS + 1);
});

test("non-HTML content-type returns empty html without erroring", async () => {
	const fetch = scriptedFetch({
		"https://example.com/img": () =>
			new Response("binary", {
				status: 200,
				headers: { "content-type": "image/png" },
			}),
	});
	const result = await fetchDocument("https://example.com/img", { fetch });
	expect(result.html).toBe("");
	expect(result.contentType).toBe("image/png");
});

test("size cap: body beyond maxBytes is truncated", async () => {
	const fetch = scriptedFetch({
		"https://example.com/big": () => html("x".repeat(10_000)),
	});
	const result = await fetchDocument("https://example.com/big", {
		fetch,
		maxBytes: 100,
	});
	expect(result.html.length).toBe(100);
});

test("defaults are exported and sane", () => {
	expect(DEFAULT_TIMEOUT_MS).toBe(1500);
	expect(DEFAULT_MAX_REDIRECTS).toBe(3);
	expect(DEFAULT_MAX_BYTES).toBe(2 * 1024 * 1024);
	expect(DEFAULT_USER_AGENT).toContain("metascan/");
	expect(DEFAULT_USER_AGENT).toContain("https://github.com/OrkaiOS/metascan");
});
