"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./Spinner";

// Shown instead of the app while the account's email is unverified: the API refuses everything else until then.
export function VerifyEmail({ onVerified }: { onVerified: () => Promise<void> }) {
  const { user, sendVerification, refreshVerification, logOut } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "checking">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setError(null);
    setState("sending");
    try {
      await sendVerification();
      setState("sent");
    } catch {
      setError("Could not send the email. Wait a minute and try again.");
      setState("idle");
    }
  }

  async function recheck() {
    setError(null);
    setState("checking");
    try {
      await refreshVerification(); // reload the user and get a token that carries the new verified flag
      await onVerified(); // the app opens once /me reports the email as verified
    } catch {
      setError("Could not check right now. Try again.");
    } finally {
      setState("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="sheet w-full max-w-md space-y-4 p-6 sm:p-8">
        <p className="label">One more step</p>
        <h1 className="text-2xl font-bold">Verify your email</h1>
        <p className="text-sm leading-6 text-muted">
          We sent a link to <span className="font-semibold text-fg">{user?.email}</span>. Open it, then come back and press
          the button below. Check your spam folder if it doesn&apos;t arrive.
        </p>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <button onClick={() => void recheck()} disabled={state === "checking" || state === "sending"} className="btn-primary w-full">
          {state === "checking" ? <><Spinner /> Checking…</> : "I’ve verified it"}
        </button>
        <button onClick={() => void sendLink()} disabled={state === "checking" || state === "sending"} className="btn w-full">
          {state === "sending" ? <><Spinner /> Sending…</> : state === "sent" ? "Send the link again" : "Send the link"}
        </button>
        <button onClick={() => void logOut()} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Use a different account
        </button>
      </div>
    </main>
  );
}
