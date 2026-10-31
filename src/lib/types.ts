export type V = string | number | null;
export type Fld = { value: V; confidence: number };
export type Item = { description?: string; qty?: number | null; unit_price?: number | null; amount?: number | null; gross_kg?: number | null };
export type DocType = "bill_of_lading" | "commercial_invoice" | "packing_list";
export type Doc = { doc_type: DocType; filename: string; fields: Record<string, Fld>; items: Item[]; suspicious_text?: boolean };
export type Severity = "blocker" | "warn" | "info";
export type Evidence = { doc: string; field: string; value: V | undefined };
export type Finding = {
  id: string; severity: Severity; title: string; detail: string; detail_sw: string; evidence: Evidence[];
  why?: { en: string; sw: string };
};
export type Verdict = "GO" | "REVIEW" | "NO_GO";
export type Scored = {
  score: number; verdict: Verdict;
  demurrage: { days_at_risk: number; usd_per_day: number; usd_exposure: number; note: string };
};
export type Messages = { message_en: string; message_sw: string; source: "claude" | "template" };
export type Report = Scored & {
  report_id: string; generated_at: string; mode: "live" | "demo"; documents: Doc[]; findings: Finding[];
  counts: Record<Severity, number>; messages: Messages; notice: string; sha256: string; saved?: boolean;
};
