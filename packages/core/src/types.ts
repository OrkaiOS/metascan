import type { Cache } from "./cache/types";

export interface PreviewImage {
	url: string;
	alt?: string;
	width?: number;
	height?: number;
}

export interface PreviewResult {
	url: string;
	title: string;
	description: string;
	image?: PreviewImage;
	siteName?: string;
	adapter: string;
	fetchedAt: number;
	fromCache: boolean;
}

export type FetchFn = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export interface PreviewOptions {
	timeoutMs?: number;
	maxRedirects?: number;
	maxBytes?: number;
	userAgent?: string;
	fetch?: FetchFn;
	cache?: Cache<PreviewResult>;
	cacheTtlMs?: number;
	adapters?: Adapter[];
}

export type CheerioRoot = unknown;

export interface AdapterContext {
	url: URL;
	html: string;
	$: CheerioRoot;
}

export type AdapterResult = PreviewResult | Partial<PreviewResult> | null;

export interface Adapter {
	name: string;
	match(url: URL): boolean;
	extract(ctx: AdapterContext): AdapterResult;
}

export interface FetchResult {
	url: string;
	html: string;
	contentType?: string;
}
