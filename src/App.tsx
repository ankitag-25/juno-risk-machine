import { useCallback, useState } from "react";
import Loader from "./components/Loader";
import Result from "./components/Result";
import Welcome from "./components/Welcome";
import Wizard from "./components/Wizard";
import { buildUser, visibleSteps, type Answers } from "./flow/steps";

type Screen = "welcome" | "questions" | "loading" | "result";

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [answers, setAnswers] = useState<Answers>({});
  const [startAt, setStartAt] = useState(0);
  const finish = useCallback(() => setScreen("result"), []);

  const restart = () => { setAnswers({}); setStartAt(0); setScreen("questions"); window.scrollTo(0, 0); };

  return (
    <div className="app">
      <header className="top">
        <div className="wrap top-in">
          <button className="logo" onClick={() => { setAnswers({}); setScreen("welcome"); }} aria-label="Risk Machine home">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" /></svg>
            <span>Risk Machine</span>
          </button>
          <span className="top-tag">Juno Finance case study</span>
        </div>
      </header>

      <main>
        {screen === "welcome" && <Welcome onStart={() => { setStartAt(0); setScreen("questions"); }} />}
        {screen === "questions" && (
          <Wizard answers={answers} setAnswers={setAnswers} startAt={startAt}
            onDone={() => setScreen("loading")} onExit={() => setScreen("welcome")} />
        )}
        {screen === "loading" && <Loader onDone={finish} />}
        {screen === "result" && (
          <Result user={buildUser(answers)} seed={JSON.stringify(answers)} onRestart={restart}
            onEdit={() => { setStartAt(visibleSteps(answers).length - 1); setScreen("questions"); }} />
        )}
      </main>

      <footer>
        <div className="wrap foot">
          <span>All users are synthetic. Rules mirror logic I designed at Juno Finance; thresholds are illustrative.</span>
          <nav><a href="#">Portfolio</a><a href="#">LinkedIn</a><a href="#">Email</a></nav>
        </div>
      </footer>
    </div>
  );
}
