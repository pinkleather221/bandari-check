import { desc, eq, sql } from "drizzle-orm";
import { getDb, purgeExpired } from "@/db";
import { audits } from "@/db/schema";
export const dynamic = "force-dynamic";

const LABEL = { GO: "Clear", REVIEW: "Check", NO_GO: "Do not lodge" } as Record<string, string>;

export default async function History() {
  let rows: (typeof audits.$inferSelect)[] = [], stats = { n: 0, blockers: 0, saved: 0 }, error = "";
  try {
    const db = await getDb();
    await purgeExpired(true);
    rows = await db.select().from(audits).orderBy(desc(audits.createdAt)).limit(50);
    const [s] = await db.select({
      n: sql<number>`count(*)`, blockers: sql<number>`coalesce(sum(${audits.blockers}),0)`,
      saved: sql<number>`coalesce(sum(case when ${audits.blockers} > 0 then ${audits.exposureUsd} else 0 end),0)`,
    }).from(audits).where(eq(audits.mode, "live")); // sample runs are not impact
    stats = s;
  } catch (e) { console.error("history failed", e instanceof Error ? e.message : "error"); error = "The history database is not reachable. Check DATABASE_URL."; }

  return (
    <main id="main" className="wrap page">
      <h1>Impact</h1>
      <p className="lede">Every audit is saved without the original files. Reports are deleted after {process.env.RETENTION_DAYS ?? 30} days.</p>
      {error && <p className="status err">{error}</p>}
      <dl className="kpis big">
        <div><dt>Live audits run</dt><dd>{stats.n}</dd></div>
        <div><dt>Blockers caught before lodging</dt><dd>{stats.blockers}</dd></div>
        <div><dt>Demurrage exposure flagged (illustrative)</dt><dd>≈ USD {Number(stats.saved).toLocaleString("en-US")}</dd></div>
      </dl>
      <h2>Recent audits</h2>
      {rows.length === 0 ? <p className="fine">No audits yet. Run one from the Audit page.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>When (UTC)</th><th>Container</th><th>Verdict</th><th>Score</th><th>Findings</th><th>Source</th><th>Sign-off</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td><td>{r.containerNo ?? "n/a"}</td>
              <td>{LABEL[r.verdict] ?? r.verdict}</td><td>{r.score}</td><td>{r.blockers}·{r.warns}·{r.infos}</td><td>{r.mode}</td>
              <td>{r.status === "approved" ? `${r.approvedBy}` : "pending"}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </main>
  );
}
