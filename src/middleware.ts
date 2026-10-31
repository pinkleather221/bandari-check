import { NextResponse, type NextRequest } from "next/server";

const eq = (a: string, b: string) => { let d = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export function middleware(req: NextRequest) {
  const pass = process.env.BASIC_AUTH_PASS;
  if (!pass && process.env.NODE_ENV === "production" && process.env.ALLOW_PUBLIC !== "1" && req.nextUrl.pathname !== "/api/health")
    return new NextResponse("Set BASIC_AUTH_PASS (or ALLOW_PUBLIC=1 for a public demo)", { status: 503 });
  if (pass) {
    const [scheme, enc] = (req.headers.get("authorization") ?? "").split(" ");
    let ok = false;
    try { if (scheme === "Basic" && enc) { const dec = atob(enc); ok = eq(dec.slice(dec.indexOf(":") + 1), pass); } } catch { /* bad header */ }
    if (!ok) return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Bandari Check"' } });
  }
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}
export const config = { matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }] };
