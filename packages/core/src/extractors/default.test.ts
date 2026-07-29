import { expect, test } from "bun:test";
import * as cheerio from "cheerio";
import type { AdapterContext } from "../types";
import { extract } from "./default";

function ctx(url: string, html: string): AdapterContext {
	return {
		url: new URL(url),
		html,
		$: cheerio.load(html),
	};
}

test("OG title/description/image/site_name win over twitter and standard meta", () => {
	const html = `
		<html>
		<head>
			<title>std title</title>
			<meta name="description" content="std description">
			<meta name="twitter:title" content="tw title">
			<meta name="twitter:description" content="tw description">
			<meta name="twitter:image" content="https://tw.example.com/tw.png">
			<meta property="og:title" content="og title">
			<meta property="og:description" content="og description">
			<meta property="og:image" content="https://og.example.com/og.png">
			<meta property="og:site_name" content="og site">
		</head>
		<body><img src="ignored.png"></body>
		</html>`;
	const r = extract(ctx("https://example.com/page", html));
	expect(r).toEqual({
		url: "https://example.com/page",
		title: "og title",
		description: "og description",
		image: { url: "https://og.example.com/og.png" },
		siteName: "og site",
	});
});

test("twitter fills a field only when og is absent (per-field precedence)", () => {
	const html = `
		<head>
			<meta property="og:title" content="og title">
			<meta name="twitter:description" content="tw description">
			<meta name="twitter:image" content="/tw.png">
		</head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r).toEqual({
		url: "https://example.com/",
		title: "og title",
		description: "tw description",
		image: { url: "https://example.com/tw.png" },
	});
});

test("standard meta fallback: <title> + meta description when no og/twitter", () => {
	const html = `
		<head>
			<title>std title</title>
			<meta name="description" content="std description">
		</head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r).toEqual({
		url: "https://example.com/",
		title: "std title",
		description: "std description",
	});
});

test("partial fallback uses first <img> when no og/twitter tags exist", () => {
	const html = `
		<head><title>std title</title></head>
		<body>
			<img src="/first.png" alt="first">
			<img src="/second.png">
		</body>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r).toEqual({
		url: "https://example.com/",
		title: "std title",
		description: "",
		image: { url: "https://example.com/first.png", alt: "first" },
	});
});

test("first <img> fallback is skipped when any og/twitter meta is present", () => {
	const html = `
		<head>
			<meta property="og:title" content="og title">
		</head>
		<body><img src="/should-skip.png"></body>`;
	const r = extract(ctx("https://example.com/", html)) as {
		image?: unknown;
	} & Record<string, unknown>;
	expect(r.image).toBeUndefined();
	expect(r.title).toBe("og title");
});

test("relative image url resolved against <base href>", () => {
	const html = `
		<head>
			<base href="https://cdn.example.com/sub/">
			<meta property="og:image" content="img/og.png">
		</head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r.image?.url).toBe("https://cdn.example.com/sub/img/og.png");
});

test("relative url resolved against page url when no <base>", () => {
	const html = `<head><meta property="og:image" content="img/og.png"></head>`;
	const r = extract(ctx("https://example.com/sub/page", html));
	expect(r.image?.url).toBe("https://example.com/sub/img/og.png");
});

test("absolute image url preserved", () => {
	const html = `<head><meta property="og:image" content="https://cdn.example.com/x.png"></head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r.image?.url).toBe("https://cdn.example.com/x.png");
});

test("always provides url/title/description; omits image/siteName when absent", () => {
	const html = `<head><title>only title</title></head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r.url).toBe("https://example.com/");
	expect(r.title).toBe("only title");
	expect(r.description).toBe("");
	expect(r).not.toHaveProperty("image");
	expect(r).not.toHaveProperty("siteName");
});

test("empty/whitespace meta values are treated as absent", () => {
	const html = `
		<head>
			<meta property="og:title" content="   ">
			<meta property="og:description" content="">
			<title>real title</title>
		</head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r.title).toBe("real title");
	expect(r.description).toBe("");
});

test("og:image without twitter: image uses og; siteName omitted when absent", () => {
	const html = `
		<head>
			<meta property="og:title" content="t">
			<meta property="og:image" content="/img.png">
		</head>`;
	const r = extract(ctx("https://example.com/", html));
	expect(r.image?.url).toBe("https://example.com/img.png");
	expect(r).not.toHaveProperty("siteName");
});

test("pure function: same input yields same output across calls", () => {
	const html = `<head><meta property="og:title" content="t"></head>`;
	const a = extract(ctx("https://example.com/", html));
	const b = extract(ctx("https://example.com/", html));
	expect(a).toEqual(b);
});

test("twitter:image used when og:image absent, resolved absolute", () => {
	const html = `<head><meta name="twitter:image" content="tw.png"></head>`;
	const r = extract(ctx("https://example.com/sub/", html));
	expect(r.image?.url).toBe("https://example.com/sub/tw.png");
});
