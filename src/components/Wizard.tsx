import { useEffect, useRef, useState } from "react";
import { userBefore, visibleOptions, visibleSteps, type Answers } from "../flow/steps";
import Icon from "./Icon";

interface Props { answers: Answers; setAnswers: (a: Answers) => void; onDone: () => void; onExit: () => void; startAt?: number }

export default function Wizard({ answers, setAnswers, onDone, onExit, startAt = 0 }: Props) {
  const [i, setI] = useState(startAt);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const steps = visibleSteps(answers);
  const step = steps[Math.min(i, steps.length - 1)];
  const options = visibleOptions(step, userBefore(answers, step.id));
  const picked = (answers[step.id] || []).filter(id => options.some(o => o.id === id));
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headRef.current?.focus(); }, [step.id]);

  const go = (next: Answers) => {
    const nextSteps = visibleSteps(next);
    const idx = nextSteps.findIndex(s => s.id === step.id);
    if (idx + 1 >= nextSteps.length) { onDone(); return; }
    setDir("fwd"); setI(idx + 1);
  };

  const pickSingle = (id: string) => {
    const next = { ...answers, [step.id]: [id] };
    setAnswers(next);
    window.setTimeout(() => go(next), 220);
  };

  const toggleMulti = (id: string, exclusive?: boolean) => {
    let cur = picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id];
    const exclusiveIds = options.filter(o => o.exclusive).map(o => o.id);
    if (exclusive && cur.includes(id)) cur = [id];
    else cur = cur.filter(x => !exclusiveIds.includes(x));
    setAnswers({ ...answers, [step.id]: cur });
  };

  const at = Math.min(i, steps.length - 1);
  const back = () => { if (at === 0) onExit(); else { setDir("back"); setI(at - 1); } };
  const pct = Math.round(((at + 1) / steps.length) * 100);

  return (
    <>
      <div className="band band-slim">
        <div className="wrap">
          <div className="progress" role="progressbar" aria-valuenow={at + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label="Progress">
            <span style={{ width: pct + "%" }} />
          </div>
        </div>
      </div>
      <section className="wrap stage">
        <div className={"slide " + dir} key={step.id}>
          <div className="step-meta">Question {at + 1} of {steps.length}</div>
          <h2 tabIndex={-1} ref={headRef}>{step.title}</h2>
          {step.hint && <p className="hint">{step.hint}</p>}
          <div className="options" role={step.multi ? "group" : "radiogroup"} aria-label={step.title}>
            {options.map(o => {
              const on = picked.includes(o.id);
              return (
                <button key={o.id} className={"option" + (on ? " on" : "")}
                  role={step.multi ? "checkbox" : "radio"} aria-checked={on}
                  onClick={() => step.multi ? toggleMulti(o.id, o.exclusive) : pickSingle(o.id)}>
                  <span className="opt-icon"><Icon name={o.icon} /></span>
                  <span className="opt-text"><span className="opt-label">{o.label}</span>{o.sub && <span className="opt-sub">{o.sub}</span>}</span>
                  {step.multi && <span className="tick" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="nav">
            <button className="btn-text" onClick={back}>← Back</button>
            {step.multi && <button className="btn-primary" disabled={!picked.length} onClick={() => go({ ...answers, [step.id]: picked })}>Continue</button>}
          </div>
        </div>
      </section>
    </>
  );
}
