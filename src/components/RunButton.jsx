import { PlayIcon, StopIcon } from "./Icons";

export default function RunButton({ status, onRun, onStop }) {
  if (status === "running") {
    return (
      <button type="button" className="button button-stop" onClick={onStop}>
        <StopIcon /> Stop
      </button>
    );
  }
  const ready = status === "ready";
  return (
    <button
      type="button"
      className="button button-run"
      onClick={onRun}
      disabled={!ready}
      title={ready ? "Run (Ctrl/⌘ + Enter)" : undefined}
    >
      <PlayIcon /> {status === "loading" ? "Loading Python…" : "Run"}
    </button>
  );
}
