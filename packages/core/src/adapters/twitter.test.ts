import { expect, test } from "bun:test";
import * as cheerio from "cheerio";
import type { AdapterContext } from "../types";
import { twitterAdapter } from "./twitter";

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

test("match: twitter.com", () => {
	expect(
		twitterAdapter.match(
			new URL("https://twitter.com/marco/status/1876543210987654321"),
		),
	).toBe(true);
});

test("match: www.twitter.com", () => {
	expect(
		twitterAdapter.match(
			new URL("https://www.twitter.com/marco/status/1876543210987654321"),
		),
	).toBe(true);
});

test("match: x.com", () => {
	expect(
		twitterAdapter.match(
			new URL("https://x.com/marco/status/1876543210987654321"),
		),
	).toBe(true);
});

test("match: www.x.com", () => {
	expect(
		twitterAdapter.match(
			new URL("https://www.x.com/marco/status/1876543210987654321"),
		),
	).toBe(true);
});

test("match: no match for other domains", () => {
	expect(
		twitterAdapter.match(new URL("https://youtube.com/watch?v=dQw4w9WgXcQ")),
	).toBe(false);
	expect(twitterAdapter.match(new URL("https://vimeo.com/12345"))).toBe(false);
	expect(twitterAdapter.match(new URL("https://example.com/status/123"))).toBe(
		false,
	);
	expect(
		twitterAdapter.match(new URL("https://fxtwitter.com/user/status/123")),
	).toBe(false);
	expect(
		twitterAdapter.match(new URL("https://twttr.com/user/status/123")),
	).toBe(false);
});

test("extract: returns enriched result from X fixture", async () => {
	const html = await load("twitter.html");
	const result = twitterAdapter.extract(
		ctx("https://x.com/marco/status/1876543210987654321", html),
	);

	expect(result).toEqual({
		url: "https://x.com/marco/status/1876543210987654321",
		title:
			'Marco on X: "Just shipped the new adapter system for metascan — pure OG/meta extraction with zero runtime deps."',
		description:
			"Just shipped the new adapter system for metascan — pure OG/meta extraction with zero runtime deps.",
		image: {
			url: "https://pbs.twimg.com/card_img/1876543210987654321/abc123?format=jpg&name=large",
		},
		siteName: "X (formerly Twitter)",
	});
});

test("extract: returns null when title is missing", async () => {
	const html = await load("twitter-missing-fields.html");
	const result = twitterAdapter.extract(
		ctx("https://x.com/marco/status/0000000000000000000", html),
	);
	expect(result).toBeNull();
});

test("extract: returns null when description is missing", () => {
	const html =
		'<html><head><meta property="og:title" content="A Tweet Title"></head></html>';
	const result = twitterAdapter.extract(
		ctx("https://x.com/marco/status/abc123", html),
	);
	expect(result).toBeNull();
});

test("extract: resolves a relative twitter:image to an absolute URL", () => {
	const html =
		"<html><head>" +
		'<meta property="og:title" content="Title">' +
		'<meta name="twitter:description" content="desc">' +
		'<meta name="twitter:image" content="/card_img/abc/large?format=jpg">' +
		"</head></html>";
	const result = twitterAdapter.extract(
		ctx("https://x.com/marco/status/123", html),
	);
	expect(result?.image?.url).toBe(
		"https://x.com/card_img/abc/large?format=jpg",
	);
});

test("extract: resolves a protocol-relative twitter:image against the page base", () => {
	const html =
		"<html><head>" +
		'<meta property="og:title" content="Title">' +
		'<meta name="twitter:description" content="desc">' +
		'<meta name="twitter:image" content="//pbs.twimg.com/img/x.jpg">' +
		"</head></html>";
	const result = twitterAdapter.extract(
		ctx("https://x.com/marco/status/123", html),
	);
	expect(result?.image?.url).toBe("https://pbs.twimg.com/img/x.jpg");
});

test("name is twitter", () => {
	expect(twitterAdapter.name).toBe("twitter");
});
