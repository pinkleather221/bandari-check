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
