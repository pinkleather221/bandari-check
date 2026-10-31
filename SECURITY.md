# Security model

| Threat | Control | Where |
|---|---|---|
| Leaked API key | Server env only; `.env*` ignored by git and denied to the agent | `src/lib/anthropic.ts`, `.claude/settings.json` |
| Malicious upload | Streamed byte cap, size cap, magic-byte sniffing (PDF/PNG/JPEG), PDF page and image pixel caps, max 5 files, filename cleaned and never used as a path | `src/lib/security.ts`, `api/audit` |
| Abuse and cost | Per-IP rate limit, global daily cap and in-flight cap on live audits (`AUDIT_DAILY_CAP`, `MAX_INFLIGHT`), all per process; set an Anthropic workspace spend limit as the real backstop | `src/lib/security.ts` |
| Prompt injection | Documents are data; forced tool call; whitelist, clamp and strip control/bidi characters; field format gates; code-side injection regex (blocker); explain step sees findings only and its output is scrubbed of links and numbers | `extract.ts`, `explain.ts`, `rules.ts` |
| Model mistakes | All maths in code; per-field confidence; human sign-off recorded in the audit trail | `rules.ts`, `api/approve` |
| XSS | React text rendering only; nonce-based CSP with `strict-dynamic`; `frame-ancestors 'none'` | `src/middleware.ts` |
| Unauthorised access | HTTP basic auth for the whole app via `BASIC_AUTH_PASS` (optional `BASIC_AUTH_USER`); failed attempts throttled per IP (5 per 15 min) | `src/middleware.ts` |
| Data retention | Uploaded files never stored; reports purged after `RETENTION_DAYS`; no-store on API | `report.ts`, `history/page.tsx` |
| SQL injection | Drizzle parameterised queries only | `src/db` |
| Error leakage | Clients get a short reference id; stack traces stay in server logs | route handlers |
| Report integrity | SHA-256 checksum over the report body, shown on the clearance pack. It is a checksum, not tamper-proofing (unkeyed) | `report.ts` |

Approval: `/api/approve` is rate limited, accepts a 128-bit report id and a letters-only name, and approves once, in a transaction. The supplier correction message stays usable before sign-off on purpose; the printed clearance pack is marked DRAFT until approved. Approval records a typed name, not a verified identity.

Known trade-offs: `style-src 'unsafe-inline'` (Next injects inline styles); the rate limiter, the daily cap, the in-flight cap and the login throttle are per process (on Vercel, per instance, so they are soft limits); client IP prefers `x-vercel-forwarded-for`, then `x-real-ip`; `x-forwarded-for` is only trustworthy behind your own proxy. Production fails closed (503) without `BASIC_AUTH_PASS` unless `ALLOW_PUBLIC=1`. POST routes reject a mismatched `Origin`.

## Before a real pilot
HTTPS, real auth (SSO or magic link) with per-user quotas, Kenya Data Protection Act review and processor terms, structured audit logging, an independent review (run the `security-reviewer` subagent, then a human).

## Reporting a vulnerability
Please do not open a public issue. Use GitHub's private reporting: the **Security** tab of this repository, then **Report a vulnerability**. Include steps to reproduce and use synthetic data only.

## Known issues
- Dependencies: `npm audit --omit=dev` reports 0 known vulnerabilities (PostCSS is pinned to a patched version through `overrides` in package.json).
- Open and accepted items from the first review (all High and Medium closed) are listed in [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).
