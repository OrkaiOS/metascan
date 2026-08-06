import type { Cache } from "./types";

export const DEFAULT_MAX_ENTRIES = 1000;
export const DEFAULT_TTL_MS = 60 * 60 * 1000;

export interface MemoryCacheOptions {
	maxEntries?: number;
	defaultTtlMs?: number;
}

interface Entry<V> {
	value: V;
	expiresAt: number;
}

export class MemoryCache<V = unknown> implements Cache<V> {
	private readonly store = new Map<string, Entry<V>>();
	private readonly maxEntries: number;
	private readonly defaultTtlMs: number;

	constructor(options: MemoryCacheOptions = {}) {
		this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
		this.defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;
	}

	async get(key: string): Promise<V | undefined> {
		const entry = this.store.get(key);
		if (entry === undefined) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.store.delete(key);
			return undefined;
		}
		this.store.delete(key);
		this.store.set(key, entry);
		return entry.value;
	}

	async set(key: string, value: V, ttlMs?: number): Promise<void> {
		const ttl = ttlMs ?? this.defaultTtlMs;
		const expiresAt = Date.now() + ttl;
		if (this.store.has(key)) this.store.delete(key);
		this.store.set(key, { value, expiresAt });
		this.evict();
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	private evict(): void {
		while (this.store.size > this.maxEntries) {
			const oldest = this.store.keys().next().value;
			if (oldest === undefined) break;
			this.store.delete(oldest);
		}
	}
}
