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

## Status

🚧 Under active development (v1). Public API, build, and HTTP routes land in
later milestones; see the roadmap for details.

## License

[MIT](./LICENSE) © Metascan Contributors
