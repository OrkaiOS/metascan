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

```sh
bun install
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
