# Security review, pass 1

Date: 2026-10-31. Reviewer: security-reviewer. Scope: `src/` as found (middleware, api/*, lib/extract, security, report, http, anthropic, explain, db/*, Desk.tsx, history, next.config.ts, layout.tsx). Review only, nothing run. `.env.local` was not read. Installed: next 15.5.28, @anthropic-ai/sdk 0.40.1, @libsql/client 0.14.0.

Owner for every item is **builder** (hand-off via MEMORY.md Next).

Totals: High 4, Medium 7, Low 7, Info 3.

Checked and clean: no `dangerouslySetInnerHTML`, `innerHTML` or `eval` in src; all DB access is Drizzle (parameterised) or static DDL; demo `name` is regex-restricted so no path traversal; uploaded filename is only truncated and displayed as React text, never used as a path; model output is whitelisted and clamped in `sanitise`; secrets are read server-side only; `wa.me` and `mailto:` links use `encodeURIComponent`; `target=_blank` has `noopener`.

## High

### H1. Cost and abuse control is bypassable (spoofed X-Forwarded-For, map reset)
**Status: FIXED 2026-10-31 (partial): IP from x-vercel-forwarded-for/x-real-ip, expired-entry eviction. Still open: global daily cap, in-flight cap; limiter is per instance on Vercel.**
`src/lib/security.ts:11` and `:8`; `src/app/api/audit/route.ts:13`
- `clientIp` trusts the first `x-forwarded-for` value. Any client can send a fresh random value per request and get a fresh bucket. Without a proxy that overwrites the header, the limit does nothing.
- `hits.clear()` at 5000 keys wipes every bucket, so spamming 5000 spoofed IPs resets everyone's limit.
- Each audit can be 5 files, each a Claude vision call plus an explain call, with SDK `maxRetries: 2`. There is no global budget or concurrency cap. Result: unbounded Anthropic spend by an anonymous caller.
- Fix: on Vercel use `x-real-ip` or the platform-provided IP (`request.ip` / last entry of XFF added by the trusted proxy), and ignore client-supplied values; take the right-most trusted hop. Replace `clear()` with evicting only expired keys or LRU. Add a global daily cap (`MAX_AUDITS_PER_DAY`, counted in the DB or Turso) that returns 503 when hit, and a max in-flight counter. Set an Anthropic workspace spend limit as a backstop.

### H2. Auth is fail-open and all state-changing endpoints are anonymous by default
**Status: FIXED 2026-10-31 (partial): production returns 503 without BASIC_AUTH_PASS unless ALLOW_PUBLIC=1 (only /api/health exempt from the 503). Still open: 401 throttling, username check.**
`src/middleware.ts:6-12`; `src/app/api/approve/route.ts`; `src/app/history/page.tsx`
- If `BASIC_AUTH_PASS` is unset (or empty) the whole app, including `/history` (container numbers, approver names) and `/api/approve`, is public. Nothing warns or refuses to start in production.
- Basic auth has no throttling (brute force is free), ignores the username, and the shared password means "approved by" is a self-typed string with no identity.
- `eq` in middleware leaks nothing material, but it returns early on length only after the XOR, which is fine; the real weakness is no lockout.
- Fix: in production (`NODE_ENV === "production"`) return 503 from middleware when `BASIC_AUTH_PASS` is missing, unless an explicit `ALLOW_PUBLIC=1` is set. Rate limit 401 responses per IP. Require a username and compare both. Before any pilot, per-user auth (see SECURITY.md); until then label approval "typed name, not verified" in the UI and the print pack.

### H3. Retention claim is false: purge runs only when someone opens /history
**Status: FIXED 2026-10-31: purgeExpired() (audits + events) runs on persist (throttled 5 min) and on /history. No cron route yet.**
`src/app/history/page.tsx:13`; `src/lib/report.ts:29`; `src/db/index.ts:12`
- SECURITY.md and the UI promise deletion after `RETENTION_DAYS`. The only `DELETE` is inside the History page render. If nobody visits it, shipper/consignee names, container numbers and the full `report_json` stay forever.
- The `events` table (actor names, audit ids) is never purged, even when its audit is deleted, so approver names outlive the data.
- Fix: move purge to a function `purgeExpired()` called from `persist()` (cheap, once per N minutes) and from a Vercel Cron route protected by a secret; delete matching `events` rows in the same batch. Show the actual retention in the UI from one source of truth. Until fixed, do not state the retention guarantee in the demo.

### H4. CSRF on POST endpoints (cookie-less basic auth is sent cross-site)
**Status: FIXED 2026-10-31: Origin must match host on POST /api/audit and /api/approve (403); approve requires application/json (415).**
`src/app/api/approve/route.ts:11`; `src/app/api/audit/route.ts:16`
- No Origin, Sec-Fetch-Site or content-type check. When basic auth is on, browsers attach credentials to cross-site requests, so a hostile page can post a `text/plain` form whose body is valid JSON to `/api/approve` (since `req.json()` ignores content type) or a multipart form to `/api/audit` to burn quota.
- Fix: in a shared helper, reject unless `Origin` host equals `Host` (or `Sec-Fetch-Site` is `same-origin`/`none`); in approve require `Content-Type: application/json`. Apply to both POST routes.

## Medium

### M1. Approval is not bound to the report and can be repeated or overwritten
**Status: PARTIAL 2026-10-31: approve updates only where status='draft', 409 "Already approved" otherwise. Still open: approve rate limit, transaction, 128-bit ids.**
`src/app/api/approve/route.ts:15-18`
- Any caller who knows a 10-hex id (40 bits, no rate limit on this route) can approve it. A second call silently replaces `approvedBy`/`approvedAt`. The select-then-update-then-insert is not atomic and approval does not store or check the report `sha256`.
- Fix: add `rateLimit("approve:"+ip, 10)`; update with `where id = ? and status = 'draft'` and check affected rows, return 409 if already approved; wrap update and event insert in `db.batch`/transaction; record `sha256` in the event `detail`; use a full 128-bit id (`randomUUID()`) for report ids.

### M2. Upload size is enforced after the whole body is buffered
`src/app/api/audit/route.ts:14-22`
- The only pre-parse guard trusts `Content-Length` (absent with chunked encoding). `req.formData()` buffers the entire body in memory before `f.size` is checked. Memory DoS on a small instance.
- Fix: if `content-length` is missing return 411; additionally stream-count bytes (read `req.body` with a cap) or set host-level body limit; keep the per-file check. Also cap total decoded bytes.

### M3. Second-hop prompt injection and message poisoning through extracted strings
`src/lib/extract.ts:37,48`; `src/lib/explain.ts:33-34,48`; `src/lib/rules.ts` (INJECTION_ATTEMPT)
- Extracted strings (up to 160 chars, any characters including newlines and bidi controls) flow into finding `detail`/`evidence`, then into the explain prompt and into the template supplier message. A document can plant text such as a fake extra line or a link in the message the agent sends to a supplier. The explain output (`message_en/sw`) is free text, not checked.
- `suspicious_text` is self-reported by the same model that is being attacked, so a good injection can suppress it. It is only a `warn`, not a blocker.
- Fix: in `str()` strip control characters (`\p{C}` except space), bidi overrides, collapse whitespace, and for fields like container_no, hs_code, currency, doc_date apply format regexes (ISO 6346 shape, 3-letter currency, date) and drop non-matching values with a finding. Validate the explain tool result with zod (`why` is array, ids known, strings only). Reject or strip URLs/phone numbers in model-written messages. Add a deterministic injection scan in code (regex for "ignore previous", "approve", "system prompt") over every extracted string and escalate `INJECTION_ATTEMPT` to blocker when either signal fires. Keep human edit and review of the message (already present).

### M4. Demo endpoint spends live tokens and pollutes real stats
`src/app/api/demo/[name]/route.ts:17`; `src/lib/report.ts:12,19`
- With a key set, every sample click calls Claude (explain step) and writes a row. Limit is 20/min/IP (spoofable per H1). Demo rows count in the "Audits run" and "Demurrage exposure flagged" KPIs on /history, which are shown as impact, so the metric can be inflated by anyone.
- Fix: pass `null` client for demo mode (template messages, or cache per sample); do not persist demo reports, or exclude `mode='demo'` in the KPI queries.

### M5. No HSTS and missing hardening headers
`src/middleware.ts:24-27`
- No `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. The 401 response also carries none of the headers. CSP lacks `upgrade-insecure-requests`. Basic auth credentials travel in cleartext over HTTP unless HSTS or HTTPS redirect exists.
- Fix: add `Strict-Transport-Security: max-age=63072000; includeSubDomains` (prod only), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `upgrade-insecure-requests` in prod; factor headers into a function applied to the 401 too.

### M6. Large or hostile PDFs reach the model unchecked; one failure leaves siblings running
`src/lib/security.ts:15-20`; `src/app/api/audit/route.ts:29`
- Sniffing checks only the leading bytes. An 8 MB PDF can be hundreds of pages (vision tokens, cost) or malformed. `Promise.all` rejects on first failure but the other calls keep running and billing. Client timeout 90 s with 2 retries exceeds `maxDuration` 60 s, so the function can be killed mid-call and retried by the client.
- Fix: cap PDF page count (parse `/Count` or use pdf-lib in a try) and image dimensions; use `Promise.allSettled`; set SDK timeout below `maxDuration` (for example 45 s, `maxRetries: 1`) or raise `maxDuration`; pass `max_tokens` already limited, keep.

### M7. Approval gate is client-side only; export paths are open without sign-off
`src/components/Desk.tsx:56-62,157-159`
- The checkbox and name gate are UI only; the API accepts any name. Copy, WhatsApp, email and print can all be done without approving, and the print pack is whatever the client holds. CLAUDE.md requires human sign-off before export.
- Fix: serve the clearance pack from a server route that returns 403 unless `status='approved'` (render approver, time, sha256 from DB); until then, disable copy/send buttons when unapproved or label the output "DRAFT, not approved".

## Low

### L1. Report hash gives no tamper protection
`src/lib/report.ts:17` - unkeyed SHA-256 over `JSON.stringify(body)`; anyone with DB or client access can recompute it, and there is no verify endpoint. Fix: HMAC with a server secret and add `GET /api/verify/:id` recomputing from the stored row; or describe it as a checksum, not tamper-proofing.

### L2. Health endpoint discloses configuration
`src/app/api/health/route.ts:8` - reports `live` (key configured) and `db` state publicly if auth is off. Fix: return `{ok:true}` only, or gate detail behind auth.

### L3. Sensitive data in the report row and logs
`src/lib/report.ts:29`, `src/app/history/page.tsx:20`, `approve/route.ts:20` - `console.error(e)` logs full SDK/DB error objects (may contain request metadata); `report_json` stores full extracted shipper/consignee data (commercially sensitive, possibly personal data under the Kenya DPA). Fix: log `e.message` and a ref id only; document the stored fields; consider storing only fields needed for the history table plus encrypted report body.

### L4. `.gitignore` gaps
**Status: FIXED 2026-10-31: .gitignore covers .env*, db sidecars, .vercel, data/pdf, *.tsbuildinfo.**
`.gitignore` ignores `.env` and `.env.local` only, but CLAUDE.md promises `.env*`; SQLite sidecar files `*.db-wal`, `*.db-shm` and `data/*.db` variants are not covered (only `*.db`, `*.db-journal`). Fix: add `.env*` with `!.env.example`, `*.db-wal`, `*.db-shm`, `*.sqlite*`.

### L5. Default DB path is writable app-relative file
**Status: PARTIAL 2026-10-31: Vercel without DATABASE_URL falls back to /tmp with a warning. Persist failure is still silent.**
`src/db/index.ts:20` - `file:./data/bandari.db` default; on serverless the filesystem is ephemeral or read-only, so persistence fails silently (`persist` swallows the error) while the UI shows a "saved" approval flow that returns 404 on approve. Fix: in production require `DATABASE_URL` and fail loudly; make `persist` failure visible (flag in the response such as `saved:false`) so approve is disabled.

### L6. Dependency ranges are loose
`package.json` uses `^15.1.0` for next. Middleware auth bypass CVE-2025-29927 affected next below 15.2.3; installed 15.5.28 is fine, but the range allows a vulnerable resolution on a fresh lockless install. Fix: set `"next": "^15.5.0"` (or later patched), keep the lockfile committed, run `npm audit` in CI, and add a defence-in-depth auth check in the route handlers (not only middleware) via a shared `requireAuth(req)`.

### L7. Filename and name fields lack normalisation
`src/app/api/audit/route.ts:21`, `src/lib/extract.ts:53`, `approve/route.ts:8` - control characters and bidi marks are kept in filenames and approver names (rendered as React text, so no XSS, but they can spoof the printed clearance pack). Fix: strip `\p{C}` and bidi characters; restrict the approver name to letters, spaces, `.'-`.

## Info

- I1. CSP is sound for scripts: nonce plus `strict-dynamic`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`; `layout.tsx` sets `force-dynamic` so nonces apply. Known trade-off `style-src 'unsafe-inline'` accepted. `page.tsx` is covered by the root layout `force-dynamic`; confirm in the first build that no route is statically prerendered (a static page would load scripts without the nonce and break under CSP).
- I2. `connect-src 'self'` correctly blocks exfiltration from any injected script; keep it.
- I3. `next.config.ts` `serverActions.bodySizeLimit` is irrelevant (no server actions); API route body limits must be enforced in code (see M2).

## Suggested order for builder
H1, H2, H4 (one shared `guard(req)` helper: auth check, origin check, rate limit), then H3 and M1, then M3, M4, M7, then the rest.
