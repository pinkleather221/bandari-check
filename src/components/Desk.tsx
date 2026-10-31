"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DOC, FLD, T, type Lang } from "@/lib/i18n";
import type { Finding, Report } from "@/lib/types";

const SEV: Record<string, string> = { blocker: "", warn: "w", info: "i" };
const OK_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const show = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-KE") : String(v ?? "missing"));

export default function Desk() {
  const [lang, setLang] = useState<Lang>("en");
  const [report, setReport] = useState<Report | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<{ text: string; err?: boolean }>({ text: "" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [msg, setMsg] = useState("");
  const [sample, setSample] = useState("set3_errors");
  const [agree, setAgree] = useState(false);
  const [who, setWho] = useState("");
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const t = T[lang];

  useEffect(() => { if (report) setMsg(lang === "sw" ? report.messages.message_sw : report.messages.message_en); }, [report, lang]);

  const hits = useMemo(() => {
    const f = report && open !== null ? report.findings[open] : null;
    return new Map((f?.evidence ?? []).map((e) => [`${e.doc}|${e.field}`, SEV[f!.severity]]));
  }, [report, open]);

  function pick(list: FileList | null) {
    const all = [...(list ?? [])];
    const ok = all.filter((f) => OK_TYPES.includes(f.type) && f.size <= 8 * 1048576).slice(0, 5);
    setStatus(ok.length < all.length ? { text: "Some files were skipped. Use PDF, PNG or JPEG under 8 MB, up to 5 files.", err: true } : { text: "" });
    setFiles(ok);
  }

  async function run(go: () => Promise<Response>) {
    setBusy(true); setApprovedBy(null); setAgree(false);
    const steps = ["Reading the documents…", "Checking every number…", "Drafting the fix message…"];
    let i = 0; setStatus({ text: steps[0] });
    const timer = setInterval(() => setStatus({ text: steps[Math.min(++i, steps.length - 1)] }), 2200);
    try {
      const r = await go();
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.detail ?? "Something went wrong. Try again.");
      setReport(j as Report); setOpen(0); setStatus({ text: "" });
    } catch (e) { setStatus({ text: (e as Error).message, err: true }); }
    finally { clearInterval(timer); setBusy(false); }
  }
  const audit = () => run(() => { const fd = new FormData(); files.forEach((f) => fd.append("files", f)); return fetch("/api/audit", { method: "POST", body: fd }); });
  const runSample = () => run(() => fetch(`/api/demo/${encodeURIComponent(sample)}`));

  async function approve() {
    if (!report) return;
    const r = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: report.report_id, name: who }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) { setStatus({ text: j?.detail ?? "Could not save the approval.", err: true }); return; }
    setApprovedBy(who.trim()); setTimeout(() => window.print(), 50);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(msg); setStatus({ text: "Message copied." }); }
    catch { setStatus({ text: "Copy failed. Select the text and copy it by hand.", err: true }); }
  }
  const q = encodeURIComponent(msg);

  return (
    <main id="main" className="wrap desk">
      <section className="intake" aria-labelledby="h1">
        <div className="seg lang" role="group" aria-label="Language">
          {(["en", "sw"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "en" ? "English" : "Kiswahili"}</button>
          ))}
        </div>
        <h1 id="h1">{t.headline}</h1>
        <p className="lede">{t.lede}</p>

        <label className={`drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}>
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" multiple onChange={(e) => pick(e.target.files)} />
          <span className="drop-title">{t.drop}</span>
          <span className="drop-sub">PDF, PNG or JPEG. Up to 5 files, 8 MB each.</span>
        </label>
        <ul className="picked" aria-live="polite">{files.map((f) => <li key={f.name + f.size}>{f.name.slice(0, 40)}</li>)}</ul>
        <div className="row">
          <button className="btn primary" type="button" disabled={busy || !files.length} onClick={audit}>{t.audit}</button>
          <span className="or">or try a sample</span>
          <select aria-label="Sample shipment" value={sample} onChange={(e) => setSample(e.target.value)}>
            <option value="set3_errors">Five planted problems</option>
            <option value="set2_container">Mistyped container number</option>
            <option value="set4_injection">Hidden instruction for an AI</option>
            <option value="set1_clean">Clean shipment</option>
          </select>
          <button className="btn" type="button" disabled={busy} onClick={runSample}>Run sample</button>
        </div>
        <p className={`status${status.err ? " err" : ""}`} role="status" aria-live="polite">{status.text}</p>

        <div className="sheets">
          {report?.documents.map((d) => (
            <article className="sheet in" key={d.doc_type}>
              <h3>{DOC[d.doc_type]}<small>{d.filename}</small></h3>
              <dl className="fields">
                {Object.entries(d.fields).map(([k, o]) => {
                  const hit = hits.get(`${d.doc_type}|${k}`);
                  return [
                    <dt key={k + "t"}>{FLD[k] ?? k}</dt>,
                    <dd key={k + "d"} className={`${o.confidence < 0.8 ? "low " : ""}${hit !== undefined ? `hit ${hit}` : ""}`}>
                      <span className={`conf${o.confidence < 0.8 ? " low" : ""}`} title={`confidence ${Math.round(o.confidence * 100)}%`} />{show(o.value)}
                    </dd>,
                  ];
                })}
              </dl>
              {d.items.length > 0 && <p className="fine">{d.items.length} line item(s) read</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="result" aria-label="Result">
        {!report ? (
          <div className="empty"><div className="stamp ghost" aria-hidden="true"><span>Verdict</span></div><p>{t.empty}</p></div>
        ) : (
          <div>
            <div className="verdict">
              <div key={report.report_id} className={`stamp thunk ${{ GO: "go", REVIEW: "review", NO_GO: "nogo" }[report.verdict]}`}><span>{t[report.verdict]}</span></div>
              <dl className="kpis">
                <div><dt>{t.score}</dt><dd>{report.score}/100</dd></div>
                <div><dt>{t.exposure}</dt><dd>≈ USD {report.demurrage.usd_exposure.toLocaleString("en-US")}</dd></div>
                <div><dt>{t.counts}</dt><dd>{report.counts.blocker}·{report.counts.warn}·{report.counts.info}</dd></div>
              </dl>
            </div>
            <p className="fine">{report.demurrage.days_at_risk} day(s) at USD {report.demurrage.usd_per_day}/day. {report.demurrage.note}</p>

            <h2>{t.findings}</h2>
            <ol className="findings">
              {report.findings.length === 0 && <li className="fine">{t.clean}</li>}
              {report.findings.map((f: Finding, n) => (
                <li key={f.id} className={`finding ${SEV[f.severity]}`}>
                  <button type="button" aria-expanded={open === n} aria-controls={`f${n}`} onClick={() => setOpen(open === n ? null : n)}>
                    <span className="sev">{t[f.severity]}</span><span className="ft">{f.title}</span>
                  </button>
                  <div className="fb" id={`f${n}`} hidden={open !== n}>
                    <p>{lang === "sw" ? f.detail_sw : f.detail}</p>
                    {f.why && <p className="why">{f.why[lang]}</p>}
                    <ul className="chips">{f.evidence.map((e, i) => <li key={i}>{DOC[e.doc] ?? e.doc} · {FLD[e.field] ?? e.field}: {show(e.value)}</li>)}</ul>
                  </div>
                </li>
              ))}
            </ol>

            <h2>{t.outbox}</h2>
            <label className="sr" htmlFor="msg">Message</label>
            <textarea id="msg" rows={9} value={msg} onChange={(e) => setMsg(e.target.value)} />
            <div className="row">
              <button className="btn" type="button" onClick={copy}>Copy message</button>
              <a className="btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${q}`}>Send on WhatsApp</a>
              <a className="btn" href={`mailto:?subject=${encodeURIComponent("Shipment documents: corrections needed")}&body=${q}`}>Send by email</a>
            </div>

            <fieldset className="gate">
              <legend>{t.approve}</legend>
              <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I compared this report with the original documents.</span></label>
              <label className="name">Name <input type="text" maxLength={60} autoComplete="name" value={who} onChange={(e) => setWho(e.target.value)} /></label>
              <button className="btn primary" type="button" disabled={!agree || who.trim().length < 2} onClick={approve}>Approve and print clearance pack</button>
            </fieldset>
            <p className="fine">
              Report {report.report_id} · {report.mode === "live" ? "live read" : "sample data"} · {report.generated_at} · integrity {report.sha256.slice(0, 16)}…
              {approvedBy && ` · Approved by ${approvedBy}`}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
