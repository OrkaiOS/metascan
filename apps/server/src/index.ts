import {
	preview as corePreview,
	PreviewError,
	type PreviewResult,
	VERSION,
} from "@metascan/core";
import { Hono } from "hono";

export { VERSION };
export const APP_NAME = "metascan-server";

let previewFn: (url: string) => Promise<PreviewResult> = corePreview;
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
	const port = Number(process.env.PORT ?? 3000);
	Bun.serve({ port, fetch: app.fetch });
	console.log(`${APP_NAME} listening on :${port}`);
}
