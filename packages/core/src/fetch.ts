import { PreviewError } from "./errors";
import type { FetchFn, FetchResult, PreviewOptions } from "./types";

export const DEFAULT_TIMEOUT_MS = 1500;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
export const DEFAULT_USER_AGENT =
	"metascan/0.1.0 (+https://github.com/OrkaiOS/metascan)";

const HTML_ACCEPT = "text/html,application/xhtml+xml";

export async function fetchDocument(
	rawUrl: string,
	options?: PreviewOptions,
): Promise<FetchResult> {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new PreviewError("INVALID_URL", `Invalid URL: ${rawUrl}`, {
			url: rawUrl,
		});
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new PreviewError(
			"INVALID_URL",
			`Unsupported scheme '${parsed.protocol}': ${rawUrl}`,
			{ url: rawUrl },
		);
	}

	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
	const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
	const doFetch: FetchFn = options?.fetch ?? fetch;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	let currentUrl = parsed.href;
	let redirects = 0;
	let response: Response;

	try {
		while (true) {
			response = await doFetch(currentUrl, {
				method: "GET",
				redirect: "manual",
				signal: controller.signal,
				headers: { "User-Agent": userAgent, Accept: HTML_ACCEPT },
			});
			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get("location");
				if (location === null) break;
				if (redirects >= maxRedirects) {
					throw new PreviewError(
						"TOO_MANY_REDIRECTS",
						`Exceeded ${maxRedirects} redirects following ${rawUrl}`,
						{ url: rawUrl },
					);
				}
				redirects += 1;
				const next = new URL(location, currentUrl);
				if (next.protocol !== "http:" && next.protocol !== "https:") {
					throw new PreviewError(
						"INVALID_URL",
						`Redirect to unsupported scheme '${next.protocol}'`,
						{ url: rawUrl },
					);
				}
				currentUrl = next.href;
				continue;
			}
			break;
		}
	} catch (error) {
		if (error instanceof PreviewError) throw error;
		if (isAbortError(error)) {
			throw new PreviewError(
				"TIMEOUT",
				`Request timed out after ${timeoutMs}ms: ${rawUrl}`,
				{ url: rawUrl, cause: error },
			);
		}
		throw new PreviewError("FETCH_ERROR", `Failed to fetch ${rawUrl}`, {
			url: rawUrl,
			cause: error,
		});
	} finally {
		clearTimeout(timer);
	}

	const contentType = response.headers.get("content-type");
	if (!isHtmlContentType(contentType)) {
		return { url: currentUrl, html: "", contentType: contentType ?? undefined };
	}

	const html = await readCappedText(response, maxBytes);
	return { url: currentUrl, html, contentType: contentType ?? undefined };
}

function isAbortError(error: unknown): boolean {
	if (error instanceof DOMException) return error.name === "AbortError";
	return error instanceof Error && error.name === "AbortError";
}

function isHtmlContentType(contentType: string | null): boolean {
	if (contentType === null) return true;
	const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return mime === "text/html" || mime === "application/xhtml+xml";
}

async function readCappedText(
	response: Response,
	maxBytes: number,
): Promise<string> {
	const body = response.body;
	if (body === null) return response.text();
	const reader = body.getReader();
	const decoder = new TextDecoder("utf-8", { fatal: false });
	let received = 0;
	let out = "";
	try {
		while (received < maxBytes) {
			const { done, value } = await reader.read();
			if (done || value === undefined) break;
			if (received + value.byteLength > maxBytes) {
				const remaining = maxBytes - received;
				out += decoder.decode(value.subarray(0, remaining), { stream: false });
				received += remaining;
				break;
			}
			out += decoder.decode(value, { stream: true });
			received += value.byteLength;
		}
		out += decoder.decode();
		return out;
	} finally {
		await reader.cancel().catch(() => {});
	}
}
