# 3-minute demo and scoring map

## Before you go on
1. `npm run pdfs` then keep `data/pdf/set3_errors_*.pdf` in one folder.
2. `npm run build && npm start`. Run one live audit to warm up. Record a backup video.
3. Fallback: "Run sample" works with no Claude key (rules engine and templates).

## Script
| Time | Say / do |
|---|---|
| 0:00 | "Juma clears 12 containers a week at Mombasa. One typo on a bill of lading can mean days of demurrage." Add one real cost figure you verified. |
| 0:30 | Drag in the 3 PDFs. Narrate the progress text. The stamp slams: **Do not lodge**. |
| 1:00 | Click each finding: weight 18,450 vs 19,450 kg; invoice total off by 900; consignee typo; HS 8517 vs 8471. Fields light up in the sheets. Point at the dashed underline: the smudged package count was flagged, not guessed. |
| 1:45 | "Smart use of Claude": vision on messy scans, forced structured output, maths done in code (ISO 6346, sums, tolerances), confidence flags, injection tripwire, bilingual drafting. Switch to Kiswahili, hit WhatsApp. |
| 2:15 | `npm run eval`: "8 of 8 seeded errors, 0 false positives." Tick the sign-off, approve, open the Impact page: the audit trail is in the database. |
| 2:45 | "Built end to end by a team of Claude agents coordinated through one MEMORY.md." Show `.claude/agents` and the log. Ask: pilot with three clearing firms. |

## Rubric map (aim 20/20)
- **Real problem:** named persona, one verified cost figure, Mombasa-specific, bilingual.
- **It works:** live upload end to end, planted errors caught, offline fallback, eval number on screen.
- **Smart use of Claude:** vision + tool-forced JSON + code-side maths + explanations + EN/SW drafting + injection defense, plus Skills, subagents, hooks and a shared memory file as the build process itself.
- **Ship-ready:** SECURITY.md, CSP, rate limit, auth switch, DB with retention, sign-off audit trail, tests, eval, integrity hash, pilot plan.

## Likely questions
- *Bad scan?* Low confidence is flagged and listed; nothing is guessed.
- *Hidden instructions in a PDF?* Sample set 4 shows the tripwire.
- *Does it replace the agent?* No. Sign-off is required; it never submits to customs.
