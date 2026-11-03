import { useEffect, useState } from "react";

export default function Loader({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const a = window.setTimeout(() => setDone(true), fast ? 500 : 1500);
    const b = window.setTimeout(onDone, fast ? 1100 : 2500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <section className="loader" aria-live="polite">
      {done ? (
        <>
          <span className="done-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4L18 8" /></svg></span>
          <p className="loader-text">User persona created</p>
        </>
      ) : (
        <>
          <span className="spinner" aria-hidden="true" />
          <p className="loader-text">Creating user persona…</p>
        </>
      )}
    </section>
  );
}
