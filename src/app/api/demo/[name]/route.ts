import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getClient } from "@/lib/anthropic";
import { fail, json } from "@/lib/http";
import { buildReport } from "@/lib/report";
import { clientIp, rateLimit } from "@/lib/security";
import type { Doc } from "@/lib/types";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9_]{1,40}$/.test(name)) return fail(404, "Unknown sample.");
  if (!rateLimit("demo:" + clientIp(req), 20)) return fail(429, "Too many requests. Wait a minute.");
  let docs: Doc[];
  try { docs = JSON.parse(await readFile(join(process.cwd(), "data", "samples", `${name}.json`), "utf8")).docs; }
  catch { return fail(404, "Unknown sample."); }
  return json(await buildReport(docs, "demo", getClient()));
}
