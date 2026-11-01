"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Spinner } from "./Spinner";

// For display only; the API enforces the real limits (its DAILY_* settings).
const LIMITS = [
  { label: "Uploads per day", free: 10, pro: 50 },
  { label: "Questions per day", free: 40, pro: 500 },
  { label: "Quizzes per day", free: 5, pro: 30 },
  { label: "Agent runs per day", free: 15, pro: 50 },
];

export function Account({ me, onPlanChange }: { me: Me | null; onPlanChange: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle");
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);
  // Once the webhook has made the user Pro, stop waiting.
  useEffect(() => {
    if (me?.plan === "pro" && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
      setState("idle");
    }
  }, [me?.plan]);

  async function upgrade() {
    setError(null);
    setState("opening");
    // Open the tab now, inside the click: browsers block popups opened later, after an await.
    const tab = window.open("", "_blank");
    try {
      // An empty JSON body: a body-less POST can be refused with 411 by Google's front end.
      const { url } = await api<{ url: string }>("/api/v1/billing/checkout", { method: "POST", body: {} });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      // The plan changes only when Razorpay's webhook arrives, so check every few seconds (up to 5 min).
      setState("waiting");
      let tries = 0;
      poll.current = setInterval(() => {
        if (++tries > 100 && poll.current) { clearInterval(poll.current); setState("idle"); }
        void onPlanChange();
      }, 3000);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
      setState("idle");
    }
  }

  const pro = me?.plan === "pro";
  return (
    <section className="max-w-xl space-y-6">
      <div className="sheet px-5 py-6 sm:px-8">
        <p className="label">Current plan</p>
        <p className="chapter mt-2 !text-5xl">{me ? (pro ? "Pro" : "Free") : <Spinner className="h-6 w-6" label="Loading plan" />}</p>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-normal"></th>
              {(["Free", "Pro"] as const).map((p) => (
                <th key={p} className="w-20 pb-2 font-bold">
                  {/* Your plan's column is the one highlighted. */}
                  <span className={me && (p === "Pro") === pro ? "hl hl-solid hl-n1 px-1" : ""}>{p}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIMITS.map((l) => (
              <tr key={l.label} className="border-t border-border">
                <td className="py-2.5 text-muted">{l.label}</td>
                <td className={`py-2.5 ${!pro ? "font-bold" : ""}`}>{l.free}</td>
                <td className={`py-2.5 ${pro ? "font-bold" : ""}`}>{l.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pro && (
          <button onClick={() => void upgrade()} disabled={state !== "idle" || !me} className="btn-primary mt-5">
            {state === "opening" ? <><Spinner /> Opening Razorpay…</> : state === "waiting" ? <><Spinner /> Waiting for payment…</> : "Upgrade to Pro"}
          </button>
        )}
        {state === "waiting" && (
          <p className="mt-2 text-xs text-muted">Finish paying in the Razorpay tab. This page updates by itself once the payment is confirmed.</p>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
