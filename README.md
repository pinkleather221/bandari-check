# Bandari Check

Catch paperwork errors before the port does. Upload a bill of lading, invoice and packing list; get a go / no-go verdict, every mismatch traced to its document and field, demurrage exposure, and a ready-to-send fix message in English and Kiswahili.

## Run it
```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY for live reading
npm run dev                    # http://localhost:3000
```
No key? "Run sample" still works. The SQLite file is created automatically at `data/bandari.db`.

## Verify
```bash
npm run typecheck && npm test && npm run eval && npm run build
npm run pdfs                   # synthetic PDFs in data/pdf/ for the live demo
```

## Deploy to Vercel
1. Import the repo in Vercel (framework: Next.js, Node runtime).
2. Create a Turso database: `turso db create bandari-check`, `turso db show bandari-check --url`, `turso db tokens create bandari-check`.
3. Set env vars: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `DATABASE_URL` (libsql://...), `DATABASE_AUTH_TOKEN`, and either `BASIC_AUTH_PASS` or `ALLOW_PUBLIC=1` for a public demo (production returns 503 otherwise). `DEMURRAGE_USD_PER_DAY`, `AUDIT_RATE_PER_MIN`, `MAX_FILE_MB`, `RETENTION_DAYS` are optional.
4. Without `DATABASE_URL` the app uses `/tmp/bandari.db` on Vercel: history is lost between instances and deploys.

Notes: `/api/audit` sets `maxDuration = 60`; check your Vercel plan's function duration limit allows it. The in-memory rate limiter is per instance, so the effective limit grows with concurrency; set an Anthropic spend limit as a backstop.

## Building with Claude Code
Open the folder in Claude Code. `CLAUDE.md` loads `MEMORY.md`; a SessionStart hook prints it and a Stop hook refuses to end a turn until it is updated. Start with `/resume`, then `/build-next`. Subagents: planner, builder, rules-auditor, security-reviewer, ux-designer, qa-demo. Finish with `/ship-check`.

## Why SQLite/libSQL
Zero setup for the demo, one file locally, and the same code runs on Turso in production. Data is small and relational (audits, audit trail), so no server database is needed yet. Move to Postgres when multi-tenant analytics are required.

Synthetic data only. Decision support, not legal or customs advice.
