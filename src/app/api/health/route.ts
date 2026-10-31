import { getClient } from "@/lib/anthropic";
import { json } from "@/lib/http";
import { getDb } from "@/db";
export const runtime = "nodejs";
export async function GET() {
  let db = true;
  try { await getDb(); } catch { db = false; }
  return json({ ok: true, live: getClient() !== null, db });
}
