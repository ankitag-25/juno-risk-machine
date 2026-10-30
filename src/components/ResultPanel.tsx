import { useEffect, useRef, useState } from "react";
import { T, type Access, type Decision, type Outcome, type RuleResult, type User } from "../engine/rules";

const STATUS: Record<Decision, string> = {
  "Clear": "var(--clear)", "Soft flag": "var(--soft)", "Hard flag": "var(--hard)", "Onboarding block": "var(--block)",
};

function AccessGrid({ a }: { a: Access | null }) {
  if (!a) return <div className="noacc">No account is created.</div>;
  const cell = (k: string, v: boolean) => (
    <div className="acc" key={k}><div className="k">{k}</div><div className={"v " + (v ? "y" : "n")}>{v ? "Allowed" : "Blocked"}</div></div>
  );
  return <div className="access">{cell("Deposits", a.deposits)}{cell("Withdrawals", a.withdrawals)}{cell("Juno-to-Juno", a.j2j)}{cell("Crypto out", a.crypto)}</div>;
}

function RuleRow({ r, severe }: { r: RuleResult; severe?: boolean }) {
  const pill = severe
    ? r.fired ? <span className="pill p-severe">Hard</span> : <span className="pill p-pass">Pass</span>
    : r.noted ? <span className="pill p-noted">Noted</span> : r.fired ? <span className="pill p-fired">Fired</span> : <span className="pill p-pass">Pass</span>;
  return (
    <div className={"rule" + (r.fired ? " is-fired" : "")}>
      {pill}
      <div><div className="nm">{r.name}</div><div className="cd">{r.cond}</div></div>
      <div className="vl">{r.value}</div>
    </div>
  );
}

export default function ResultPanel({ u, outcome: d, showBar }: { u: User; outcome: Outcome; showBar: boolean }) {
  const st = STATUS[d.decision];
  const prev = useRef(d.decision);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== d.decision) { prev.current = d.decision; setFlash(x => x + 1); }
  }, [d.decision]);
  const panelRef = useRef<HTMLElement>(null);
  const b = d.booster;

  return (
    <>
      <aside className="result" aria-live="polite" ref={panelRef}>
        <div className="panel verdict" style={{ ["--st" as string]: st }}>
          <div className="v-label">The machine decides</div>
          <div className={"v-head" + (flash ? " flash" : "")} key={flash}>
            <span className="v-dot" /><span className="v-title">{d.decision}</span>
          </div>
          <p className="v-reason">{d.reason}</p>
          <AccessGrid a={d.access} />
          {d.follow.length > 0 && <ul className="follow">{d.follow.map(f => <li key={f}>{f}</li>)}</ul>}
        </div>

        <div className="panel trace">
          <div className="trace-head"><h3>Rule trace</h3><span className="count">counted <b>{d.total}</b> · hard at {T.hardAt}</span></div>
          <div className="sect">Onboarding</div>
          <div className={"rule" + (d.blocked ? " is-fired" : "")}>
            {d.blocked ? <span className="pill p-block">Block</span> : <span className="pill p-pass">Pass</span>}
            <div><div className="nm">Signup outside US</div><div className="cd">Juno serves US residents only</div></div>
            <div className="vl">{u.signup_country}</div>
          </div>
          <div className="sect">Severe signals: any one is a hard flag</div>
          {d.severe.map(s => <RuleRow key={s.id} r={s} severe />)}
          <div className="sect">Red flags: 1 is a soft flag, {T.hardAt}+ is a hard flag</div>
          {d.rules.map(r => <RuleRow key={r.id} r={r} />)}
          <div className="sect">Booster: adds 1 only when another red flag fired</div>
          <div className={"rule" + (b.counted ? " is-fired" : "")}>
            {b.counted ? <span className="pill p-boost">+1</span> : <span className="pill p-pass">{b.present ? "Idle" : "Pass"}</span>}
            <div><div className="nm">Same-day ACH to crypto</div><div className="cd">Normal on its own. Juno is built for this.</div></div>
            <div className="vl">{b.present ? (b.counted ? "Counted" : "Alone, not counted") : "No"}</div>
          </div>
        </div>
      </aside>

      {showBar && (
        <button className="mbar" aria-label="Jump to decision" style={{ ["--st" as string]: st }}
          onClick={() => panelRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
          <span className="v-dot" style={{ background: st }} /><b>{d.decision}</b><span>{d.total} counted</span>
        </button>
      )}
    </>
  );
}
