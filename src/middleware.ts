import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/security";

const eq = (a: string, b: string) => { let d = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// Failed basic-auth attempts per client IP (edge runtime: module-level Map, per isolate, so a soft limit). 5 failures in 15 min lock that IP out.
const fails = new Map<string, number[]>();
const WINDOW = 15 * 60_000, MAX_FAILS = 5;
const recent = (ip: string, now: number) => (fails.get(ip) ?? []).filter((t) => now - t < WINDOW);
function noteFail(ip: string, now: number) {
  fails.set(ip, [...recent(ip, now), now]);
  if (fails.size > 2000) { for (const k of fails.keys()) if (!recent(k, now).length) fails.delete(k); for (const k of fails.keys()) { if (fails.size <= 2000) break; fails.delete(k); } }
}

// Headers for every response, including 401/429/503. HSTS and upgrade-insecure-requests only when the request arrived over HTTPS.
function harden(res: NextResponse, https: boolean) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (https && process.env.NODE_ENV === "production") res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return res;
}

export function middleware(req: NextRequest) {
  const https = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const pass = process.env.BASIC_AUTH_PASS, user = process.env.BASIC_AUTH_USER;
  if (!pass && process.env.NODE_ENV === "production" && process.env.ALLOW_PUBLIC !== "1" && req.nextUrl.pathname !== "/api/health")
    return harden(new NextResponse("Set BASIC_AUTH_PASS (or ALLOW_PUBLIC=1 for a public demo)", { status: 503 }), https);
  if (pass) {
    const ip = clientIp(req), now = Date.now();
    if (recent(ip, now).length >= MAX_FAILS) return harden(new NextResponse("Too many failed attempts. Try again later.", { status: 429, headers: { "Retry-After": "900" } }), https);
    const [scheme, enc] = (req.headers.get("authorization") ?? "").split(" ");
    let ok = false;
    try {
      if (scheme === "Basic" && enc) {
        const dec = atob(enc), i = dec.indexOf(":");
        ok = eq(dec.slice(i + 1), pass) && (!user || eq(dec.slice(0, Math.max(i, 0)), user)); // username checked only when BASIC_AUTH_USER is set
      }
    } catch { /* bad header */ }
    if (!ok) { if (req.headers.has("authorization")) noteFail(ip, now); return harden(new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Bandari Check"' } }), https); }
    fails.delete(ip);
  }
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    ...(https && !dev ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", csp);
  const res = harden(NextResponse.next({ request: { headers } }), https);
  res.headers.set("Content-Security-Policy", csp);
  return res;
}
export const config = { matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }] };
