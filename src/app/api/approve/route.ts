import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { audits, events } from "@/db/schema";
import { fail, json } from "@/lib/http";
import { sameOrigin } from "@/lib/security";
export const runtime = "nodejs";

const Body = z.object({ id: z.string().regex(/^[a-f0-9]{10}$/), name: z.string().trim().min(2).max(60) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Cross-site request refused.");
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail(415, "Send application/json.");
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(400, "Enter your name (2 to 60 characters).");
  try {
    const db = await getDb(), now = Date.now();
    const found = await db.select({ id: audits.id }).from(audits).where(eq(audits.id, p.data.id));
    if (!found.length) return fail(404, "Report not found. Run the audit again.");
    const upd = await db.update(audits).set({ status: "approved", approvedBy: p.data.name, approvedAt: now }).where(and(eq(audits.id, p.data.id), eq(audits.status, "draft")));
    if (!upd.rowsAffected) return fail(409, "Already approved");
    await db.insert(events).values({ auditId: p.data.id, at: now, action: "approved", actor: p.data.name, detail: null });
    return json({ ok: true, approvedAt: now });
  } catch (e) { console.error("approve failed", e); return fail(500, "Could not save the approval. Try again."); }
}
