import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { inArray, lt } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";

// SQLite via libSQL: a local file in dev, Turso (hosted, edge-replicated) in production. Same code, no server to run.
const DDL = `
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, mode TEXT NOT NULL, verdict TEXT NOT NULL, score INTEGER NOT NULL,
  blockers INTEGER NOT NULL, warns INTEGER NOT NULL, infos INTEGER NOT NULL, container_no TEXT, exposure_usd INTEGER NOT NULL,
  sha256 TEXT NOT NULL, report_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', approved_by TEXT, approved_at INTEGER);
CREATE INDEX IF NOT EXISTS audits_created ON audits(created_at);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, audit_id TEXT NOT NULL, at INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS events_audit ON events(audit_id);`;

const g = globalThis as unknown as { __bcPurge?: number; __bc?: { db: ReturnType<typeof drizzle<typeof schema>>; ready: Promise<unknown> } };

// Vercel's filesystem is read-only except /tmp: without DATABASE_URL (Turso) history there is ephemeral.
function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VERCEL) { console.warn("DATABASE_URL is unset: using /tmp/bandari.db, history is ephemeral. Set a Turso URL."); return "file:/tmp/bandari.db"; }
  try { mkdirSync("data", { recursive: true }); } catch { /* read-only fs: libsql will report it */ }
  return "file:./data/bandari.db";
}

export async function getDb() {
  if (!g.__bc) {
    const client = createClient({ url: dbUrl(), authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
    g.__bc = { db: drizzle(client, { schema }), ready: client.executeMultiple(DDL) };
  }
  await g.__bc.ready;
  return g.__bc.db;
}

// Delete audits older than RETENTION_DAYS and their events. Throttled to once per 5 min per process unless forced.
export async function purgeExpired(force = false) {
  const now = Date.now();
  if (!force && now - (g.__bcPurge ?? 0) < 300_000) return;
  g.__bcPurge = now;
  const db = await getDb();
  const cutoff = now - (Number(process.env.RETENTION_DAYS ?? 30) || 30) * 86_400_000;
  const old = db.select({ id: schema.audits.id }).from(schema.audits).where(lt(schema.audits.createdAt, cutoff));
  await db.delete(schema.events).where(inArray(schema.events.auditId, old));
  await db.delete(schema.audits).where(lt(schema.audits.createdAt, cutoff));
}
