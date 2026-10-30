import { useEffect, useState } from "react";
import Builder from "./components/Builder";
import RuleCheck from "./components/RuleCheck";
import { ALL, SCENARIOS } from "./data";
import type { User } from "./engine/rules";

type Tab = "build" | "check";

function initialTheme(): "dark" | "light" {
  try { return (localStorage.getItem("jrm-theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("build");
  const [theme, setTheme] = useState(initialTheme);
  const [base, setBase] = useState<User>(SCENARIOS[0]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("jrm-theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const openUser = (id: string) => {
    const u = ALL.find(x => x.user_id === id);
    if (!u) return;
    setBase(u);
    setTab("build");
    window.scrollTo({ top: (document.querySelector("main") as HTMLElement).offsetTop - 70 });
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = tab === "build" ? "check" : "build";
      setTab(next);
      document.getElementById("tab-" + next)?.focus();
    }
  };

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand"><span className="mark" aria-hidden="true" />Juno Risk Machine <span className="ver">v1</span></div>
          <div className="tabs" role="tablist" aria-label="View" onKeyDown={onTabKey}>
            <button className="tab" role="tab" id="tab-build" aria-controls="view-build" aria-selected={tab === "build"} onClick={() => setTab("build")}>Build a user</button>
            <button className="tab" role="tab" id="tab-check" aria-controls="view-check" aria-selected={tab === "check"} onClick={() => setTab("check")}>Rule check</button>
          </div>
          <button className="icon-btn" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-in">
          <div className="kicker">Case study: Juno Finance, fraud and risk</div>
          <h1>Catch the fraud. Not the customer.</h1>
          <p className="sub">At Juno, money that left as crypto was gone for good. I designed controls that let money in but stopped it from going out. Build a user below and watch the rules decide.</p>
          <div className="chips">
            <span className="chip">$1B TPV</span><span className="chip">300K+ users</span>
            <span className="chip">Onboarding fraud ↓ ~30%</span><span className="chip">Transaction fraud ↓ up to 20%</span>
          </div>
        </div>
      </section>

      <main>
        <section id="view-build" role="tabpanel" aria-labelledby="tab-build" hidden={tab !== "build"}>
          <Builder base={base} onPick={openUser} showBar={tab === "build"} />
        </section>
        <section id="view-check" role="tabpanel" aria-labelledby="tab-check" hidden={tab !== "check"}>
          <RuleCheck onOpen={openUser} />
        </section>
      </main>

      <footer>
        <div className="in">
          <span>All users are synthetic. Rules mirror logic I designed at Juno Finance; thresholds are illustrative.</span>
          <nav><a href="#">Portfolio</a><a href="#">LinkedIn</a><a href="#">Email</a></nav>
        </div>
      </footer>
    </>
  );
}
