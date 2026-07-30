import type { CheerioAPI } from "cheerio";
import type { Adapter, AdapterContext, AdapterResult } from "../types";

export const youtubeAdapter: Adapter = {
	name: "youtube",

	match(url: URL): boolean {
		return (
			url.hostname === "www.youtube.com" ||
			url.hostname === "youtube.com" ||
			url.hostname === "m.youtube.com" ||
			url.hostname === "youtu.be"
		);
	},

	extract(ctx: AdapterContext): AdapterResult {
		const $ = ctx.$ as CheerioAPI;

		const title =
			$('meta[property="og:title"]').first().attr("content")?.trim() ??
			$('meta[name="og:title"]').first().attr("content")?.trim();

		const description =
			$('meta[property="og:description"]').first().attr("content")?.trim() ??
			$('meta[name="og:description"]').first().attr("content")?.trim();

		if (!title || !description) {
			return null;
		}

		const ogImage =
			$('meta[property="og:image"]').first().attr("content")?.trim() ??
			$('meta[name="og:image"]').first().attr("content")?.trim();

		const siteName =
			$('meta[property="og:site_name"]').first().attr("content")?.trim() ??
			$('meta[name="og:site_name"]').first().attr("content")?.trim();

		return {
			url: ctx.url.href,
			title,
			description,
			...(ogImage ? { image: { url: ogImage } } : {}),
			...(siteName ? { siteName } : {}),
		};
	},
};
