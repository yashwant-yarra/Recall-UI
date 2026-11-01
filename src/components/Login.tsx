"use client";

import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./Spinner";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
};

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "in" ? signIn(email, password) : signUp(email, password));
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(MESSAGES[code] ?? "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Recall</h1>
        <p className="mt-2 text-sm text-muted">
          Your documents and voice notes, searchable, with an agent that asks before it acts.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-1"
            />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner label="Signing in" /> : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
          className="mt-4 text-sm text-muted underline-offset-4 hover:underline"
        >
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
