import { createHash, randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { getDb, purgeExpired } from "@/db";
import { audits, events } from "@/db/schema";
import { compose } from "./explain";
import { run, score } from "./rules";
import type { Doc, Report } from "./types";

export async function buildReport(documents: Doc[], mode: "live" | "demo", client: Anthropic | null): Promise<Report> {
  const findings = run(documents);
  const sc = score(findings);
  const messages = await compose(client, findings, documents);
  const counts = { blocker: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const body = { report_id: randomUUID().replace(/-/g, "").slice(0, 10), generated_at: new Date().toISOString().slice(0, 19) + "Z", mode,
    documents, findings, counts, ...sc, messages, notice: "Decision support only. A licensed agent must verify against the original documents before lodging." };
  const sha256 = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const report: Report = { ...body, sha256 };
  await persist(report).catch((e) => console.error("persist failed", e)); // the audit still returns if the DB is down
  return report;
}

async function persist(r: Report) {
  const db = await getDb();
  const now = Date.now();
  await purgeExpired().catch((e) => console.error("purge failed", e instanceof Error ? e.message : e));
  await db.insert(audits).values({
    id: r.report_id, createdAt: now, mode: r.mode, verdict: r.verdict, score: r.score, blockers: r.counts.blocker, warns: r.counts.warn,
    infos: r.counts.info, containerNo: String(r.documents.map((d) => d.fields.container_no?.value).find(Boolean) ?? "") || null,
    exposureUsd: r.demurrage.usd_exposure, sha256: r.sha256, reportJson: JSON.stringify(r),
  });
  await db.insert(events).values({ auditId: r.report_id, at: now, action: "created", actor: "system", detail: `${r.mode}:${r.verdict}` });
}
