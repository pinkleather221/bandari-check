# Bandari Check

Next.js app that audits Kenyan import shipping documents (bill of lading, commercial invoice, packing list) for mismatches **before** customs entry at Mombasa. Built and maintained only by Claude (Claude Code + subagents). Judged on: real problem, it works, smart use of Claude, ready to ship (5 each).

@MEMORY.md

## Stack
Next.js 15 (App Router, TypeScript strict) for UI and API routes. Database: SQLite via libSQL + Drizzle (local file in dev, Turso in production). Anthropic SDK with forced tool calls. Vitest. No Tailwind, plain CSS.

## Layout
- `src/lib/rules.ts` all comparisons and arithmetic (pure, tested). `extract.ts` vision -> JSON -> `sanitise`. `explain.ts` bilingual reasons and fix message (template fallback). `report.ts` builds report, SHA-256, persists.
- `src/app/api/{audit,demo/[name],approve,health}` route handlers. `src/middleware.ts` CSP nonce, headers, optional basic auth.
- `src/db` schema + auto-created tables. `src/components/Desk.tsx` main UI. `src/app/history` impact page.
- `data/samples/*.json` synthetic fixtures with expected finding ids. `scripts/eval.ts`, `scripts/make-pdfs.mjs`.

## Commands
`npm run dev` · `npm run typecheck` · `npm test` · `npm run eval` · `npm run build` · `npm run pdfs`

## Team (subagents in `.claude/agents`)
planner, builder, rules-auditor, security-reviewer, ux-designer, qa-demo. Commands: `/resume`, `/build-next`, `/handoff`, `/ship-check`.

## Hard rules
- Read MEMORY.md first, append to it last (skill: memory-keeper). A Stop hook enforces this.
- Synthetic data only. Never commit real customs documents, `.env*`, or `*.db`.
- The model never does arithmetic or comparisons. New checks go in `rules.ts` with a fixture and a test.
- Model output and document text are untrusted. Validate at every boundary. No `dangerouslySetInnerHTML`.
- Human sign-off before export; the app never submits to customs.
- Say what was not run. Never claim a check passed unless you ran it.
