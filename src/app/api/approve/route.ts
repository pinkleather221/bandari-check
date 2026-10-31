import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audits, events } from "@/db/schema";
import { fail, json } from "@/lib/http";
import { clean, clientIp, rateLimit, REPORT_ID, sameOrigin } from "@/lib/security";
export const runtime = "nodejs";

// Report id is 128-bit hex (see REPORT_ID); approver name is letters, spaces and . ' - only (no control or bidi characters).
const ID = REPORT_ID;
const Body = z.object({ id: z.string().regex(ID), name: z.string().transform((s) => clean(s, 60)).pipe(z.string().min(2).regex(/^\p{L}[\p{L} .'-]*$/u)) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Cross-site request refused.");
  if (!rateLimit("approve:" + clientIp(req), 10)) return fail(429, "Too many requests. Wait a minute.");
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail(415, "Send application/json.");
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(400, "Enter your name (2 to 60 letters, spaces, . ' -).");
  try {
    const db = await getDb(), now = Date.now();
    const [found] = await db.select({ sha: audits.sha256 }).from(audits).where(eq(audits.id, p.data.id));
    if (!found) return fail(404, "Report not found. Run the audit again.");
    // Update and audit-trail row commit together or not at all; the where-clause makes a second approval a no-op.
    const done = await db.transaction(async (tx) => {
      const upd = await tx.update(audits).set({ status: "approved", approvedBy: p.data.name, approvedAt: now }).where(and(eq(audits.id, p.data.id), eq(audits.status, "draft")));
      if (!upd.rowsAffected) return false;
      await tx.insert(events).values({ auditId: p.data.id, at: now, action: "approved", actor: p.data.name, detail: `sha256:${found.sha}` });
      return true;
    });
    if (!done) return fail(409, "Already approved");
    return json({ ok: true, approvedAt: now });
  } catch (e) { console.error("approve failed", e instanceof Error ? e.message : "error"); return fail(500, "Could not save the approval. Try again."); }
}
