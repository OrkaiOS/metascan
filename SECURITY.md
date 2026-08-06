# Security Policy

## Reporting a vulnerability

Do **not** open a public GitHub issue for security vulnerabilities. Please
report privately using GitHub Security Advisories:

1. Go to **Security → Report a vulnerability** on the repository.
2. Describe the vulnerability, the impact, and (if possible) a minimal
   reproduction.

You will receive an acknowledgement within 5 business days. We ask for
**90 days** of coordinated disclosure before any public discussion so a fix
can be shipped first.

## Scope

This policy covers `@metascan/core`, the `metascan-server` HTTP app, and the
Docker image.

## Known security posture (v1)

- **SSRF:** the fetch layer accepts user-supplied URLs. The v1 posture is
  **basic** — the server is assumed to run on a trusted/internal network, with
  only a scheme allowlist (`http:`/`https:`), a 1500 ms timeout, a 3-redirect
  cap, and a 2 MB body cap. **If you deploy the server internet-facing, this
  posture must be upgraded** (destination IP filtering for private/loopback
  ranges) before use — see the Fetch Safety & Resilience standard in
  `docs/orkai/metascan-skeleton.orkai.jsonl`.
- **No secrets:** metascan performs no authentication and handles no
  credentials or payment data.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅                |
| < 1.0   | ❌ (unreleased)    |
