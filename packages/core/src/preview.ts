import * as cheerio from "cheerio";
import {
	resolve as resolveAdapter,
	setBuiltInAdapters,
	setDefaultAdapter,
} from "./adapters/registry";
import { twitterAdapter } from "./adapters/twitter";
import { youtubeAdapter } from "./adapters/youtube";
import { MemoryCache } from "./cache/memory";
import type { Cache } from "./cache/types";
import { PreviewError } from "./errors";
import { extract as extractDefault } from "./extractors/default";
import { fetchDocument } from "./fetch";
import type { AdapterResult, PreviewOptions, PreviewResult } from "./types";

export { clearCustomAdapters, registerAdapter } from "./adapters/registry";

setBuiltInAdapters([youtubeAdapter, twitterAdapter]);
setDefaultAdapter({
	name: "default",
	match: () => true,
	extract: (ctx) => extractDefault(ctx),
});

const sharedDefaultCache: Cache<PreviewResult> =
	new MemoryCache<PreviewResult>();

export async function preview(
	rawUrl: string,
	options?: PreviewOptions,
): Promise<PreviewResult> {
	const cache = options?.cache ?? sharedDefaultCache;
	const ttlMs = options?.cacheTtlMs;

	const lookupKey = normalizeKey(rawUrl);

	const cached = await cache.get(lookupKey);
	if (cached !== undefined) {
		return { ...cached, fromCache: true };
	}

	const fetched = await fetchDocument(rawUrl, options);

	const finalKey = normalizeKey(fetched.url);
	if (finalKey !== lookupKey) {
		const finalCached = await cache.get(finalKey);
		if (finalCached !== undefined) {
			return { ...finalCached, fromCache: true };
		}
	}

	const result = extractPreview(rawUrl, fetched, options);
	const stored: PreviewResult = { ...result, fromCache: false };
	await cache.set(finalKey, stored, ttlMs);
	return stored;
}

function extractPreview(
	rawUrl: string,
	fetched: { url: string; html: string; contentType?: string },
	options?: PreviewOptions,
): PreviewResult {
	if (fetched.html === "") {
		throw new PreviewError("PARSE_ERROR", `No HTML content at ${rawUrl}`, {
			url: rawUrl,
		});
	}

	let $: cheerio.CheerioAPI;
	try {
		$ = cheerio.load(fetched.html);
	} catch (error) {
		throw new PreviewError("PARSE_ERROR", `Failed to parse HTML at ${rawUrl}`, {
			url: rawUrl,
			cause: error,
		});
	}

	const finalUrl = new URL(fetched.url);
	const ctx = { url: finalUrl, html: fetched.html, $ };
	const adapter = resolveAdapter(finalUrl, { adapters: options?.adapters });

	let partial: AdapterResult;
	if (adapter !== undefined) {
		partial = adapter.extract(ctx);
		if (partial === null) {
			partial = extractDefault(ctx);
		}
	} else {
		partial = extractDefault(ctx);
	}

	const base: PreviewResult = {
		url: finalUrl.href,
		title: "",
		description: "",
		adapter: adapter?.name ?? "default",
		fetchedAt: Date.now(),
		fromCache: false,
	};

	if (partial !== null) {
		if (partial.url !== undefined) base.url = partial.url;
		if (partial.title !== undefined) base.title = partial.title;
		if (partial.description !== undefined)
			base.description = partial.description;
		if (partial.image !== undefined) base.image = partial.image;
		if (partial.siteName !== undefined) base.siteName = partial.siteName;
	}

	return base;
}

function normalizeKey(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		return parsed.href;
	} catch {
		return url;
	}
}
