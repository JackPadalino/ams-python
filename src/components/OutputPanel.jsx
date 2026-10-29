import { useEffect, useMemo, useRef, useState } from "react";
import { explainError } from "../python/friendlyErrors";
import ErrorCard from "./ErrorCard";

function statusText(status, waitingForInput) {
  if (status === "loading") return "Getting Python ready…";
  if (status === "running") return waitingForInput ? "Waiting for you to type…" : "Running…";
  return "";
}

function ResultNote({ result, source, onGoToLine }) {
  const explanation = useMemo(
    () => (result?.kind === "error" ? explainError(result, source) : null),
    [result, source],
  );
  if (!result) return null;

  switch (result.kind) {
    case "finished":
      return <p className="output-note">Program finished.</p>;
    case "stopped":
      return <p className="output-note">Program stopped.</p>;
    case "timeout":
      return (
        <div className="error-card">
          <p className="error-headline">Your program ran for 30 seconds, so we stopped it.</p>
          <p className="error-details">
            Check for a loop that never ends, like <code>while True:</code> without a <code>break</code>, or a
            while loop whose condition never becomes False.
          </p>
        </div>
      );
    case "output_limit":
      return (
        <div className="error-card">
          <p className="error-headline">Your program printed way too much, so we stopped it.</p>
          <p className="error-details">This usually means a loop is running forever. Check your loops.</p>
        </div>
      );
    case "error":
      return (
        <ErrorCard
          explanation={explanation}
          traceback={result.traceback}
          codeLine={explanation.line ? source.split("\n")[explanation.line - 1] : ""}
          onGoToLine={onGoToLine}
        />
      );
    default:
      return (
        <div className="error-card">
          <p className="error-headline">Something went wrong inside the coding environment.</p>
          <p className="error-details">Try running your program again. If it keeps happening, reload the page.</p>
        </div>
      );
  }
}

export default function OutputPanel({ runner, source, onGoToLine }) {
  const { status, waitingForInput, output, result, sendInput, clearOutput } = runner;
  const [answer, setAnswer] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output, result, waitingForInput]);

  useEffect(() => {
    if (waitingForInput) {
      setAnswer("");
      inputRef.current?.focus();
    }
  }, [waitingForInput]);

  const submit = (e) => {
    e.preventDefault();
    sendInput(answer);
    setAnswer("");
  };

  const empty = !output.length && !result && status !== "running";

  return (
    <section className="output-panel" aria-label="Program output">
      <header className="panel-header">
        <h2>Output</h2>
        <span className={`output-status ${waitingForInput ? "is-waiting" : ""}`}>{statusText(status, waitingForInput)}</span>
        <button type="button" className="button button-quiet button-small" onClick={clearOutput} disabled={status === "running" || empty}>
          Clear
        </button>
      </header>
      <div className="output-scroll" ref={scrollRef}>
        {status === "unsupported" && (
          <div className="error-card">
            <p className="error-headline">This browser can't run Python here.</p>
            <p className="error-details">Please use an up-to-date Chrome or Safari.</p>
          </div>
        )}
        {status === "failed" && (
          <div className="error-card">
            <p className="error-headline">Python couldn't start.</p>
            <p className="error-details">Check your internet connection and reload the page.</p>
          </div>
        )}
        {empty && status !== "unsupported" && status !== "failed" && (
          <p className="output-placeholder">Press Run to see what your program does.</p>
        )}
        <pre className="output-text">
          {output.map((chunk, i) => (
            <span key={i} className={`out-${chunk.kind}`}>
              {chunk.text}
            </span>
          ))}
          {waitingForInput && (
            <form className="input-inline" onSubmit={submit}>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                aria-label="Type your answer and press Enter"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </form>
          )}
        </pre>
        {waitingForInput && <p className="input-hint">Type your answer and press Enter ↵</p>}
        <ResultNote result={result} source={source} onGoToLine={onGoToLine} />
      </div>
    </section>
  );
}
