import { useState } from "react";

const SHOW_REAL_KEY = "ams.showRealErrors";

function readPreference() {
  try {
    return localStorage.getItem(SHOW_REAL_KEY) === "1";
  } catch {
    return false;
  }
}

export default function ErrorCard({ explanation, traceback, codeLine, onGoToLine }) {
  const [showReal, setShowReal] = useState(readPreference);

  const toggle = () => {
    const next = !showReal;
    setShowReal(next);
    try {
      localStorage.setItem(SHOW_REAL_KEY, next ? "1" : "0");
    } catch {
      // Remembering the choice is optional.
    }
  };

  const { headline, details, example, line } = explanation;
  return (
    <div className="error-card" role="alert">
      <p className="error-headline">{headline}</p>
      {line && codeLine?.trim() && (
        <button type="button" className="error-code-line" onClick={() => onGoToLine?.(line)} title="Jump to this line">
          <span className="error-line-number">Line {line}</span>
          <code>{codeLine.trim()}</code>
        </button>
      )}
      {details && <p className="error-details">{details}</p>}
      {example && (
        <div className="error-example">
          <span>Example:</span>
          <pre>{example}</pre>
        </div>
      )}
      {traceback && (
        <>
          <button type="button" className="link-button" onClick={toggle} aria-expanded={showReal}>
            {showReal ? "Hide real Python error" : "Show real Python error"}
          </button>
          {showReal && <pre className="error-traceback">{traceback}</pre>}
        </>
      )}
    </div>
  );
}
