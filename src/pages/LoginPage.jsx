import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please type your username and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(
        err.code === "auth/too-many-requests"
          ? "Too many tries. Wait a minute and try again."
          : err.code === "auth/network-request-failed"
            ? "Can't connect. Check your internet connection."
            : "That username or password isn't right. Check the spelling and try again.",
      );
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand brand-large">
          <span className="brand-mark">&gt;_</span>
          <span>AMS Python</span>
        </div>
        <p className="login-subtitle">Sign in to write and run your Python code.</p>
        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            placeholder="e.g. jsmith2029"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary button-block" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
