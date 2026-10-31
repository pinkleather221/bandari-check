export type Lang = "en" | "sw";
export const T = {
  en: { headline: "Check the papers before the port does.", audit: "Audit documents", score: "Readiness", exposure: "Demurrage at risk", counts: "Findings (blocker·check·note)",
    findings: "What needs fixing", outbox: "Message to your supplier", approve: "Your sign-off", drop: "Drop documents here or tap to choose",
    lede: "Drop the bill of lading, invoice and packing list. Bandari Check reads them, compares every number, and tells you if it is safe to lodge.",
    empty: "Your verdict appears here, with every problem traced to the document and field it came from.",
    GO: "Clear to lodge", REVIEW: "Check before lodging", NO_GO: "Do not lodge", blocker: "Blocker", warn: "Check", info: "Note",
    clean: "No problems found. The documents agree." },
  sw: { headline: "Kagua nyaraka kabla bandari haijakagua.", audit: "Kagua nyaraka", score: "Utayari", exposure: "Hatari ya demurrage", counts: "Matokeo (zuizo·kagua·kumbuka)",
    findings: "Yanayohitaji kurekebishwa", outbox: "Ujumbe kwa msambazaji", approve: "Uthibitisho wako", drop: "Weka nyaraka hapa au gusa kuchagua",
    lede: "Weka bili ya mizigo, ankara na orodha ya vifungashio. Bandari Check inazisoma, inalinganisha kila namba, na kukuambia kama ni salama kuwasilisha.",
    empty: "Hukumu itaonekana hapa, kila tatizo likionyesha nyaraka na sehemu lilikotoka.",
    GO: "Tayari kuwasilisha", REVIEW: "Kagua kabla ya kuwasilisha", NO_GO: "Usiwasilishe", blocker: "Zuizo", warn: "Kagua", info: "Kumbuka",
    clean: "Hakuna tatizo. Nyaraka zinaendana." },
} as const;
export const DOC: Record<string, string> = { bill_of_lading: "Bill of lading", commercial_invoice: "Commercial invoice", packing_list: "Packing list" };
export const FLD: Record<string, string> = { shipper: "Shipper", consignee: "Consignee", container_no: "Container", gross_weight_kg: "Gross kg",
  net_weight_kg: "Net kg", package_count: "Packages", hs_code: "HS code", invoice_total: "Invoice total", currency: "Currency",
  doc_date: "Date", port_of_discharge: "Port", items: "Line items", text: "Text" };
