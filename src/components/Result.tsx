import { useEffect, useMemo, useRef, useState } from "react";
import { decide, money, type User } from "../engine/rules";
import { explain, LABEL } from "../flow/explain";
import { buildProfile, fmtUsd, type Note } from "../flow/profile";
import InfoLink from "./InfoLink";

const TONE = { "Clear": "clear", "Soft flag": "soft", "Hard flag": "hard", "Onboarding block": "block" } as const;

interface Props { user: User; seed: string; onRestart: () => void; onEdit: () => void }

export default function Result({ user, seed, onRestart, onEdit }: Props) {
  const o = decide(user);
  const e = explain(user, o);
  const p = useMemo(() => buildProfile(user, o, seed), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const machineFlagged = o.decision === "Soft flag" || o.decision === "Hard flag";

  const [flagged, setFlagged] = useState(machineFlagged);
  const [notes, setNotes] = useState<Note[]>(p.notes);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [tip, setTip] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);

  const status = !p.hasAccount ? "No account" : flagged ? (machineFlagged ? o.decision : "Flagged by analyst") : "Active";
  const statusTone = !p.hasAccount ? "block" : flagged ? (o.decision === "Hard flag" ? "hard" : "soft") : "clear";
  const action = flagged ? "Unflag" : "Flag";

  const save = () => {
    if (!reason.trim()) return;
    setNotes([{ when: "Just now", who: "You (analyst)", text: `${action}ged: ${reason.trim()}`, kind: "you" }, ...notes]);
    setFlagged(!flagged); setReason(""); setEditing(false);
  };

  return (
    <>
      <section className={"band band-result tone-" + TONE[o.decision]}>
        <div className="wrap">
          <div className="result-kicker">The machine decided</div>
          <h1 tabIndex={-1} ref={head} className="decision">{LABEL[o.decision]}</h1>
          <p className="lede">{e.summary}</p>
          <ul className="band-reasons">
            {e.reasons.map(r => <li key={r}>{r}</li>)}
            {e.notes.map(n => <li key={n} className="muted">{n}</li>)}
          </ul>
        </div>
      </section>

      <section className="wrap stage profile">
        {/* identity */}
        <div className="who">
          <div>
            <h2 className="who-name">{p.name} <span className="who-age">({p.age})</span></h2>
            <div className="who-state">{p.hasAccount ? <>State: <b>{p.state}</b>, as per KYC</> : <>Signup country: <b>{p.signupCountry}</b></>}</div>
          </div>
          <span className={"status s-" + statusTone}>{status}</span>
        </div>

        {/* balances */}
        <div className="balances">
          <div className="bal"><span className="bal-k">Account balance (Juno)</span><span className="bal-v">{money(p.cash)}</span></div>
          <div className="bal"><span className="bal-k">Crypto balance</span><span className="bal-v">₿ {p.cryptoBtc.toFixed(4)}</span><span className="bal-sub">≈ {money(p.cryptoUsd)}</span></div>
        </div>

        {/* transaction history */}
        <div className="box">
          <div className="box-head">
            <h3>Transaction history</h3>
            <InfoLink label="Open transaction history at Synapse" title="Take me to Synapse"
              body="In production, this opens the user’s full ledger at Synapse, Juno’s banking-as-a-service partner. Disabled in this demo." />
          </div>
          {p.txns.length ? (
            <ul className="txns">
              {p.txns.map((t, i) => (
                <li key={i}>
                  <div><div className="tx-label">{t.label}</div><div className="tx-detail">{t.detail}</div></div>
                  <div className="tx-right"><div className={"tx-amt " + t.dir}>{t.dir === "neutral" ? money(Math.abs(t.amount)) : fmtUsd(t.amount)}</div><div className="tx-when">{t.when}</div></div>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No account was created, so there are no transactions.</p>}
        </div>

        {/* flag history */}
        <div className="box">
          <div className="box-head"><h3>Flag history (analyst notes)</h3></div>
          {notes.length ? (
            <ul className="notes">
              {notes.map((n, i) => (
                <li key={i} className={"n-" + n.kind}>
                  <div className="note-meta"><b>{n.who}</b> · {n.when}</div>
                  <div>{n.text}</div>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No flags or notes on this account.</p>}
        </div>

        {/* KYC */}
        <div className="kyc-head">
          <h3>KYC</h3>
          <InfoLink label="Open KYC at Onfido" title="Take me to Onfido"
            body="In production, this opens the user’s Onfido record to check facial recognition and login verification. Disabled in this demo." />
        </div>
        <div className="box">
          <div className="box-head">
            <h3 className="sr">Logins</h3>
            <span className="box-sub">Logins</span>
            <InfoLink label="Open geolocation in Metabase" title="Take me to Metabase"
              body="In production, this opens the Metabase dashboard with IP and geolocation details for this user. Disabled in this demo." />
          </div>
          {p.hasAccount && (
            <ul className="kyc-checks">{p.kyc.map(k => <li key={k.text} className={k.ok ? "ok" : "bad"}>{k.text}</li>)}</ul>
          )}
          {p.hasAccount ? (
            <div className="ips">
              <div className="ip">
                <div className="ip-k">Latest login {p.latest.isNew && <span className="tag-new">New</span>}</div>
                <div className="ip-v">{p.latest.ip}</div>
                <div className="ip-d">{p.latest.place} · {p.latest.when} · {p.latest.device}</div>
                {p.latest.extra && <div className="ip-x">{p.latest.extra}</div>}
              </div>
              <div className="ip">
                <div className="ip-k">Previous login</div>
                <div className="ip-v">{p.previous.ip}</div>
                <div className="ip-d">{p.previous.place} · {p.previous.when} · {p.previous.device}</div>
              </div>
            </div>
          ) : <p className="empty">Signup was stopped before KYC finished.</p>}
        </div>

        {/* flag / unflag */}
        {p.hasAccount && (
          <div className="actions">
            {!editing ? (
              <div className="act-row">
                <button className={action === "Flag" ? "btn-danger" : "btn-primary"} onClick={() => setEditing(true)}>{action}</button>
                <button className="info-i" aria-label={`What does ${action} do?`} aria-expanded={tip} onClick={() => setTip(!tip)}>i</button>
                {tip && (
                  <div className="infobar" role="status">
                    <div><b>{action}</b><span>{action === "Flag"
                      ? "Puts the account on a flag: money can come in, but withdrawals and crypto out stop until the account is cleared."
                      : "Removes the flag and restores full access. Your reason is saved to Flag history."}</span></div>
                    <button className="infobar-x" aria-label="Close" onClick={() => setTip(false)}>×</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="reason-box">
                <label htmlFor="reason"><b>Why are you {action === "Flag" ? "flagging" : "unflagging"} this account?</b> This goes into Flag history.</label>
                <textarea id="reason" rows={3} value={reason} onChange={ev => setReason(ev.target.value)} autoFocus
                  placeholder={action === "Flag" ? "For example: receivers cash out to crypto within minutes" : "For example: documents received, income verified"} />
                <div className="act-row">
                  <button className="btn-primary" disabled={!reason.trim()} onClick={save}>Save and {action.toLowerCase()}</button>
                  <button className="btn-text" onClick={() => { setEditing(false); setReason(""); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="nav">
          <button className="btn-text" onClick={onEdit}>← Change answers</button>
          <button className="btn-primary" onClick={onRestart}>Create another user</button>
        </div>
      </section>
    </>
  );
}
