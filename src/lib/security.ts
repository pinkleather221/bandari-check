// Per-process limiter. For multi-instance deployments move this to Redis/Turso (see SECURITY.md).
const hits = new Map<string, number[]>();
// Drop expired buckets first; only if still over the cap drop the oldest-inserted keys.
function evict(now: number) {
  for (const [k, q] of hits) if (!q.length || now - q[q.length - 1] >= 60_000) hits.delete(k);
  for (const k of hits.keys()) { if (hits.size <= 5000) break; hits.delete(k); }
}
export function rateLimit(key: string, max = Number(process.env.AUDIT_RATE_PER_MIN ?? 6) || 6): boolean {
  const now = Date.now();
  const q = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (q.length >= max) { hits.set(key, q); return false; }
  q.push(now); hits.set(key, q);
  if (hits.size > 5000) evict(now);
  return true;
}
// Prefer headers the platform sets itself (Vercel overwrites x-vercel-forwarded-for / x-real-ip); XFF is only a fallback.
export const clientIp = (req: Request) => {
  const h = req.headers;
  return h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
};
// Reject cross-site POSTs: Origin, when present, must match the request host.
export function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(o).host === host; } catch { return false; }
}
export const MAX_BYTES = (Number(process.env.MAX_FILE_MB ?? 8) || 8) * 1024 * 1024;

export type Mime = "application/pdf" | "image/png" | "image/jpeg";
export function sniff(b: Uint8Array): Mime | null {
  const is = (...s: number[]) => s.every((x, i) => b[i] === x);
  if (is(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (is(0xff, 0xd8, 0xff)) return "image/jpeg";
  return null;
}

// Live-audit budget, per process (on serverless: per warm instance, so a soft limit): daily cap and concurrent in-flight cap.
const budget = { day: "", n: 0, inflight: 0 };
export function reserveLive(): { release: () => void } | { why: "cap" | "busy" } {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) { budget.day = day; budget.n = 0; }
  if (budget.n >= (Number(process.env.AUDIT_DAILY_CAP ?? 200) || 200)) return { why: "cap" };
  if (budget.inflight >= (Number(process.env.MAX_INFLIGHT ?? 3) || 3)) return { why: "busy" };
  budget.n++; budget.inflight++;
  let done = false;
  return { release: () => { if (!done) { done = true; budget.inflight--; } } };
}

// Strip control, format (bidi, zero-width) and other invisible characters and collapse whitespace. keepNl keeps line breaks.
export function clean(v: unknown, n = 160, keepNl = false): string {
  let s = String(v ?? "").replace(/\r\n?/g, "\n");
  s = s.replace(/[\p{Cf}؜]/gu, ""); // bidi marks and overrides, zero-width characters: removed outright
  s = keepNl ? s.replace(/[^\P{C}\n]/gu, "") : s.replace(/\p{C}/gu, " "); // other control characters: dropped, or a space when single-line
  s = keepNl ? s.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  return s.trim().slice(0, n);
}

// Read a request body but stop at max bytes (Content-Length can be absent or a lie). Returns null when over the cap.
export async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  const r = req.body?.getReader();
  if (!r) return new Uint8Array();
  const parts: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    n += value.length;
    if (n > max) { await r.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Cheap size checks before a document reaches the model. Heuristics: compressed PDF object streams can hide pages.
export const MAX_PDF_PAGES = Number(process.env.MAX_PDF_PAGES ?? 20) || 20;
export const MAX_PIXELS = 10_000;
export function pdfPages(b: Uint8Array): number {
  const t = new TextDecoder("latin1").decode(b);
  const leaf = (t.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
  const counts = [...t.matchAll(/\/Count\s+(\d{1,6})/g)].map((m) => Number(m[1]));
  return Math.max(leaf, ...counts);
}
export function imageDims(b: Uint8Array, m: Mime): [number, number] | null {
  if (m === "image/png") { if (b.length < 24) return null; const v = new DataView(b.buffer, b.byteOffset, b.byteLength); return [v.getUint32(16), v.getUint32(20)]; }
  if (m !== "image/jpeg") return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff || b[i + 1] === 0xff) { i++; continue; }
    const k = b[i + 1];
    if (k >= 0xc0 && k <= 0xcf && k !== 0xc4 && k !== 0xc8 && k !== 0xcc) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

export const REPORT_ID = /^[a-f0-9]{32}$/; // report ids are randomUUID() without dashes (128 bits)
