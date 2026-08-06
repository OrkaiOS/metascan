import { expect, test } from "bun:test";
import { MemoryCache } from "./memory";
import type { Cache } from "./types";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test("MemoryCache implements Cache", () => {
	const cache: Cache<unknown> = new MemoryCache();
	expect(cache.get).toBeInstanceOf(Function);
	expect(cache.set).toBeInstanceOf(Function);
	expect(cache.delete).toBeInstanceOf(Function);
});

test("get returns undefined for a missing key", async () => {
	const cache = new MemoryCache<string>();
	expect(await cache.get("missing")).toBeUndefined();
});

test("set then get returns the stored value", async () => {
	const cache = new MemoryCache<string>();
	await cache.set("a", "1");
	expect(await cache.get("a")).toBe("1");
});

test("delete removes the value", async () => {
	const cache = new MemoryCache<string>();
	await cache.set("a", "1");
	await cache.delete("a");
	expect(await cache.get("a")).toBeUndefined();
});

test("default TTL is ~1h", async () => {
	const cache = new MemoryCache<string>();
	await cache.set("a", "1");
	const expected = Date.now() + 60 * 60 * 1000;
	const got = await cache.get("a");
	expect(got).toBe("1");
	const actual = Date.now() + 60 * 60 * 1000;
	expect(actual).toBeGreaterThanOrEqual(expected);
});

test("TTL: expired entry is treated as absent", async () => {
	const cache = new MemoryCache<string>({ defaultTtlMs: 50 });
	await cache.set("a", "1", 50);
	expect(await cache.get("a")).toBe("1");
	await delay(60);
	expect(await cache.get("a")).toBeUndefined();
});

test("TTL: per-key ttl overrides the default", async () => {
	const cache = new MemoryCache<string>({ defaultTtlMs: 60_000 });
	await cache.set("long", "1", 60_000);
	await cache.set("short", "2", 30);
	expect(await cache.get("short")).toBe("2");
	await delay(40);
	expect(await cache.get("short")).toBeUndefined();
	expect(await cache.get("long")).toBe("1");
});

test("TTL: set with ttl of 0 expires immediately", async () => {
	const cache = new MemoryCache<string>();
	await cache.set("a", "1", 0);
	expect(await cache.get("a")).toBeUndefined();
});

test("LRU: least recently used is evicted when maxEntries is exceeded", async () => {
	const cache = new MemoryCache<string>({ maxEntries: 2 });
	await cache.set("a", "1");
	await cache.set("b", "2");
	await cache.get("a");
	await cache.set("c", "3");
	expect(await cache.get("a")).toBe("1");
	expect(await cache.get("b")).toBeUndefined();
	expect(await cache.get("c")).toBe("3");
});

test("LRU: a fresh set on an existing key refreshes recency", async () => {
	const cache = new MemoryCache<string>({ maxEntries: 2 });
	await cache.set("a", "1");
	await cache.set("b", "2");
	await cache.set("a", "1");
	await cache.set("c", "3");
	expect(await cache.get("a")).toBe("1");
	expect(await cache.get("b")).toBeUndefined();
	expect(await cache.get("c")).toBe("3");
});

test("LRU: delete does not evict other entries", async () => {
	const cache = new MemoryCache<string>({ maxEntries: 2 });
	await cache.set("a", "1");
	await cache.set("b", "2");
	await cache.delete("a");
	expect(await cache.get("a")).toBeUndefined();
	expect(await cache.get("b")).toBe("2");
	await cache.set("c", "3");
	expect(await cache.get("b")).toBe("2");
	expect(await cache.get("c")).toBe("3");
});

test("LRU + TTL: expired entries are purged lazily on access, not on set", async () => {
	const cache = new MemoryCache<string>({ maxEntries: 3, defaultTtlMs: 60 });
	await cache.set("a", "1", 60);
	await cache.set("b", "2", 30);
	await cache.set("c", "3", 60);
	await delay(40);
	expect(await cache.get("b")).toBeUndefined();
	await cache.set("d", "4", 60);
	expect(await cache.get("a")).toBe("1");
	expect(await cache.get("c")).toBe("3");
	expect(await cache.get("d")).toBe("4");
});
