# MEMORY.md: shared project memory (read first, append last)

## Status
- `npm install`, `typecheck`, `npm test` (7/7), `npm run eval` (8/8 seeded errors, 0 false positives) and `npm run build` all pass (2026-10-31).
- `npm run dev` smoke test OK: `/` 200, `/history` 200, `/api/health` 200 (`live:false,db:true`), `/api/demo/set3_errors` 200 with bilingual findings. Demo flow works with no ANTHROPIC_API_KEY (template fallback); `/api/audit` returns 503 without a key.
- 2026-10-31 (builder, Vercel pass): typecheck, vitest 9/9, eval 8/8, build all pass. H1-H4 fixed (H1/H2 partly), M1 partly, L4 fixed.
- NOT yet run: live Claude extraction/explanation (no key tested), `npm run pdfs`, browser UI check, `/api/approve` and `/api/audit` upload path.
- `npm audit` reports 13 vulns (incl. zod <4.6.6, drizzle-orm <0.45.2, next-related postcss); not yet triaged or upgraded.

## Decisions
- Next.js 15 App Router for UI and API (one deployable). Plain CSS, no Tailwind.
- DB: SQLite via libSQL + Drizzle. Local file in dev, Turso in prod. Tables auto-created in `src/db/index.ts`. Files never stored; reports purged after RETENTION_DAYS.
- All arithmetic and comparisons live in `rules.ts`. Model output is forced-tool JSON, then `sanitise`.
- Documents are untrusted: `suspicious_text` tripwire; explain step sees findings only.
- Optional basic auth via BASIC_AUTH_PASS. Human sign-off recorded via `/api/approve`.
- Claude-only build: subagents in `.claude/agents`, skills in `.claude/skills`, hooks enforce MEMORY.md upkeep.

## Open questions
- A verified real demurrage figure (USD per container per day) for the pitch; current 75 is a placeholder.
- Which shipping line tariff to cite? Ask a clearing agent.
- Does `claude-sonnet-5-5` accept PDF document blocks with forced tool_choice as written? Confirm on first live run.

## Next
1. qa-demo: `npm run pdfs`, then a live audit of the set3 PDFs with a real key; record extraction accuracy; test `/api/approve`.
2. builder: remaining from docs/SECURITY_REVIEW.md: H1 global daily cap, H2 401 throttling, M1 rest, M3, M7. Deploy to Vercel with Turso and verify (not yet deployed).
3. builder: triage `npm audit` (zod 3->4 and drizzle-orm bump need code review; do not `--force` blindly).
4. ux-designer: check mobile layout, print pack, Swahili wording.
5. rules-auditor: add 2 more rules (e.g. incoterm vs freight, duplicate invoice numbers) with fixtures.

## Log
### 2026-10-31 · initial scaffold (single session, Claude)
- Did: created the full repo: rules.ts (+fixtures, eval, tests), extract/explain/report libs, db schema, 4 route handlers, middleware, Desk UI, history page, 6 subagents, 3 skills, 4 commands, hooks.
- Why: pivot from Python/FastAPI to Next.js full stack with a database and a Claude-only agent workflow.
- Verified: rules eval 8/8, 0 false positives (Node strip-types). Not verified: everything else listed under Status.
- Next: builder runs install, typecheck, build.

### 2026-10-31 16:40 · builder
- Did: ran install/typecheck/test/eval/build/dev smoke; all passed first time with no code fixes. Only change: `next.config.ts` adds `outputFileTracingRoot` (silences the multi-lockfile root warning caused by a stray package-lock.json in the parent folder).
- Why: warning could mis-trace files for deploys; stray parent lockfile left in place (outside project).
- Verified: typecheck 0 errors; vitest 7/7; eval 8/8, 0 FP; build ok; dev `/`, `/history`, `/api/health`, `/api/demo/set3_errors` all 200, dev server killed afterwards. Not verified: live Claude calls, upload path, approve route, pdfs script, browser rendering, npm audit fixes.
- Next: qa-demo with a real key; builder triages npm audit.

### 2026-10-31 · security-reviewer (first pass)
- Did: reviewed src/; wrote docs/SECURITY_REVIEW.md: 4 High, 7 Medium, 7 Low, 3 Info, all owned by builder. No code changed.
- Clean: no dangerouslySetInnerHTML/innerHTML/eval; Drizzle-only SQL; demo name regex-restricted; sanitise whitelists model output; CSP nonce sound.
- Not verified: findings are from reading code, none exploited or tested.
- Next: builder fixes H1-H4.

### 2026-10-31 � builder (Vercel readiness + security H1-H4)
- Did: db/index.ts (Turso via env, /tmp fallback on VERCEL with warn, mkdir data, shared `purgeExpired` for audits+events); next.config outputFileTracingIncludes for data/samples; middleware 503 fail-closed in prod (ALLOW_PUBLIC=1 override, /api/health exempt); security.ts clientIp header order, expired-entry eviction, `sameOrigin`; audit/approve origin check, approve 415 + 409 on re-approve; purge on persist; .gitignore, .env.example, README Deploy section, SECURITY.md note; tests/security.test.ts.
- Why: clean Vercel deploy and close the High findings.
- Verified: typecheck, vitest 9/9, eval 8/8 (0 FP), build ok. Not verified: actual Vercel/Turso deploy, purge and 409 paths against a live DB, middleware 503 at runtime, tracing of samples in the deployed bundle.
- Next: deploy, then qa-demo; remaining items in Next.
