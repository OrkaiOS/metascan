import type { CheerioAPI } from "cheerio";

export function resolveBase($: CheerioAPI, url: URL): URL {
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

export function resolveUrl(raw: string, base: URL): string | undefined {
	const trimmed = raw.trim();
	if (trimmed === "") return undefined;
	try {
		return new URL(trimmed, base).href;
	} catch {
		return undefined;
	}
}
