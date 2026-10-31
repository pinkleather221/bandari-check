import { randomUUID } from "node:crypto";
import { getClient } from "@/lib/anthropic";
import { extract } from "@/lib/extract";
import { fail, json } from "@/lib/http";
import { buildReport } from "@/lib/report";
import { clean, clientIp, imageDims, MAX_BYTES, MAX_PDF_PAGES, MAX_PIXELS, pdfPages, rateLimit, readCapped, reserveLive, sameOrigin, sniff, type Mime } from "@/lib/security";
export const runtime = "nodejs";
export const maxDuration = 60; // extraction (40 s timeout, no retries) + explain (12 s) must fit inside this

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Cross-site request refused.");
  const client = getClient();
  if (!client) return fail(503, "Live reading needs ANTHROPIC_API_KEY on the server. Try a sample shipment instead.");
  if (!rateLimit(clientIp(req))) return fail(429, "Too many audits. Wait a minute and try again.");
  const max = MAX_BYTES * 5 + 1_048_576;
  if (Number(req.headers.get("content-length") ?? 0) > max) return fail(413, "Upload is too large.");
  const raw = await readCapped(req, max).catch(() => null); // streamed count: works without Content-Length
  if (!raw) return fail(413, "Upload is too large.");
  let form: FormData;
  try { form = await new Response(raw as BodyInit, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData(); } catch { return fail(400, "Could not read the upload."); }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length < 1 || files.length > 5) return fail(400, "Upload between 1 and 5 documents.");
  const blobs: { name: string; mime: Mime; bytes: Uint8Array }[] = [];
  for (const f of files) {
    const name = clean(f.name || "document", 40) || "document";
    if (f.size > MAX_BYTES) return fail(413, `${name} is larger than ${MAX_BYTES / 1048576} MB.`);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sniff(bytes);
    if (!mime) return fail(415, `${name}: only PDF, PNG or JPEG files are accepted.`);
    if (mime === "application/pdf" ? pdfPages(bytes) > MAX_PDF_PAGES : (imageDims(bytes, mime) ?? [0, 0]).some((d) => d > MAX_PIXELS))
      return fail(413, `${name} is too long or too large to read (max ${MAX_PDF_PAGES} pages, ${MAX_PIXELS} px).`);
    blobs.push({ name, mime, bytes });
  }
  const slot = reserveLive();
  if ("why" in slot) return fail(503, slot.why === "cap" ? "The daily limit for live audits is reached. Try a sample shipment, or come back tomorrow." : "The reader is busy. Try again in a minute.");
  const ac = new AbortController();
  try {
    // First failure aborts the sibling calls so they stop billing.
    const docs = await Promise.all(blobs.map((b) => extract(client, b.name, b.mime, b.bytes, ac.signal).catch((e) => { ac.abort(); throw e; })));
    return json(await buildReport(docs, "live", client));
  } catch (e) {
    const ref = randomUUID().slice(0, 8);
    console.error(`audit failed [${ref}]`, e instanceof Error ? e.message : "error"); // details stay in server logs only, no SDK objects
    return fail(502, `We could not read one of the documents. Try a clearer scan. (ref ${ref})`);
  } finally { slot.release(); }
}
