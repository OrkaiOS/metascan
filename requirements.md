# Metascan — Business Requirements

## 1. Problem

Content creators using our scheduling SaaS paste links that currently render as
plain text. Competitors and messaging apps (Slack, iMessage) show rich link
previews — title, description, and image — that make posts more engaging.
Building this in-house is preferable to paying per-call for third-party APIs
(e.g., Microlink) since we are bootstrapped and cost-sensitive. There is no
good free, open-source, TypeScript-native alternative that is both fast and
extensible.

## 2. Users

- **Primary:** Our own product engineering team — integrating rich previews
  into the scheduling SaaS (Node/TypeScript backend).
- **Secondary:** Our other services — a Python backend and a mobile app —
  consuming the same capability over HTTP without an npm dependency.
- **Tertiary:** The broader open-source community, who can adopt and extend it.

## 3. Outcomes (Success Criteria)

1. **Drop-in library** — A TypeScript package (`metascan`) installable via npm.
   Calling it with a single URL returns a structured rich-preview object.
2. **Rich preview out of the box** — Returns title, description, image, url,
   and site name, parsed from Open Graph, Twitter Card, and standard meta
   tags, for the majority of common websites without configuration.
3. **Site-specific customization** — First-class extension points so that
   specific domains (e.g., YouTube, Twitter/X) can be handled with custom
   logic, without forking the library.
4. **Optional API server** — Ships as a small standalone HTTP service
   (`GET /preview?url=...` → JSON) so non-JS services can consume it.
5. **Performance** — Median response under 2 seconds per URL.
6. **Resilience** — Degrades gracefully on slow, malformed, or unreachable
   sites; never crashes the caller.
7. **Caching** — Avoids repeatedly fetching the same URL; cache is pluggable
   with an in-memory default.
8. **Open source** — Released under the MIT license to invite community
   contributions.

## 4. Constraints

- **Language/runtime:** TypeScript / Node.js.
- **Budget:** No paid third-party APIs. No infrastructure dependencies required
  to run the library (the server may opt into Redis-style caches).
- **Performance budget:** < 2s per URL under normal conditions.
- **Cost:** Must run cheaply; no headless-browser rendering in the default path.
- **License:** MIT.

## 5. Non-Goals (v1)

- **JavaScript-rendered content.** We parse server-rendered HTML only. Sites
  that inject meta tags via JS after load are out of scope initially (may be
  revisited via an optional plugin later).
- **Paywalled / auth-required pages.** No login flows or credential handling.
- **Full media embedding.** We return metadata, not playable embeds/players.
- **Scraping or data extraction** beyond link-preview metadata.
- **Guaranteed correctness on every site on the internet.**

## 6. Open Questions

- **Output contract:** Exact field names and JSON shape for the preview object
  (to be finalized with the architect/engineering).
- **Rate limiting / auth on the server:** Needed now, or defer until we see
  abuse? (Current assumption: plain REST for v1.)
- **TTL / invalidation policy** for cached previews.
- **Image handling:** Do we proxy/resize images, or return the source URL only?
- **Naming & npm scope** (e.g., `metascan`, `@metascan/preview`).
- **Slugs for unknown sites:** Fallback behavior when no OG/meta tags exist
  (use `<title>` + first paragraph? return partial?).
