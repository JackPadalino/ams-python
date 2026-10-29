import { useState } from "react";
import Modal from "./Modal";

export default function FileNameModal({ title, initialName = "", confirmLabel, validate, onConfirm, onClose }) {
  const [value, setValue] = useState(initialName.replace(/\.py$/, ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const result = validate(value);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(result.name);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>File name</span>
          <div className="filename-input">
            <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus spellCheck="false" maxLength={44} />
            <span>.py</span>
          </div>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
}
