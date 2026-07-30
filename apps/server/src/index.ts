import {
	preview as corePreview,
	PreviewError,
	type PreviewOptions,
	type PreviewResult,
	VERSION,
} from "@metascan/core";
import { Hono } from "hono";

export { VERSION };
export const APP_NAME = "metascan-server";

export interface ServerConfig {
	port: number;
	coreOptions: PreviewOptions;
}

function readPositiveInt(value: string | undefined): number | undefined {
	if (value === undefined || value === "") return undefined;
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) return undefined;
	return n;
}

export function loadConfig(
	env: Record<string, string | undefined> = process.env,
): ServerConfig {
	const port = readPositiveInt(env.PORT) ?? 3000;
	const coreOptions: PreviewOptions = {
		timeoutMs: readPositiveInt(env.METASCAN_TIMEOUT_MS),
		maxRedirects: readPositiveInt(env.METASCAN_MAX_REDIRECTS),
		cacheTtlMs: readPositiveInt(env.METASCAN_CACHE_TTL),
	};
	return { port, coreOptions };
}

const config = loadConfig();

let previewFn: (url: string) => Promise<PreviewResult> = (url) =>
	corePreview(url, config.coreOptions);
export function _setPreviewFn(fn: typeof previewFn): void {
	previewFn = fn;
}

export const app = new Hono();

app.onError((err, c) => {
	if (err instanceof PreviewError) {
		const { code, message } = err;
		return c.json({ error: { code, message } }, errorStatus(code));
	}
	console.error(err);
	return c.json(
		{ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } },
		500,
	);
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/preview", async (c) => {
	const url = c.req.query("url");
	if (url === undefined || url === "") {
		return c.json(
			{
				error: {
					code: "INVALID_URL",
					message: "Missing required query param: url",
				},
			},
			400,
		);
	}
	const result: PreviewResult = await previewFn(url);
	return c.json(result);
});

function errorStatus(code: PreviewError["code"]): 400 | 502 | 504 {
	switch (code) {
		case "INVALID_URL":
			return 400;
		case "TIMEOUT":
			return 504;
		default:
			return 502;
	}
}

if (import.meta.main) {
	Bun.serve({ port: config.port, fetch: app.fetch });
	console.log(`${APP_NAME} listening on :${config.port}`);
}
