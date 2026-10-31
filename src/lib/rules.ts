// Deterministic audit rules. The model never does arithmetic or comparisons.
import type { Doc, Evidence, Finding, Scored, Severity } from "./types";

export const CONF_MIN = 0.8;
const CRITICAL = new Set(["consignee", "container_no", "invoice_total", "gross_weight_kg"]);
const REQUIRED: Record<string, string[]> = {
  bill_of_lading: ["shipper", "consignee", "container_no", "gross_weight_kg", "package_count", "port_of_discharge", "doc_date"],
  commercial_invoice: ["shipper", "consignee", "invoice_total", "currency", "hs_code", "doc_date"],
  packing_list: ["shipper", "consignee", "gross_weight_kg", "package_count", "container_no"],
};
const PENALTY: Record<Severity, number> = { blocker: 25, warn: 8, info: 2 };
const DAYS: Record<Severity, number> = { blocker: 3, warn: 1, info: 0 };
const STOP = new Set(["LTD", "LIMITED", "CO", "COMPANY", "INC", "LLC", "PLC", "CORP", "THE"]);
const BL = "bill_of_lading", CI = "commercial_invoice", PL = "packing_list";

export function num(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const n = parseFloat(String(x ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
export const normName = (s: unknown) =>
  String(s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w)).join(" ");

function matching(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0, ai = 0, bi = 0;
  const dp = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) { best = dp[j]; ai = i - best; bi = j - best; }
      prev = tmp;
    }
  }
  if (!best) return 0;
  return best + matching(a.slice(0, ai), b.slice(0, bi)) + matching(a.slice(ai + best), b.slice(bi + best));
}
export const similarity = (a: string, b: string) => (a.length + b.length ? (2 * matching(a, b)) / (a.length + b.length) : 1);

export function iso6346Check(first10: string): number {
  const vals: Record<string, number> = {};
  let n = 10;
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") { if (n % 11 === 0) n++; vals[ch] = n++; }
  let total = 0;
  [...first10].forEach((c, i) => { total += (/[A-Z]/.test(c) ? vals[c] : Number(c)) * 2 ** i; });
  return (total % 11) % 10;
}
export function iso6346Ok(code: unknown): boolean {
  const c = String(code ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z]{3}[UJZR]\d{7}$/.test(c) && iso6346Check(c.slice(0, 10)) === Number(c[10]);
}
function parseDate(s: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function run(docs: Doc[]): Finding[] {
  const by: Record<string, Doc | undefined> = {};
  for (const d of docs) by[d.doc_type] = d;
  const out: Finding[] = [];
  const v = (t: string, f: string) => by[t]?.fields?.[f]?.value ?? null;
  const ev = (t: string, f: string): Evidence => ({ doc: t, field: f, value: v(t, f) });
  const add = (id: string, severity: Severity, title: string, detail: string, detail_sw: string, evidence: Evidence[]) =>
    out.push({ id, severity, title, detail, detail_sw, evidence });

  // 1. missing required fields
  const missing: Evidence[] = []; let crit = false;
  for (const [t, fields] of Object.entries(REQUIRED)) if (by[t]) for (const f of fields) {
    const x = v(t, f);
    if (x == null || x === "") { missing.push({ doc: t, field: f, value: null }); crit ||= CRITICAL.has(f); }
  }
  if (missing.length) add("MISSING_FIELDS", crit ? "blocker" : "warn", "Required fields are missing",
    `${missing.length} required field(s) could not be found. Customs may reject an entry with blanks.`,
    `Sehemu ${missing.length} zinazohitajika hazikupatikana. Forodha inaweza kukataa ombi lenye nafasi tupu.`, missing);

  // 2. low-confidence reads
  const low: Evidence[] = [];
  for (const d of Object.values(by)) for (const [f, o] of Object.entries(d!.fields))
    if (o.value != null && o.value !== "" && o.confidence < CONF_MIN) low.push({ doc: d!.doc_type, field: f, value: o.value });
  if (low.length) add("LOW_CONFIDENCE", "warn", "Some fields were hard to read",
    `${low.length} field(s) were read with low confidence (smudged, skewed or handwritten). Check them against the original paper.`,
    `Sehemu ${low.length} zilisomwa kwa uhakika mdogo (zimefifia au ni za mkono). Zilinganishe na karatasi halisi.`, low);

  // 3. container number: ISO 6346 + cross-document match
  const cont = [BL, PL].filter((t) => v(t, "container_no")).map((t) => [t, String(v(t, "container_no"))] as const);
  const bad = cont.filter(([, c]) => !iso6346Ok(c)).map(([t, c]) => ({ doc: t, field: "container_no", value: c }));
  if (bad.length) add("CONTAINER_CHECKDIGIT", "blocker", "Container number fails its check digit",
    "The container number does not pass the ISO 6346 check-digit test, so it is almost certainly mistyped.",
    "Nambari ya kontena haipiti ukaguzi wa tarakimu ya mwisho (ISO 6346); huenda imeandikwa vibaya.", bad);
  if (new Set(cont.map(([, c]) => c.toUpperCase().replace(/[\s-]/g, ""))).size > 1)
    add("CONTAINER_MISMATCH", "blocker", "Container numbers differ between documents",
      "The bill of lading and packing list show different container numbers.",
      "Bili ya mizigo na orodha ya vifungashio zina nambari tofauti za kontena.", cont.map(([t]) => ev(t, "container_no")));

  // 4. parties (fuzzy)
  for (const [f, label, sw] of [["consignee", "Consignee", "mpokeaji"], ["shipper", "Shipper", "mtumaji"]] as const) {
    const vals = [BL, CI, PL].filter((t) => v(t, f)).map((t) => [t, String(v(t, f))] as const);
    let differs = false, min = 1;
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
      const a = normName(vals[i][1]), b = normName(vals[j][1]);
      if (a !== b) { differs = true; min = Math.min(min, similarity(a, b)); }
    }
    if (differs) {
      const sev: Severity = min >= 0.9 ? "warn" : "blocker";
      add(`${f.toUpperCase()}_MISMATCH`, sev, `${label} name does not match across documents`,
        `The ${f} looks ${sev === "warn" ? "spelled differently" : "like a different party"} on different documents. Customs matches names exactly.`,
        `Jina la ${sw} haliendani kwenye nyaraka zote. Forodha hulinganisha majina kwa usahihi kamili.`, vals.map(([t]) => ev(t, f)));
    }
  }

  // 5. weights
  const blG = num(v(BL, "gross_weight_kg")), plG = num(v(PL, "gross_weight_kg"));
  if (blG && plG) {
    const pct = Math.abs(blG - plG) / Math.max(blG, plG);
    if (pct > 0.005) add("WEIGHT_MISMATCH", pct > 0.02 ? "blocker" : "warn", "Gross weight differs between documents",
      `Bill of lading says ${fmt(blG)} kg, packing list says ${fmt(plG)} kg: a ${(pct * 100).toFixed(1)}% gap (${fmt(Math.abs(blG - plG))} kg).`,
      `Bili ya mizigo inasema kilo ${fmt(blG)}, orodha ya vifungashio inasema kilo ${fmt(plG)}: tofauti ya ${(pct * 100).toFixed(1)}%.`,
      [ev(BL, "gross_weight_kg"), ev(PL, "gross_weight_kg")]);
  }
  const plW = (by[PL]?.items ?? []).map((i) => num(i.gross_kg));
  if (plG && plW.length && plW.every((w) => w !== null)) {
    const s = plW.reduce<number>((a, b) => a + (b as number), 0);
    if (Math.abs(s - plG) / plG > 0.005) add("PL_SUM_WEIGHT", "warn", "Packing list lines do not add up to its total",
      `Line weights add to ${fmt(s)} kg but the packing list total is ${fmt(plG)} kg.`,
      `Uzito wa mistari unajumlisha kilo ${fmt(s)} lakini jumla ni kilo ${fmt(plG)}.`, [ev(PL, "gross_weight_kg")]);
  }
  for (const t of [BL, PL]) {
    const g = num(v(t, "gross_weight_kg")), n = num(v(t, "net_weight_kg"));
    if (g && n && n > g) add("NET_GT_GROSS", "blocker", "Net weight is higher than gross weight", "Net weight cannot exceed gross weight.",
      "Uzito halisi hauwezi kuzidi uzito wa jumla.", [ev(t, "gross_weight_kg"), ev(t, "net_weight_kg")]);
  }

  // 6. package counts
  const bp = num(v(BL, "package_count")), pp = num(v(PL, "package_count"));
  if (bp && pp && bp !== pp) add("PACKAGE_MISMATCH", "blocker", "Package count differs",
    `Bill of lading shows ${fmt(bp)} packages, packing list shows ${fmt(pp)}.`,
    `Bili ya mizigo ina vifurushi ${fmt(bp)}, orodha ina ${fmt(pp)}.`, [ev(BL, "package_count"), ev(PL, "package_count")]);

  // 7. invoice maths, always in code
  const total = num(v(CI, "invoice_total")), lines = by[CI]?.items ?? [];
  const amts = lines.map((i) => num(i.amount));
  if (total !== null && lines.length && amts.every((a) => a !== null)) {
    const s = amts.reduce<number>((a, b) => a + (b as number), 0);
    if (Math.abs(s - total) > 0.01) {
      const d = fmt(Math.abs(s - total));
      add("INVOICE_TOTAL_MISMATCH", "blocker", "Invoice total does not match its lines",
        `Line items add to ${fmt(s)} but the invoice total is ${fmt(total)}: a difference of ${d}. Duty is calculated on this value.`,
        `Mistari inajumlisha ${fmt(s)} lakini jumla ya ankara ni ${fmt(total)}: tofauti ya ${d}. Ushuru hukokotolewa kwa thamani hii.`, [ev(CI, "invoice_total")]);
    }
  }
  const badLines = lines.filter((i) => {
    const q = num(i.qty), p = num(i.unit_price), a = num(i.amount);
    return q !== null && p !== null && a !== null && Math.abs(q * p - a) > 0.01;
  }).map((i) => String(i.description ?? "?")).slice(0, 4);
  if (badLines.length) add("LINE_MATH", "warn", "A line's quantity x price does not equal its amount",
    "Check: " + badLines.join(", "), "Kagua: " + badLines.join(", "), [{ doc: CI, field: "items", value: badLines.join(", ") }]);

  // 8. HS codes
  const hs = [BL, CI, PL].filter((t) => v(t, "hs_code")).map((t) => [t, String(v(t, "hs_code")).replace(/\D/g, "")] as const);
  const short = hs.filter(([, d]) => d.length < 6).map(([t]) => ev(t, "hs_code"));
  if (short.length) add("HS_FORMAT", "warn", "HS code is too short", "HS codes need at least 6 digits.", "Msimbo wa HS unahitaji tarakimu 6 au zaidi.", short);
  const full = hs.filter(([, d]) => d.length >= 6);
  if (full.length > 1 && new Set(full.map(([, d]) => d.slice(0, 6))).size > 1) {
    const heading = new Set(full.map(([, d]) => d.slice(0, 4))).size > 1;
    add("HS_MISMATCH", heading ? "blocker" : "warn", "HS code differs between documents",
      heading ? "Different goods classifications on different documents change duty and can trigger an inspection." : "Same heading, different sub-heading. Confirm the correct code.",
      heading ? "Misimbo tofauti ya HS kwenye nyaraka hubadilisha ushuru na inaweza kusababisha ukaguzi." : "Kichwa kimoja, kifungu kidogo tofauti. Thibitisha msimbo sahihi.",
      full.map(([t]) => ev(t, "hs_code")));
  }

  // 9. dates and port
  const di = parseDate(v(CI, "doc_date")), db = parseDate(v(BL, "doc_date"));
  if (di !== null && db !== null && di > db) add("DATE_ORDER", "warn", "Invoice is dated after the bill of lading",
    "The invoice should be issued on or before the shipping date. Confirm the dates.",
    "Ankara inapaswa kutolewa kabla au siku ya kusafirisha. Thibitisha tarehe.", [ev(CI, "doc_date"), ev(BL, "doc_date")]);
  const pod = String(v(BL, "port_of_discharge") ?? "");
  if (pod && !/MOMBASA|KEMBA|KILINDINI/.test(pod.toUpperCase())) add("PORT_NOT_MOMBASA", "info", "Port of discharge is not Mombasa",
    `Bill of lading discharge port: ${pod}.`, `Bandari ya kushusha kwenye bili: ${pod}.`, [ev(BL, "port_of_discharge")]);

  // 10. prompt-injection tripwire
  for (const d of Object.values(by)) if (d!.suspicious_text) add("INJECTION_ATTEMPT", "blocker", "Document contains text aimed at an AI",
    "This document contains instructions addressed to an AI system. They were ignored; treat the document with suspicion.",
    "Nyaraka hii ina maagizo yanayolenga mfumo wa AI. Yamepuuzwa; ichukulie kwa tahadhari.",
    [{ doc: d!.doc_type, field: "text", value: "hidden instruction" }]);

  const order: Record<Severity, number> = { blocker: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function score(findings: Finding[], containers = 1): Scored {
  const s = Math.max(0, 100 - findings.reduce((a, f) => a + PENALTY[f.severity], 0));
  const verdict = findings.some((f) => f.severity === "blocker") ? "NO_GO" : s < 90 || findings.length ? "REVIEW" : "GO";
  const days = findings.reduce((a, f) => a + DAYS[f.severity], 0);
  const rate = Number(process.env.DEMURRAGE_USD_PER_DAY ?? 75) || 75;
  return { score: s, verdict, demurrage: { days_at_risk: days, usd_per_day: rate, usd_exposure: Math.round(days * rate * containers),
    note: "Illustrative estimate. Set DEMURRAGE_USD_PER_DAY to your shipping line's tariff." } };
}
