import { json } from "@/lib/http";
export const runtime = "nodejs";
// Public liveness only: no configuration or database state is disclosed.
export async function GET() { return json({ ok: true }); }
