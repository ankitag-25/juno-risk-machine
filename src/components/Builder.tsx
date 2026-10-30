import { useEffect, useMemo, useState } from "react";
import { CITIES, decide, fmtMins, money, travelCheck, type User } from "../engine/rules";
import { SCENARIOS, USERS } from "../data";
import { FIELDS, type Field } from "./fields";
import ResultPanel from "./ResultPanel";

const cityOpts = Object.keys(CITIES);
const sortedUsers = [...USERS].sort((a, b) => a.user_id.localeCompare(b.user_id));

function fmtVal(f: Field, v: number) {
  if (f.unit === "$") return money(v);
  if (f.unit === "min") return fmtMins(v);
  if (f.unit === "%") return v + "%";
  if (f.unit === "d") return v + (v === 1 ? " day" : " days");
  if (f.unit === "h") return v + "h";
  return String(v);
}

interface Props { base: User; onPick: (id: string) => void; showBar: boolean }

export default function Builder({ base, onPick, showBar }: Props) {
  const [u, setU] = useState<User>(base);
  useEffect(() => setU(base), [base]);

  const outcome = useMemo(() => decide(u), [u]);
  const travel = useMemo(() => travelCheck(u), [u]);
  const set = <K extends keyof User>(k: K, v: User[K]) => setU(prev => ({ ...prev, [k]: v }));
  const label = (x: User) => `${x.user_id}  ${x.persona}${x.truth ? ` (${x.truth})` : ""}`;

  const renderField = (f: Field) => {
    const off = f.off ? f.off(u) : false;
    const cls = "field" + (off ? " off" : "");

    if (f.type === "travel") {
      return (
        <div className="field" key="_travel">
          <div className="row2">
            <div>
              <label className="lbl" htmlFor="f-prev_city">Last login from</label>
              <select id="f-prev_city" value={u.prev_city} onChange={e => set("prev_city", e.target.value)}>
                {cityOpts.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="f-login_city">This login from</label>
              <select id="f-login_city" value={u.login_city} onChange={e => set("login_city", e.target.value)}>
                {cityOpts.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="travel-note">
            {travel.km ? (
              <>
                {travel.km.toLocaleString("en-US")} km apart. Fastest realistic trip: <b>{travel.needHours.toFixed(1)}h</b>. Gap: <b>{u.gap_hours}h</b>.{" "}
                {travel.impossible ? <span style={{ color: "var(--soft)" }}>Not possible.</span> : <span style={{ color: "var(--ok)" }}>Possible.</span>}
              </>
            ) : "Same city as last login. No travel to check."}
          </div>
        </div>
      );
    }

    const key = f.key as keyof User;
    const v = u[key];

    if (f.type === "range") {
      const n = v as number;
      const pct = ((n - f.min!) / (f.max! - f.min!)) * 100;
      return (
        <div className={cls} key={key}>
          <div className="field-top">
            <label htmlFor={"f-" + key}>{f.label}</label>
            <output className="num" htmlFor={"f-" + key}>{fmtVal(f, n)}</output>
          </div>
          <input type="range" id={"f-" + key} min={f.min} max={f.max} step={f.step || 1} value={n} disabled={off}
            style={{ ["--p" as string]: pct + "%" }}
            onChange={e => set(key, Number(e.target.value) as never)} />
        </div>
      );
    }
    if (f.type === "toggle") {
      return (
        <div className={cls} key={key}>
          <button className="switch-row" role="switch" aria-checked={!!v} disabled={off} onClick={() => set(key, (v ? 0 : 1) as never)}>
            <span className="lbl">{f.label}</span><span className="switch" aria-hidden="true" />
          </button>
        </div>
      );
    }
    if (f.type === "seg") {
      return (
        <div className={cls} key={key}>
          <span className="lbl" id={"l-" + key}>{f.label}</span><br />
          <div className="seg" role="group" aria-labelledby={"l-" + key}>
            {f.options!.map(o => <button key={o} aria-pressed={v === o} onClick={() => set(key, o as never)}>{o}</button>)}
          </div>
        </div>
      );
    }
    return (
      <div className={cls} key={key}>
        <div className="field-top"><label htmlFor={"f-" + key}>{f.label}</label></div>
        <div style={{ marginTop: 8 }}>
          <select id={"f-" + key} value={v as string} onChange={e => set(key, e.target.value as never)}>
            {f.options!.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="build">
      <div>
        <div className="panel start">
          <div className="grow">
            <label htmlFor="preset">Start from</label>
            <select id="preset" value={base.user_id} onChange={e => onPick(e.target.value)}>
              <optgroup label="Scenarios">{SCENARIOS.map(x => <option key={x.user_id} value={x.user_id}>{label(x)}</option>)}</optgroup>
              <optgroup label="The 50 synthetic users">{sortedUsers.map(x => <option key={x.user_id} value={x.user_id}>{label(x)}</option>)}</optgroup>
            </select>
          </div>
          <button className="btn" onClick={() => setU(base)}>Reset to this user</button>
        </div>
        <div className="groups">
          {FIELDS.map(g => (
            <section className="panel group" key={g.group}>
              <h2>{g.group}</h2>
              {g.hint && <p className="hint">{g.hint}</p>}
              {g.items.map(renderField)}
            </section>
          ))}
        </div>
      </div>
      <ResultPanel u={u} outcome={outcome} showBar={showBar} />
    </div>
  );
}
