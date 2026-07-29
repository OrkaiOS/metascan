import { expect, test } from "bun:test";
import * as cheerio from "cheerio";
import type { AdapterContext } from "../types";
import { extract } from "./default";

const FIXTURES = `${import.meta.dirname}/__fixtures__`;

async function load(name: string): Promise<string> {
	return Bun.file(`${FIXTURES}/${name}`).text();
}

function ctx(url: string, html: string): AdapterContext {
	return {
		url: new URL(url),
		html,
		$: cheerio.load(html),
	};
}

const PAGE = "https://example.metascan.dev/page";

test("og-rich.html: OG title/description/image/site_name win over twitter and standard meta", async () => {
	const r = extract(ctx(PAGE, await load("og-rich.html")));
	expect(r).toEqual({
		url: PAGE,
		title: "OG Rich Page",
		description: "Full Open Graph fixture for extractor tests.",
		image: { url: "https://example.metascan.dev/og-rich/cover.png" },
		siteName: "MetaScan Docs",
	});
});

test("og-rich.html: every returned URL is absolute", async () => {
	const r = extract(ctx(PAGE, await load("og-rich.html")));
	expect(r.url).toMatch(/^https?:\/\//);
	expect(r.image?.url).toMatch(/^https?:\/\//);
});

test("twitter-only.html: twitter fields used when no og:* tags present", async () => {
	const r = extract(ctx(PAGE, await load("twitter-only.html")));
	expect(r).toEqual({
		url: PAGE,
		title: "Twitter Only Page",
		description: "Twitter Card fixture with no Open Graph tags.",
		image: { url: "https://example.metascan.dev/twitter-only/card.png" },
	});
});

test("twitter-only.html: image url is absolute", async () => {
	const r = extract(ctx(PAGE, await load("twitter-only.html")));
	expect(r.image?.url).toMatch(/^https?:\/\//);
});

test("bare.html: partial fallback uses <title> + first <img>, description empty, siteName omitted", async () => {
	const r = extract(ctx(PAGE, await load("bare.html")));
	expect(r).toEqual({
		url: PAGE,
		title: "Bare Page",
		description: "",
		image: {
			url: "https://example.metascan.dev/bare/only-image.png",
			alt: "the only one on the page",
		},
	});
	expect(r).not.toHaveProperty("siteName");
});

test("bare.html: resolved image url is absolute", async () => {
	const r = extract(ctx(PAGE, await load("bare.html")));
	expect(r.image?.url).toMatch(/^https?:\/\//);
});

test("empty.html: title present, description empty string, image and siteName omitted", async () => {
	const r = extract(ctx(PAGE, await load("empty.html")));
	expect(r).toEqual({
		url: PAGE,
		title: "Empty Page",
		description: "",
	});
	expect(r).not.toHaveProperty("image");
	expect(r).not.toHaveProperty("siteName");
});

test("empty.html: url is absolute", async () => {
	const r = extract(ctx(PAGE, await load("empty.html")));
	expect(r.url).toMatch(/^https?:\/\//);
});

test("all fixtures: url field is always an absolute URL", async () => {
	const names = [
		"og-rich.html",
		"twitter-only.html",
		"bare.html",
		"empty.html",
	];
	for (const name of names) {
		const r = extract(ctx(PAGE, await load(name)));
		expect(r.url).toMatch(/^https?:\/\//);
	}
});
