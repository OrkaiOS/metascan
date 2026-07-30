import type { Adapter } from "../types";

export interface ResolveOptions {
	adapters?: Adapter[];
}

const customAdapters: Adapter[] = [];
let builtInAdapters: Adapter[] = [];
let defaultAdapter: Adapter | undefined;

export function registerAdapter(adapter: Adapter): void {
	customAdapters.push(adapter);
}

export function clearCustomAdapters(): void {
	customAdapters.length = 0;
}

export function getCustomAdapters(): Adapter[] {
	return [...customAdapters];
}

export function setBuiltInAdapters(adapters: Adapter[]): void {
	builtInAdapters = [...adapters];
}

export function getBuiltInAdapters(): Adapter[] {
	return [...builtInAdapters];
}

export function setDefaultAdapter(adapter: Adapter | undefined): void {
	defaultAdapter = adapter;
}

export function getDefaultAdapter(): Adapter | undefined {
	return defaultAdapter;
}

export function resolve(
	url: string | URL,
	options?: ResolveOptions,
): Adapter | undefined {
	const parsed = typeof url === "string" ? new URL(url) : url;

	for (const adapter of options?.adapters ?? []) {
		if (adapter.match(parsed)) return adapter;
	}

	for (const adapter of customAdapters) {
		if (adapter.match(parsed)) return adapter;
	}

	for (const adapter of builtInAdapters) {
		if (adapter.match(parsed)) return adapter;
	}

	if (defaultAdapter?.match(parsed)) return defaultAdapter;

	return undefined;
}
