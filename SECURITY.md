# Security model

| Threat | Control | Where |
|---|---|---|
| Leaked API key | Server env only; `.env*` ignored by git and denied to the agent | `src/lib/anthropic.ts`, `.claude/settings.json` |
| Malicious upload | Size cap, magic-byte sniffing (PDF/PNG/JPEG), max 5 files, filename never used as a path | `src/lib/security.ts`, `api/audit` |
| Abuse and cost | Per-IP rate limit; move to Redis/Turso for multi-instance | `src/lib/security.ts` |
| Prompt injection | Documents are data; forced tool call; whitelist+clamp; explain step sees findings only; `suspicious_text` tripwire | `extract.ts`, `explain.ts`, `rules.ts` |
| Model mistakes | All maths in code; per-field confidence; human sign-off recorded in the audit trail | `rules.ts`, `api/approve` |
| XSS | React text rendering only; nonce-based CSP with `strict-dynamic`; `frame-ancestors 'none'` | `src/middleware.ts` |
| Unauthorised access | Optional HTTP basic auth for the whole app via `BASIC_AUTH_PASS` | `src/middleware.ts` |
| Data retention | Uploaded files never stored; reports purged after `RETENTION_DAYS`; no-store on API | `report.ts`, `history/page.tsx` |
| SQL injection | Drizzle parameterised queries only | `src/db` |
| Error leakage | Clients get a short reference id; stack traces stay in server logs | route handlers |
| Report tampering | SHA-256 over the report body, shown on the clearance pack | `report.ts` |

Known trade-offs: `style-src 'unsafe-inline'` (Next injects inline styles); the rate limiter is per process (on Vercel, per instance, so it is a soft limit); client IP prefers `x-vercel-forwarded-for`, then `x-real-ip`; `x-forwarded-for` is only trustworthy behind your own proxy. Production fails closed (503) without `BASIC_AUTH_PASS` unless `ALLOW_PUBLIC=1`. POST routes reject a mismatched `Origin`.

## Before a real pilot
HTTPS, real auth (SSO or magic link) with per-user quotas, Kenya Data Protection Act review and processor terms, structured audit logging, an independent review (run the `security-reviewer` subagent, then a human).
