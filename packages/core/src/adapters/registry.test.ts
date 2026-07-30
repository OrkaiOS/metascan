import { beforeEach, expect, test } from "bun:test";
import type { Adapter, AdapterContext, AdapterResult } from "../types";
import {
	clearCustomAdapters,
	registerAdapter,
	resolve,
	setBuiltInAdapters,
	setDefaultAdapter,
} from "./registry";

function makeAdapter(name: string, hostname: string): Adapter {
	return {
		name,
		match(url: URL): boolean {
			return url.hostname === hostname;
		},
		extract(_ctx: AdapterContext): AdapterResult {
			return { url: "", title: "", description: "" };
		},
	};
}

const youtube = makeAdapter("youtube", "www.youtube.com");
const twitter = makeAdapter("twitter", "twitter.com");
const vimeo = makeAdapter("vimeo", "vimeo.com");
const fallback: Adapter = {
	name: "default",
	match: () => true,
	extract: () => ({ url: "", title: "", description: "" }),
};

beforeEach(() => {
	clearCustomAdapters();
	setBuiltInAdapters([]);
	setDefaultAdapter(undefined);
});

test("resolves the correct adapter for a known hostname", () => {
	setBuiltInAdapters([youtube, twitter]);
	setDefaultAdapter(fallback);

	const result = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	expect(result?.name).toBe("youtube");
});

test("falls through to default when no adapter matches", () => {
	setBuiltInAdapters([youtube, twitter]);
	setDefaultAdapter(fallback);

	const result = resolve("https://example.com/page");
	expect(result?.name).toBe("default");
});

test("first match wins among built-in adapters", () => {
	const wide = {
		name: "wide",
		match: () => true,
		extract: () => null,
	};
	setBuiltInAdapters([wide, youtube]);
	setDefaultAdapter(fallback);

	const result = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	expect(result?.name).toBe("wide");
});

test("custom adapters prepend and run before built-ins", () => {
	setBuiltInAdapters([youtube, twitter]);
	setDefaultAdapter(fallback);
	registerAdapter(vimeo);

	const youTubeResult = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	expect(youTubeResult?.name).toBe("youtube");

	const vimeoResult = resolve("https://vimeo.com/12345");
	expect(vimeoResult?.name).toBe("vimeo");
});

test("per-call options.adapters run before registered custom and built-in adapters", () => {
	setBuiltInAdapters([youtube, twitter]);
	setDefaultAdapter(fallback);

	const perCall = makeAdapter("percall", "www.youtube.com");
	const result = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
		adapters: [perCall],
	});
	expect(result?.name).toBe("percall");
});

test("per-call adapters run before registered custom adapters", () => {
	registerAdapter(youtube);
	setDefaultAdapter(fallback);

	const perCall = makeAdapter("percall", "www.youtube.com");
	const result = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
		adapters: [perCall],
	});
	expect(result?.name).toBe("percall");
});

test("returns undefined when no adapters match and no default is set", () => {
	setBuiltInAdapters([youtube, twitter]);

	const result = resolve("https://example.com/page");
	expect(result).toBeUndefined();
});

test("accepts a URL object", () => {
	setBuiltInAdapters([youtube]);
	setDefaultAdapter(fallback);

	const result = resolve(
		new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
	);
	expect(result?.name).toBe("youtube");
});

test("registered custom adapter with matching hostname selected over built-in with same hostname", () => {
	setBuiltInAdapters([youtube]);
	setDefaultAdapter(fallback);

	const customYoutube = makeAdapter("custom-youtube", "www.youtube.com");
	registerAdapter(customYoutube);

	const result = resolve("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	expect(result?.name).toBe("custom-youtube");
});
