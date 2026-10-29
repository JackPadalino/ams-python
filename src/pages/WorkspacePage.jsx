import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import CodeEditor from "../editor/CodeEditor";
import { usePythonRunner } from "../python/usePythonRunner";
import { explainError } from "../python/friendlyErrors";
import {
  MAX_CODE_LENGTH,
  createFile,
  deleteFile,
  normalizeFileName,
  renameFile,
  saveFile,
  setAutoIndentPreference,
  subscribeToMyFiles,
} from "../lib/files";
import FileSidebar from "../components/FileSidebar";
import FileNameModal from "../components/FileNameModal";
import Modal from "../components/Modal";
import OutputPanel from "../components/OutputPanel";
import RunButton from "../components/RunButton";
import Toggle from "../components/Toggle";
import ThemePicker from "../components/ThemePicker";
import { useToast } from "../components/Toast";
import { PlusIcon, SaveIcon, ShareIcon } from "../components/Icons";

const LAST_FILE_KEY = "ams.lastFileId";

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Optional convenience only.
  }
}

function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function WorkspacePage() {
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const runner = usePythonRunner();
  const editorRef = useRef(null);

  const [files, setFiles] = useState(null); // null = loading
  const [currentId, setCurrentId] = useState(null);
  const [openedCode, setOpenedCode] = useState(""); // code when the file was opened
  const [editorCode, setEditorCode] = useState("");
  const [runSource, setRunSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [autoIndent, setAutoIndent] = useState(profile?.autoIndent ?? true);

  const focusOnOpen = useRef(false);

  const currentFile = files?.find((f) => f.id === currentId) ?? null;
  const dirty = Boolean(currentFile) && editorCode !== currentFile.code;

  useEffect(() => {
    if (profile?.autoIndent !== undefined) setAutoIndent(profile.autoIndent);
  }, [profile?.autoIndent]);

  useEffect(
    () =>
      subscribeToMyFiles(user.uid, setFiles, (err) => {
        console.error(err);
        toast("Couldn't load your files. Try reloading the page.", "error");
      }),
    [user.uid, toast],
  );

  const openFile = useCallback((file) => {
    setCurrentId(file?.id ?? null);
    setOpenedCode(file?.code ?? "");
    setEditorCode(file?.code ?? "");
    if (file) remember(LAST_FILE_KEY, file.id);
  }, []);

  // Pick a file once the list arrives, or when the open file disappears.
  useEffect(() => {
    if (!files) return;
    if (currentId && files.some((f) => f.id === currentId)) return;
    const last = files.find((f) => f.id === recall(LAST_FILE_KEY));
    openFile(last ?? files[0] ?? null);
  }, [files, currentId, openFile]);

  // Put the cursor in the editor right after creating a file.
  useEffect(() => {
    if (currentFile && focusOnOpen.current) {
      focusOnOpen.current = false;
      editorRef.current?.focus();
    }
  }, [currentFile]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Runs `action` right away, or after asking what to do with unsaved changes.
  const guardUnsaved = (action) => {
    if (dirty) setModal({ type: "unsaved", then: action });
    else action();
  };

  const save = useCallback(async () => {
    if (!currentFile || saving) return true;
    const code = editorRef.current?.getValue() ?? editorCode;
    if (code.length > MAX_CODE_LENGTH) {
      toast("This file is too big to save.", "error");
      return false;
    }
    setSaving(true);
    try {
      await saveFile(currentFile.id, code);
      toast("Saved!", "success");
      return true;
    } catch (err) {
      console.error(err);
      toast("Couldn't save. Check your internet connection and try again.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentFile, editorCode, saving, toast]);

  const run = useCallback(() => {
    if (runner.status !== "ready") return;
    const code = editorRef.current?.getValue() ?? "";
    setRunSource(code);
    runner.runCode(code);
  }, [runner]);

  const errorLine = useMemo(() => {
    if (runner.result?.kind !== "error") return null;
    return explainError(runner.result, runSource).line;
  }, [runner.result, runSource]);

  const changeAutoIndent = (on) => {
    setAutoIndent(on);
    setAutoIndentPreference(user.uid, on).catch((err) => console.error(err));
  };

  const validateName = (ignoreId) => (raw) => normalizeFileName(raw, files ?? [], ignoreId);

  const copyShareLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied!", "success");
    } catch {
      toast("Couldn't copy. Select the link and copy it yourself.", "error");
    }
  };

  const shareLink = currentFile ? `${window.location.origin}/share/${currentFile.id}` : "";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">&gt;_</span>
          <span>AMS Python</span>
        </div>
        <div className="top-bar-right">
          <ThemePicker />
          <Toggle
            label="Auto-indent"
            checked={autoIndent}
            onChange={changeAutoIndent}
            title="When on, pressing Enter after a line ending in : indents the next line for you."
          />
          <span className="username">{profile?.username}</span>
          <button type="button" className="button button-quiet button-small" onClick={() => guardUnsaved(signOut)}>
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace">
        {files && files.length > 0 && (
          <FileSidebar
            files={files}
            currentId={currentId}
            dirty={dirty}
            onOpen={(id) => id !== currentId && guardUnsaved(() => openFile(files.find((f) => f.id === id)))}
            onNew={() => guardUnsaved(() => setModal({ type: "new" }))}
            onRename={(file) => setModal({ type: "rename", file })}
            onDelete={(file) => setModal({ type: "delete", file })}
          />
        )}

        {files === null && <div className="page-loading">Loading your files…</div>}

        {files?.length === 0 && (
          <div className="empty-state">
            <h1>Welcome, {profile?.username}!</h1>
            <p>Create your first Python file to get started.</p>
            <button type="button" className="button button-primary" onClick={() => setModal({ type: "new" })}>
              <PlusIcon /> New file
            </button>
          </div>
        )}

        {currentFile && (
          <>
            <section className="editor-panel" aria-label="Code editor">
              <header className="panel-header editor-toolbar">
                <h2 className="current-file">
                  {currentFile.name}
                  <span className={`save-state ${dirty ? "is-dirty" : ""}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
                </h2>
                <div className="toolbar-actions">
                  <button type="button" className="button button-quiet" onClick={() => setModal({ type: "share" })}>
                    <ShareIcon /> Share
                  </button>
                  <button type="button" className="button" onClick={save} disabled={!dirty || saving} title="Save (Ctrl/⌘ + S)">
                    <SaveIcon /> {saving ? "Saving…" : "Save"}
                  </button>
                  <RunButton status={runner.status} onRun={run} onStop={() => runner.stop()} />
                </div>
              </header>
              <CodeEditor
                ref={editorRef}
                docKey={currentId}
                initialValue={openedCode}
                onChange={setEditorCode}
                autoIndent={autoIndent}
                blockPaste
                onPasteBlocked={() => toast("Pasting is turned off. Type your code yourself!", "info")}
                errorLine={errorLine}
                onRun={run}
                onSave={save}
              />
            </section>
            <OutputPanel runner={runner} source={runSource} onGoToLine={(n) => editorRef.current?.goToLine(n)} />
          </>
        )}
      </div>

      {modal?.type === "new" && (
        <FileNameModal
          title="New file"
          confirmLabel="Create"
          validate={validateName(null)}
          onClose={() => setModal(null)}
          onConfirm={async (name) => {
            const id = await createFile({ uid: user.uid, username: profile.username, name });
            setModal(null);
            focusOnOpen.current = true;
            openFile({ id, code: "" });
          }}
        />
      )}

      {modal?.type === "rename" && (
        <FileNameModal
          title="Rename file"
          initialName={modal.file.name}
          confirmLabel="Rename"
          validate={validateName(modal.file.id)}
          onClose={() => setModal(null)}
          onConfirm={async (name) => {
            await renameFile(modal.file.id, name);
            setModal(null);
          }}
        />
      )}

      {modal?.type === "delete" && (
        <Modal
          title={`Delete ${modal.file.name}?`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="button button-danger"
                onClick={async () => {
                  try {
                    await deleteFile(modal.file.id);
                    toast(`Deleted ${modal.file.name}.`);
                  } catch {
                    toast("Couldn't delete the file. Try again.", "error");
                  }
                  setModal(null);
                }}
              >
                Delete forever
              </button>
            </>
          }
        >
          <p>This can't be undone. Any share links to this file will stop working.</p>
        </Modal>
      )}

      {modal?.type === "unsaved" && (
        <Modal
          title={`Save changes to ${currentFile?.name}?`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  const then = modal.then;
                  setModal(null);
                  then();
                }}
              >
                Don't save
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={async () => {
                  const then = modal.then;
                  if (await save()) {
                    setModal(null);
                    then();
                  }
                }}
              >
                Save
              </button>
            </>
          }
        >
          <p>You have changes that aren't saved yet.</p>
        </Modal>
      )}

      {modal?.type === "share" && (
        <Modal
          title={`Share ${currentFile?.name}`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Done</button>
              <button type="button" className="button button-primary" onClick={() => copyShareLink(shareLink)}>Copy link</button>
            </>
          }
        >
          <p>Anyone with this link can see and run your code. They can't change your file.</p>
          <input className="share-link" value={shareLink} readOnly onFocus={(e) => e.target.select()} />
          {dirty && (
            <p className="share-warning">
              The link shows your last <strong>saved</strong> version.{" "}
              <button type="button" className="link-button" onClick={save}>Save now</button> so your latest changes are included.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
