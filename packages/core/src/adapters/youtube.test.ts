import { expect, test } from "bun:test";
import * as cheerio from "cheerio";
import type { AdapterContext } from "../types";
import { youtubeAdapter } from "./youtube";

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

test("match: youtube.com", () => {
	expect(
		youtubeAdapter.match(new URL("https://youtube.com/watch?v=dQw4w9WgXcQ")),
	).toBe(true);
});

test("match: www.youtube.com", () => {
	expect(
		youtubeAdapter.match(
			new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
		),
	).toBe(true);
});

test("match: m.youtube.com", () => {
	expect(
		youtubeAdapter.match(new URL("https://m.youtube.com/watch?v=dQw4w9WgXcQ")),
	).toBe(true);
});

test("match: youtu.be", () => {
	expect(youtubeAdapter.match(new URL("https://youtu.be/dQw4w9WgXcQ"))).toBe(
		true,
	);
});

test("match: no match for other domains", () => {
	expect(youtubeAdapter.match(new URL("https://vimeo.com/12345"))).toBe(false);
	expect(
		youtubeAdapter.match(new URL("https://twitter.com/user/status/123")),
	).toBe(false);
	expect(
		youtubeAdapter.match(
			new URL("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
		),
	).toBe(false);
	expect(
		youtubeAdapter.match(new URL("https://example.com/watch?v=dQw4w9WgXcQ")),
	).toBe(false);
});

test("extract: returns enriched result from YouTube fixture", async () => {
	const html = await load("youtube.html");
	const result = youtubeAdapter.extract(
		ctx("https://www.youtube.com/watch?v=dQw4w9WgXcQ", html),
	);

	expect(result).toEqual({
		url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		title: "Cute Cat Compilation 2025 — Funny Cats & Kittens",
		description:
			"Over 30 minutes of the funniest cat videos on the internet. Watch kittens chase lasers, fall off couches, and get startled by cucumbers.",
		image: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
		siteName: "YouTube",
	});
});

test("extract: returns null when title is missing", async () => {
	const html = await load("youtube-missing-fields.html");
	const result = youtubeAdapter.extract(
		ctx("https://www.youtube.com/watch?v=XXXXXXXXXXX", html),
	);
	expect(result).toBeNull();
});

test("extract: returns null when description is missing", () => {
	const html =
		'<html><head><meta property="og:title" content="A Video Title"></head></html>';
	const result = youtubeAdapter.extract(
		ctx("https://www.youtube.com/watch?v=abc123", html),
	);
	expect(result).toBeNull();
});

test("name is youtube", () => {
	expect(youtubeAdapter.name).toBe("youtube");
});
