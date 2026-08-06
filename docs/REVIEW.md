# orkai review (optional) — contributor setup

This repo uses [orkai](https://getorkai.com) for AI-assisted code review driven
by the project's standards. Everything in this doc is **optional** — orkai is
only needed if you want to run the same review pipeline maintainers use. The
repo builds, tests, and lints without it, and the pre-commit hook skips
gracefully when orkai is not installed.

## 1. Install orkai

```sh
# macOS / Linux (see https://getorkai.com for other installers)
curl -fsSL https://getorkai.com/install | sh
```

Start the daemon:

```sh
orkai start
```

## 2. Import the project skeleton

The repo ships a cleaned knowledge-base export (standards, plan, milestones,
tasks — no per-install sessions, workflows, or embedding vectors):

```sh
orkai import <your-category> docs/orkai/metascan-skeleton.orkai.jsonl
```

Note: local entity IDs differ per install — `orkai export`/`import` rewires
relations to fresh UUIDs. Do not rely on the IDs shown in this repo's
`docs/REVIEW.md` or `.orkai/` config; resolve the current ones with:

```sh
orkai list --type standard
```

## 3. Index and configure review

Re-embed the imported entities with your local model and configure your LLM
provider:

```sh
orkai index
orkai review setup
```

## 4. Review process config

The project runs four review processes (one per standard), configured in
`.orkai.yaml` → `review.processes`. Each process file carries a
`knowledge_base.documents` entry pointing at a standard by its **install-local**
ID — replace `<standard-id>` with the ID from `orkai list --type standard`:

### fetch-safety.yaml

```yaml
name: fetch-safety
mode: diff
strict: true
knowledge_base:
  documents:
    # Fetch Safety & Resilience Standard
    - <standard-id>
include:
  - "packages/core/src/fetch.ts"
  - "packages/core/src/errors.ts"
exclude:
  - "**/*_test.*"
```

### adapter-authoring.yaml

```yaml
name: adapter-authoring
mode: diff
strict: false
knowledge_base:
  documents:
    # Adapter Authoring Standard
    - <standard-id>
include:
  - "packages/core/src/extractors/**"
  - "packages/core/src/adapters/**"
exclude:
  - "**/*_test.*"
```

### output-contract.yaml

```yaml
name: output-contract
mode: diff
strict: true
knowledge_base:
  documents:
    # PreviewResult Output Contract
    - <standard-id>
include:
  - "packages/core/src/types.ts"
  - "packages/core/src/index.ts"
  - "apps/server/src/**/*.ts"
exclude:
  - "**/*_test.*"
```

### runtime-toolchain.yaml

```yaml
name: runtime-toolchain
mode: diff
strict: false
knowledge_base:
  documents:
    # Metascan Runtime & Toolchain Standard
    - <standard-id>
include:
  - "package.json"
  - "packages/core/package.json"
  - "apps/server/package.json"
  - "tsconfig.json"
  - "packages/core/tsconfig.json"
  - "packages/core/tsconfig.test.json"
  - "biome.json"
  - ".orkai.yaml"
exclude: []
```

Wire the files into `.orkai.yaml`:

```yaml
review:
  git:
    auto_stage: true
  processes:
    - path: .orkai/review/fetch-safety.yaml
    - path: .orkai/review/adapter-authoring.yaml
    - path: .orkai/review/output-contract.yaml
    - path: .orkai/review/runtime-toolchain.yaml
```

## 5. Run reviews

```sh
orkai review                    # review staged changes (git diff --cached)
orkai review --base main --head <branch>   # review a full branch
orkai review report --latest    # latest report
```

## Bypassing the pre-commit hook

The pre-commit hook (`.githooks/pre-commit`) runs `orkai review` against
staged changes:

- **orkai not installed** → hook exits 0 (no-op), commit proceeds.
- **orkai installed, review passes** → commit proceeds.
- **orkai installed, review fails** → commit is blocked. Fix the findings, or
  bypass deliberately with `git commit --no-verify`.

To make the hook active in a fresh clone:

```sh
git config core.hooksPath .githooks
```

## Known quirks

- `orkai review` re-appends `.orkai/` to `.gitignore` on every run (report
  directory side effect). The intended ignore rules are already committed in
  `.gitignore`; restore them if they drift.
- Review process YAMLs are user-local (install-specific standard IDs) — they
  live under `.orkai/` and are never committed.
