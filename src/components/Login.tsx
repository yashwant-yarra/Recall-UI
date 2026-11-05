"use client";

import { Logo } from "./Logo";

import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { LegalLinks } from "./LegalLinks";
import { Spinner } from "./Spinner";
import { ThemeToggle } from "./ThemeToggle";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and try again.",
  "auth/popup-closed-by-user": "The sign-in window was closed. Please try again.",
  "auth/account-exists-with-different-credential": "An account with this email already exists. Sign in using your original method.",
  "auth/operation-not-allowed": "This sign-in method is not enabled yet.",
  "auth/unauthorized-domain": "Sign-in is not available on this site address.",
};

function ProviderIcon({ provider }: { provider: "google" | "github" | "microsoft" }) {
  if (provider === "microsoft") return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" /><path fill="#7fba00" d="M13 1h10v10H13z" />
      <path fill="#00a4ef" d="M1 13h10v10H1z" /><path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
  );
  if (provider === "github") return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.16c-3.09.67-3.74-1.31-3.74-1.31-.5-1.27-1.23-1.61-1.23-1.61-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.46-.28-5.05-1.23-5.05-5.49 0-1.21.43-2.2 1.14-2.98-.12-.28-.49-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.14 3.05-1.14.6 1.53.23 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.27-2.6 5.2-5.07 5.48.4.35.75 1.02.75 2.06V22c0 .29.2.64.77.53A11.1 11.1 0 0 0 12 .9z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#4285f4" d="M22.6 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.94a5.08 5.08 0 0 1-2.2 3.33v2.77h3.57c2.09-1.93 3.29-4.78 3.29-8.11z" />
      <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.64l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.87 0-5.31-1.94-6.18-4.55H2.13v2.85A11 11 0 0 0 12 23z" />
      <path fill="#fbbc05" d="M5.82 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.13a11 11 0 0 0 0 9.9l3.69-2.85z" />
      <path fill="#ea4335" d="M12 5.35c1.62 0 3.07.56 4.21 1.65l3.15-3.15A10.57 10.57 0 0 0 12 1a11 11 0 0 0-9.87 6.05L5.82 9.9C6.69 7.29 9.13 5.35 12 5.35z" />
    </svg>
  );
}

export function Login() {
  const { signIn, signUp, signInWithProvider } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | "github" | "microsoft" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    try {
      await (mode === "in" ? signIn(email, password) : signUp(email, password));
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(MESSAGES[code] ?? "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function providerSignIn(provider: "google" | "github" | "microsoft") {
    setBusy(provider);
    setError(null);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(MESSAGES[code] ?? "Sign-in failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:flex lg:items-center lg:py-10">
      <div className="mx-auto grid w-full max-w-xl gap-10 lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-14">
        <section className="login-intro min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            <ThemeToggle compact />
          </div>
          <h1 className="login-title mt-12 max-w-3xl">
            Everything you <span className="hl hl-solid hl-n1">learn,</span> <span className="hl hl-solid hl-n2">within reach.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted">
            Bring your documents and voice notes together. Ask questions, talk through ideas, and turn what you find into action.
          </p>
          {/* A sample page: what an answer looks like, with its numbered sources in the ruled margin. */}
          <div aria-hidden="true" className="login-example sheet">
            <div>
              <p className="text-[1.05rem] font-semibold text-accent">Why does ice float on water?</p>
              <p className="mt-3 text-[0.97rem] leading-7">
                <span className="hl-quiet hl-n1" data-on="true">Water expands as it freezes, so ice is less dense than liquid water.</span>
                <sup><span className="hl hl-solid hl-n1 ml-0.5 inline-block rounded-[2px] px-1 text-[0.95em] leading-[1.35] font-bold">1</span></sup>{" "}
                <span className="hl-quiet hl-n2">Hydrogen bonds hold the molecules in an open lattice.</span>
                <sup><span className="hl hl-solid hl-n2 ml-0.5 inline-block rounded-[2px] px-1 text-[0.95em] leading-[1.35] font-bold">2</span></sup>
              </p>
            </div>
            <div className="margin">
              <p className="label">Sources</p>
              <p className="mt-2 text-sm"><span className="hl hl-solid hl-n1 px-0.5"><b>1</b> physics-notes.pdf, p. 12</span></p>
              <p className="mt-2 text-sm"><span className="hl hl-solid hl-n2 px-0.5"><b>2</b> chemistry-ch4.pdf, p. 3</span></p>
            </div>
          </div>
        </section>
        <section className="w-full lg:max-w-md lg:justify-self-end">
        <form onSubmit={submit} className="login-form sheet space-y-4">
          <div className="chapter-band !mb-6">
            <h2 className="chapter !text-4xl">{mode === "in" ? "Pick up where you left off" : "Start your study space"}</h2>
          </div>
          <p className="-mt-2 text-sm text-muted">{mode === "in" ? "Sign in to continue to your workspace." : "Choose how you’d like to create your account."}</p>

          {([ ["google", "Google"], ["github", "GitHub"], ["microsoft", "Microsoft"] ] as const).map(([provider, name]) => (
            <button key={provider} type="button" onClick={() => void providerSignIn(provider)} disabled={!!busy} className="btn w-full">
              {busy === provider ? <><Spinner /> Connecting to {name}…</> : <><ProviderIcon provider={provider} /> Continue with {name}</>}
            </button>
          ))}
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div>

          <label className="block">
            <span className="label">Email</span>
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
            <span className="label">Password</span>
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
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <button type="submit" disabled={!!busy} className="btn-primary w-full">
            {busy === "email" ? <Spinner label="Signing in" /> : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
          className="mt-4 text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        </section>
      </div>
    </main>
    <div className="px-4 pb-8 sm:px-8">
      <LegalLinks className="mx-auto max-w-xl lg:max-w-6xl" />
    </div>
    </>
  );
}
