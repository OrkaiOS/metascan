# metascan

Fast, resilient TypeScript link-preview engine and HTTP server. Turn any URL
into a Slack/iMessage-style rich preview (title, description, image, site name).

metascan is a Bun monorepo with two surfaces:

| Path            | Package           | Published? | Description                                            |
| --------------- | ----------------- | ---------- | ----------------------------------------------------- |
| `packages/core` | `@metascan/core`  | Yes        | The link-preview engine + public API. Web-standard.   |
| `apps/server`   | `metascan-server` | No         | Hono-on-Bun HTTP app exposing core. Ships as a bin + Docker image. |

## Runtime

- **[Bun](https://bun.sh)** `>= 1.2.x` (developed against `bun@1.3.14`, pinned via
  the root `packageManager` field).
- `@metascan/core` is written against web-standard APIs only (`fetch`, `URL`,
  `Request`, `Response`, `Headers`) — no `node:*` imports — so it stays
  portable across modern runtimes. The server is Bun-native.

## Monorepo layout

```
metascan/
├── packages/
│   └── core/          @metascan/core — engine + public API
└── apps/
    └── server/        metascan-server — Hono HTTP app on Bun.serve
```

Workspaces are configured at the repo root: `["packages/*", "apps/*"]`. The
server depends on core via `"@metascan/core": "workspace:*"`.

## Requirements

- Bun 1.2.x or newer.

## Install

### Use the library (`@metascan/core`)

```sh
bun add @metascan/core
```

`@metascan/core` is web-standard (global `fetch`, `URL`, `Request`, `Response`,
`Headers` — no `node:*` imports), so it runs on Bun and any modern runtime that
provides those globals.

### Work on this repo

```sh
bun install
```

## Usage

`preview(url, options?)` fetches a URL, follows redirects, parses the HTML, and
returns a `PreviewResult` (title, description, image, site name). Results are
cached; the second call for the same URL is served from cache without
re-fetching.

```ts
import { preview, type PreviewResult } from "@metascan/core";

const result: PreviewResult = await preview("https://example.com");

console.log(result.url);        // "https://example.com/"
console.log(result.title);      // "Example Domain"
console.log(result.description);
console.log(result.image);      // { url: "..." } | undefined
console.log(result.siteName);   // "Example" | undefined
console.log(result.adapter);    // "default" | "youtube" | "twitter" | ...
console.log(result.fromCache);  // false on first call, true on cache hits
```

### Options

All options are optional. The most common ones:

```ts
import { MemoryCache, preview, type PreviewResult } from "@metascan/core";

const result = await preview("https://example.com", {
  timeoutMs: 1500,        // per-request timeout (default 1500ms)
  maxRedirects: 3,        // default 3
  maxBytes: 2 * 1024 * 1024, // cap response body (default 2 MiB)
  userAgent: "my-bot/1.0",
  cache: new MemoryCache<PreviewResult>({ defaultTtlMs: 60 * 60 * 1000 }),
  cacheTtlMs: 60 * 60 * 1000,
});
```

| Option          | Type                  | Default      | Notes                                                       |
| --------------- | --------------------- | ------------ | ----------------------------------------------------------- |
| `timeoutMs`     | `number`              | `1500`       | Per-request abort timeout.                                  |
| `maxRedirects`  | `number`              | `3`          | HTTP redirects followed manually.                           |
| `maxBytes`      | `number`              | `2 MiB`      | Response body is truncated past this.                       |
| `userAgent`     | `string`              | `metascan/*` | `User-Agent` header sent on the fetch.                      |
| `fetch`         | `FetchFn`             | global fetch | Inject a custom/fetch mock (handy for tests).               |
| `cache`         | `Cache<PreviewResult>`| shared `MemoryCache` | Override the cache (e.g. a Redis-backed `Cache`). |
| `cacheTtlMs`    | `number`              | cache default | TTL for the entry written by this call.                    |
| `adapters`      | `Adapter[]`           | built-ins    | Per-call adapters prepended ahead of built-ins.             |

### Adapters

Site-specific extraction is pluggable via adapters. Built-ins (`youtube`,
`twitter`/X, then the OG `default` extractor) run in registry order; the first
adapter whose `match(url)` returns `true` wins. Register a custom adapter to
run ahead of the built-ins:

```ts
import type { CheerioAPI } from "cheerio";
import {
  preview,
  registerAdapter,
  type Adapter,
  type AdapterContext,
} from "@metascan/core";

const wikiAdapter: Adapter = {
  name: "wikipedia",
  match: (url) => url.hostname.endsWith("wikipedia.org"),
  extract(ctx: AdapterContext) {
    // Adapters receive already-fetched HTML + the parsed URL; they MUST NOT
    // fetch the network themselves. Return null to defer to the next adapter.
    const $ = ctx.$ as CheerioAPI;
    const title = $("h1#firstHeading").first().text().trim();
    if (!title) return null;
    return {
      url: ctx.url.href,
      title,
      description: $("#mw-content-text p").first().text().trim(),
    };
  },
};

registerAdapter(wikiAdapter);

const result = await preview("https://en.wikipedia.org/wiki/Bun_(software)");
console.log(result.adapter); // "wikipedia"
```

You can also pass adapters per call without mutating global state —
`preview(url, { adapters: [wikiAdapter] })` prepends them ahead of the
built-ins for that call only.

### Errors

`preview()` throws a `PreviewError` on failure. Inspect `error.code` to branch
on the failure class:

```ts
import { PreviewError, preview } from "@metascan/core";

try {
  await preview("not-a-url");
} catch (err) {
  if (err instanceof PreviewError) {
    console.log(err.code); // "INVALID_URL" | "TIMEOUT" | "FETCH_ERROR" |
                           // "PARSE_ERROR" | "TOO_MANY_REDIRECTS"
    console.log(err.url);
  }
}
```

## Scripts (run from the repo root)

| Script       | Command               | What it does                                  |
| ------------ | --------------------- | --------------------------------------------- |
| `test`       | `bun test`            | Run the `bun:test` suite across all workspaces. |
| `lint`       | `bun run lint`        | Biome lint + format check (`biome check .`).   |
| `format`     | `bun run format`      | Biome format write.                            |

## Tooling

- **TypeScript** (`strict: true`, `target`/`module: ESNext`,
  `moduleResolution: Bundler`).
- **Biome** for lint + format (single root `biome.json`; no ESLint/Prettier).
- **`bun:test`** runner; tests are colocated as `*.test.ts` next to the module
  under test.

## Docker

The server ships as a container image via a multi-stage `Dockerfile` at
`apps/server/Dockerfile`. The build context is the **repo root** (the image
copies the root `package.json` + `bun.lock` and both workspaces so Bun can
resolve the `@metascan/core` workspace link), so build from there:

```sh
docker build -f apps/server/Dockerfile -t metascan-server .
```

Run the image, publishing the container's port 3000 to the host:

```sh
docker run --rm -p 3000:3000 metascan-server
```

### Environment variables

| Variable | Default | Description                                                                 |
| -------- | ------- | --------------------------------------------------------------------------- |
| `PORT`   | `3000`  | TCP port the HTTP server binds inside the container (`Bun.serve({ port })`). |

To run on a different host port or container port, combine `-p` with `PORT`.
For example, host `8080` → container `3000` (default):

```sh
docker run --rm -p 8080:3000 metascan-server
```

To override the in-container port, set `PORT` and publish it:

```sh
docker run --rm -p 4000:4000 -e PORT=4000 metascan-server
```

### Smoke check

With a container running (`docker run --rm -p 3000:3000 metascan-server`),

1. **Health** — expect HTTP `200`:

   ```sh
   curl -i http://localhost:3000/health
   # HTTP/1.1 200 OK
   # content-type: application/json
   # {"status":"ok"}
   ```

2. **Preview** — expect `200` and a JSON body (a `PreviewResult`):

   ```sh
   curl -s 'http://localhost:3000/preview?url=https://example.com' | jq .
   # {
   #   "url": "https://example.com/",
   #   "title": "Example Domain",
   #   ...
   # }
   ```

A clean run shows `/health` → `200` and `/preview?url=…` → JSON with **no
runtime errors** in the container logs (`metascan-server listening on :3000`).

## Status

🚧 Under active development (v1). Public API, build, and HTTP routes land in
later milestones; see the roadmap for details.

## License

[MIT](./LICENSE) © Metascan Contributors
