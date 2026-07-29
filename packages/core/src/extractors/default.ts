import type { CheerioAPI } from "cheerio";
import type { AdapterContext, PreviewImage, PreviewResult } from "../types";

type Selection = ReturnType<CheerioAPI>;

export function extract(ctx: AdapterContext): Partial<PreviewResult> {
	const $ = ctx.$ as CheerioAPI;
	const base = resolveBase($, ctx.url);

	const title = pickMeta(
		$,
		[
			'meta[property="og:title"]',
			'meta[name="og:title"]',
			'meta[name="twitter:title"]',
			'meta[property="twitter:title"]',
			"title",
		],
		(el) => $(el).attr("content") ?? $(el).text(),
	);

	const description = pickMeta(
		$,
		[
			'meta[property="og:description"]',
			'meta[name="og:description"]',
			'meta[name="twitter:description"]',
			'meta[property="twitter:description"]',
			'meta[name="description"]',
		],
		(el) => $(el).attr("content"),
	);

	const ogImage = pickMeta(
		$,
		[
			'meta[property="og:image"]',
			'meta[name="og:image"]',
			'meta[name="twitter:image"]',
			'meta[property="twitter:image"]',
		],
		(el) => $(el).attr("content"),
	);

	const siteName = pickMeta(
		$,
		['meta[property="og:site_name"]', 'meta[name="og:site_name"]'],
		(el) => $(el).attr("content"),
	);

	const hasOgOrTwitter =
		$(
			'meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]',
		).length > 0;

	let image: PreviewImage | undefined;
	if (ogImage) {
		const resolved = resolveUrl(ogImage, base);
		if (resolved) {
			image = { url: resolved };
		}
	} else if (!hasOgOrTwitter) {
		const firstImg = $("img").first();
		const src = firstImg.attr("src");
		if (src) {
			const resolved = resolveUrl(src, base);
			if (resolved) {
				const alt = firstImg.attr("alt");
				image = alt ? { url: resolved, alt } : { url: resolved };
			}
		}
	}

	const result: Partial<PreviewResult> = {
		url: ctx.url.href,
		title: title ?? "",
		description: description ?? "",
	};

	if (image) result.image = image;
	if (siteName) result.siteName = siteName;

	return result;
}

function pickMeta(
	$: CheerioAPI,
	selectors: string[],
	read: (el: Selection) => string | undefined,
): string | undefined {
	for (const selector of selectors) {
		const node = $(selector).first();
		if (node.length === 0) continue;
		const value = read(node);
		if (value && value.trim() !== "") return value.trim();
	}
	return undefined;
}

function resolveBase($: CheerioAPI, url: URL): URL {
	const href = $("base[href]").first().attr("href");
	if (href) {
		try {
			return new URL(href, url);
		} catch {
			return url;
		}
	}
	return url;
}

function resolveUrl(raw: string, base: URL): string | undefined {
	const trimmed = raw.trim();
	if (trimmed === "") return undefined;
	try {
		return new URL(trimmed, base).href;
	} catch {
		return undefined;
	}
}
