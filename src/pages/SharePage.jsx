import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CodeEditor from "../editor/CodeEditor";
import { usePythonRunner } from "../python/usePythonRunner";
import { explainError } from "../python/friendlyErrors";
import { getSharedFile } from "../lib/files";
import OutputPanel from "../components/OutputPanel";
import RunButton from "../components/RunButton";
import Toggle from "../components/Toggle";
import ThemePicker from "../components/ThemePicker";
import { ResetIcon } from "../components/Icons";

// Read-only view of a student's latest saved file. The viewer can edit the
// code to try things out, but nothing here is ever saved.
export default function SharePage() {
  const { fileId } = useParams();
  const runner = usePythonRunner();
  const editorRef = useRef(null);

  const [file, setFile] = useState(undefined); // undefined = loading, null = missing
  const [loadCount, setLoadCount] = useState(0); // bump to reload the editor
  const [edited, setEdited] = useState(false);
  const [runSource, setRunSource] = useState("");
  const [autoIndent, setAutoIndent] = useState(true);

  const load = useCallback(async () => {
    try {
      const f = await getSharedFile(fileId);
      setFile(f);
      setEdited(false);
      setLoadCount((n) => n + 1);
    } catch (err) {
      console.error(err);
      setFile(null);
    }
  }, [fileId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(() => {
    if (runner.status !== "ready") return;
    const code = editorRef.current?.getValue() ?? "";
    setRunSource(code);
    runner.runCode(code);
  }, [runner]);

  const errorLine = useMemo(
    () => (runner.result?.kind === "error" ? explainError(runner.result, runSource).line : null),
    [runner.result, runSource],
  );

  if (file === undefined) return <div className="page-loading">Loading…</div>;

  if (file === null) {
    return (
      <main className="login-page">
        <div className="login-card">
          <h1>This link doesn't work</h1>
          <p>The file may have been deleted, or the link was copied incorrectly.</p>
          <Link to="/" className="button button-primary">Go to AMS Python</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">&gt;_</span>
          <span>AMS Python</span>
        </div>
        <div className="top-bar-right">
          <ThemePicker />
          <Toggle label="Auto-indent" checked={autoIndent} onChange={setAutoIndent} />
        </div>
      </header>
      <div className="share-banner">
        You're viewing <strong>{file.ownerUsername}</strong>'s file. You can edit and run the code to test it, but your
        changes won't be saved.
      </div>
      <div className="workspace workspace-share">
        <section className="editor-panel" aria-label="Code editor">
          <header className="panel-header editor-toolbar">
            <h2 className="current-file">
              {file.name}
              {edited && <span className="save-state is-dirty">Edited (not saved)</span>}
            </h2>
            <div className="toolbar-actions">
              <button type="button" className="button button-quiet" onClick={load} title="Throw away your edits and load the latest saved version">
                <ResetIcon /> {edited ? "Reset to saved version" : "Reload"}
              </button>
              <RunButton status={runner.status} onRun={run} onStop={() => runner.stop()} />
            </div>
          </header>
          <CodeEditor
            ref={editorRef}
            docKey={loadCount}
            initialValue={file.code}
            onChange={() => setEdited(true)}
            autoIndent={autoIndent}
            blockPaste={false}
            errorLine={errorLine}
            onRun={run}
          />
        </section>
        <OutputPanel runner={runner} source={runSource} onGoToLine={(n) => editorRef.current?.goToLine(n)} />
      </div>
    </div>
  );
}
