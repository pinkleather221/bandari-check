import { randomUUID } from "node:crypto";
import { getClient } from "@/lib/anthropic";
import { extract } from "@/lib/extract";
import { fail, json } from "@/lib/http";
import { buildReport } from "@/lib/report";
import { clientIp, MAX_BYTES, rateLimit, sameOrigin, sniff, type Mime } from "@/lib/security";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Cross-site request refused.");
  const client = getClient();
  if (!client) return fail(503, "Live reading needs ANTHROPIC_API_KEY on the server. Try a sample shipment instead.");
  if (!rateLimit(clientIp(req))) return fail(429, "Too many audits. Wait a minute and try again.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES * 5 + 1_048_576) return fail(413, "Upload is too large.");
  let form: FormData;
  try { form = await req.formData(); } catch { return fail(400, "Could not read the upload."); }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length < 1 || files.length > 5) return fail(400, "Upload between 1 and 5 documents.");
  const blobs: { name: string; mime: Mime; bytes: Uint8Array }[] = [];
  for (const f of files) {
    const name = (f.name || "document").slice(0, 40);
    if (f.size > MAX_BYTES) return fail(413, `${name} is larger than ${MAX_BYTES / 1048576} MB.`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sniff(bytes);
    if (!mime) return fail(415, `${name}: only PDF, PNG or JPEG files are accepted.`);
    blobs.push({ name, mime, bytes });
  }
  try {
    const docs = await Promise.all(blobs.map((b) => extract(client, b.name, b.mime, b.bytes)));
    return json(await buildReport(docs, "live", client));
  } catch (e) {
    const ref = randomUUID().slice(0, 8);
    console.error(`audit failed [${ref}]`, e); // details stay in server logs only
    return fail(502, `We could not read one of the documents. Try a clearer scan. (ref ${ref})`);
  }
}
