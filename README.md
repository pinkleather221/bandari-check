# Bandari Check

**Catch paperwork errors before the port does.**

Bandari Check audits the import documents for a shipment into Kenya (bill of lading, commercial invoice and packing list) and finds mismatches **before** the entry is lodged with customs at Mombasa.

## The problem

Clearing agents at Mombasa handle many containers a week. A single mismatch between documents can get an entry queried or held, such as:

- a mistyped container number
- gross weights that disagree
- an invoice total that doesn't add up
- a misspelled consignee
- different HS codes on different papers

While the paperwork is corrected, the container sits in port and demurrage and storage charges build up. Today these errors are usually found by eye, late, or by the port itself.

## What it does

Upload the documents (PDF, PNG or JPEG, up to 5 files of 8 MB each) and get:

- **A verdict:** *Clear to lodge*, *Check before lodging* or *Do not lodge*, with a readiness score out of 100.
- **Every mismatch traced** to its document and field. Selecting a finding highlights the fields involved on the document sheets.
- **A demurrage estimate** (days at risk × USD per day). The default rate is a placeholder, so set your own.
- **A correction message** for the supplier, in English or Kiswahili, ready to copy, send on WhatsApp or send by email.
- **A human sign-off.** An agent confirms they compared the report with the originals before the clearance pack is printed.
- **An Impact page** with audits run, blockers caught and the sign-off trail.

More than a dozen checks cover container check digits, party names, weights, package counts, invoice arithmetic, HS codes, dates and port of discharge. See [src/lib/rules.ts](src/lib/rules.ts).

The app is decision support only. It never submits anything to customs.

## How Claude is used

| Step | Who does it |
|---|---|
| Read scanned documents into structured fields | Claude (vision), with a forced tool call so the output is JSON in a fixed schema |
| Flag fields it couldn't read clearly | Claude reports a confidence per field; low-confidence fields are flagged, not guessed |
| All comparisons and arithmetic | **Plain, tested TypeScript, never the model** |
| Explain findings and draft the supplier message | Claude, from the findings only (never the raw documents), with a template fallback |

Documents are treated as untrusted input. Model output is validated and clamped before use, and text that looks like instructions aimed at an AI is flagged as a finding.

## Quick start

Developed and tested on Node 24 (Next.js 15 needs Node 18.18 or newer).

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY for live document reading
npm run dev                     # http://localhost:3000
```

**No API key?** Pick a sample shipment and click **Run sample**. This uses the rules engine and template explanations and needs no key. Uploading your own documents does need `ANTHROPIC_API_KEY`.

The local SQLite database is created automatically at `data/bandari.db`.

### Configuration

| Variable | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Enables live document reading | none |
| `CLAUDE_MODEL` | Model used for reading and drafting | `claude-sonnet-5-5` |
| `DATABASE_URL` | libSQL URL (`file:` locally, `libsql://` on Turso) | `file:./data/bandari.db` |
| `DATABASE_AUTH_TOKEN` | Turso auth token | none |
| `BASIC_AUTH_PASS` | Password for the whole app (any username) | none |
| `ALLOW_PUBLIC` | Set to `1` to allow production without a password | none |
| `DEMURRAGE_USD_PER_DAY` | Rate used for the exposure estimate | `75` |
| `AUDIT_RATE_PER_MIN` | Audits per minute per client | `6` |
| `MAX_FILE_MB` | Max size per uploaded file | `8` |
| `RETENTION_DAYS` | Reports are deleted after this many days | `30` |

## Testing

```bash
npm run typecheck
npm test            # unit tests (Vitest)
npm run eval        # seeded-error evaluation on synthetic shipments
npm run build
npm run pdfs        # generate synthetic PDFs in data/pdf/ to try live uploads
```

`npm run eval` runs the rules engine over four synthetic shipments with planted errors. It currently catches 8 of 8 seeded errors with 0 false positives. The shipments are synthetic, so this measures the rules, not accuracy on real scans.

## Deploy to Vercel

1. Import the repo in Vercel (framework: Next.js).
2. Create a Turso database:
   ```bash
   turso db create bandari-check
   turso db show bandari-check --url
   turso db tokens create bandari-check
   ```
3. Set environment variables: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and either `BASIC_AUTH_PASS` or `ALLOW_PUBLIC=1`. In production the app returns 503 until one of those two is set.
4. Deploy.

Notes:
- Without `DATABASE_URL`, Vercel uses `/tmp/bandari.db`, so history is lost between instances and deploys.
- `/api/audit` allows up to 60 seconds. Check that your Vercel plan's function duration limit allows this.
- The rate limiter is in memory and per instance. Set a spend limit in your Anthropic account as a backstop.

## Project layout

```
src/lib/rules.ts       all comparisons and arithmetic (pure, tested)
src/lib/extract.ts     document -> JSON via Claude, then sanitised
src/lib/explain.ts     bilingual explanations and the supplier message
src/lib/report.ts      builds, hashes and saves the report
src/app/api/           audit, demo, approve and health routes
src/middleware.ts      CSP nonce, security headers, optional basic auth
src/components/Desk.tsx  main UI
data/samples/          synthetic shipments with expected findings
```

Stack: Next.js 15 (App Router, TypeScript), Drizzle ORM with libSQL/SQLite, the Anthropic SDK, Vitest. Plain CSS, no Tailwind.

## Status

This is an early build. Be aware of the following:

- **Live reading of real scans is not yet validated.** Extraction accuracy on real documents has not been measured.
- All sample data is synthetic. Never commit real customs documents.
- A first security review is in [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md). Some items are fixed and some are still open.
- Run it behind `BASIC_AUTH_PASS` if you deploy it.

See [SECURITY.md](SECURITY.md) for the security design.

## Built with Claude Code

This project was built with Claude Code, using subagents defined in [.claude/agents](.claude/agents) (planner, builder, rules-auditor, security-reviewer, ux-designer, qa-demo) that coordinate through [MEMORY.md](MEMORY.md).

## Disclaimer

Decision support only. Bandari Check does not give legal or customs advice. A licensed clearing agent decides what to lodge.
