import { useId, useState } from "react";

/** A ↗ button that would leave the app in production. Here it only explains where it would go. */
export default function InfoLink({ label, title, body }: { label: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button className="ext" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </button>
      {open && (
        <div className="infobar" id={id} role="status">
          <div><b>{title}</b><span>{body}</span></div>
          <button className="infobar-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
        </div>
      )}
    </>
  );
}
