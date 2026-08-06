# Contributing to metascan

Thanks for contributing! This document covers how to build, test, and land
changes in the metascan repo.

## Project layout

```
packages/core   → @metascan/core — the link-preview engine + public API (published)
apps/server     → metascan-server — Hono-on-Bun HTTP app (private, ships as bin + Docker)
```

## Prerequisites

- [Bun](https://bun.sh) `>= 1.2.0` (developed against `bun@1.3.14` — pinned in
  the root `packageManager` field).

## Development loop

```sh
bun install          # install workspace deps
bun run lint         # biome check .
bun run typecheck    # tsc --noEmit across core src, core tests, server
bun test             # bun:test across all workspaces
bun run build        # Bun.build for published packages
```

All four gates must pass before a PR is ready. CI runs `lint` + `typecheck` +
`test` on every push/PR to `main` with a frozen lockfile.

## Conventions

- **No `node:*` imports, project-wide** — enforced by Biome
  (`noRestrictedImports`). `@metascan/core` must stay web-standard
  (`fetch`, `URL`, `Request`, `Response`, `Headers` only); the server uses Bun
  globals.
- TypeScript `strict: true`, tabs + double quotes (Biome defaults).
- Tests are colocated `*.test.ts` next to the module under test, using
  `bun:test`. Adapter/extractor tests use saved HTML fixtures in
  `__fixtures__/` — no network.
- New adapters: match on hostname only, resolve URLs to absolute, return
  `null` to defer (never throw), register via `registerAdapter()` or
  `preview(url, { adapters: [...] })`. See the Adapter Authoring Standard in
  the orkai skeleton export.
- Version bumps: semver. `@metascan/core` `VERSION` constant and
  `DEFAULT_USER_AGENT` must match `packages/core/package.json`.

## Pull request process

1. Branch from `main` (feature branches `orkai/<topic>` are fine too).
2. Make your change with colocated tests; run the four gates above.
3. Open a PR against `main`. CI must be green.
4. A maintainer reviews and merges.

### Pre-commit hook

`.githooks/pre-commit` runs `orkai review` (AI-assisted standard conformance)
against staged changes. It no-ops if orkai is not installed — contributors
without orkai are never blocked. Activate it with
`git config core.hooksPath .githooks`. See [docs/REVIEW.md](docs/REVIEW.md)
for the optional orkai review setup. To bypass deliberately:
`git commit --no-verify`.

## Bug vs. security

- **Bugs / feature requests** → open a GitHub issue.
- **Security vulnerabilities** → do NOT open a public issue. Follow
  [SECURITY.md](SECURITY.md) — private disclosure via GitHub Security
  Advisories.

## License

MIT — see [LICENSE](LICENSE).
