import { useMemo, useState } from "react";
import { decide, money, resultOf, type Result } from "../engine/rules";
import { USERS } from "../data";

const ORDER: Record<Result, number> = { "Wrongly flagged": 0, "Missed": 1, "Caught": 2, "Correctly cleared": 3 };
type Filter = "All" | "Wrongly flagged" | "Missed" | "Caught";

// Expected v1 outcome from the spec. The badge goes red if the engine ever drifts.
const SPEC = { caught: 15, wrong: 8, missed: 1 };

export default function RuleCheck({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [q, setQ] = useState("");

  const rows = useMemo(() => USERS
    .map(u => { const d = decide(u); return { u, d, res: resultOf(u.truth, d.decision) }; })
    .sort((a, b) => ORDER[a.res] - ORDER[b.res] || a.u.user_id.localeCompare(b.u.user_id)), []);

  const bad = rows.filter(x => x.u.truth !== "Legit"), good = rows.filter(x => x.u.truth === "Legit");
  const caught = bad.filter(x => x.res === "Caught"), wrong = good.filter(x => x.res === "Wrongly flagged"), missed = bad.filter(x => x.res === "Missed");
  const contained = caught.reduce((s, x) => s + x.u.weekly_inflow_usd, 0);
  const ok = caught.length === SPEC.caught && wrong.length === SPEC.wrong && missed.length === SPEC.missed;
  const counts: Record<Filter, number> = { All: rows.length, "Wrongly flagged": wrong.length, Missed: missed.length, Caught: caught.length };

  const ql = q.trim().toLowerCase();
  const shown = rows.filter(x => (filter === "All" || x.res === filter) &&
    (!ql || [x.u.user_id, x.u.persona, x.u.truth, ...x.d.fired.map(f => f.name)].join(" ").toLowerCase().includes(ql)));

  return (
    <>
      <div className="kpis">
        <div className="panel kpi"><div className="k">Fraud and at-risk caught</div><div className="v" style={{ color: "var(--accent-ink)" }}>{caught.length}<small> of {bad.length}</small></div></div>
        <div className="panel kpi"><div className="k">Good users wrongly flagged</div><div className="v" style={{ color: wrong.length ? "var(--bad)" : "var(--text)" }}>{wrong.length}<small> of {good.length}</small></div></div>
        <div className="panel kpi"><div className="k">Fraud missed</div><div className="v" style={{ color: missed.length ? "var(--miss)" : "var(--text)" }}>{missed.length}</div></div>
        <div className="panel kpi"><div className="k">Weekly inflow contained</div><div className="v">{money(contained)}</div></div>
      </div>

      <div className="panel spec">
        <span className={"spec-badge " + (ok ? "ok" : "no")}>{ok ? "Matches spec" : "Does not match spec"}</span>
        <p>Expected for v1: {SPEC.caught} of 16 caught, {SPEC.wrong} good users wrongly flagged, {SPEC.missed} missed. v1 catches almost everything, and the cost is {wrong.length} good customers who can’t withdraw their own money.</p>
      </div>

      <div className="tools">
        <label className="sr" htmlFor="q">Search users</label>
        <input className="search" id="q" type="search" placeholder="Search by ID, persona or rule" value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(counts) as Filter[]).map(k => (
            <button key={k} className="fchip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k}<span className="n">{counts[k]}</span></button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>User ID</th><th>Persona</th><th>Reality</th><th>Red flags fired</th><th>Decision</th><th>Result</th></tr></thead>
          <tbody>
            {shown.length ? shown.map(({ u, d, res }) => (
              <tr key={u.user_id} tabIndex={0} aria-label={`Open ${u.user_id} in the builder`}
                onClick={() => onOpen(u.user_id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(u.user_id); } }}>
                <td className="mono">{u.user_id}</td>
                <td>{u.persona}</td>
                <td className={"truth" + (u.truth !== "Legit" ? " bad" : "")}>{u.truth}</td>
                <td><div className="flags">
                  {d.blocked && <span className="fl" style={{ color: "var(--block)" }}>Signup outside US</span>}
                  {d.severeFired.map(s => <span className="fl" key={s.id} style={{ color: "var(--hard)" }}>{s.name}</span>)}
                  {d.fired.map(f => <span className="fl" key={f.id}>{f.name}</span>)}
                  {!d.blocked && !d.fired.length && !d.severeFired.length && <span style={{ color: "var(--faint)" }}>None</span>}
                </div></td>
                <td><span className={"badge b-" + d.decision.split(" ")[0]}>{d.decision}</span></td>
                <td><span className={"res r-" + res.split(" ")[0]}>{res}</span></td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">No users match. Clear the search or pick another filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
