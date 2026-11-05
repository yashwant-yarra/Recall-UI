"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Me, Tier } from "@/lib/types";
import { Spinner } from "./Spinner";
import { useAuth } from "./AuthProvider";
import { loadCashfree } from "@/lib/cashfree";
import { inr, PRICES } from "@/lib/legal";

// The plan table comes from the API (`me.limits`), so it always shows the limits the server enforces.
const cell = (n: number | null) => (n === null ? "Unlimited" : n === 0 ? "Not included" : n.toLocaleString());
const TIER_NAME: Record<string, string> = { free: "Free", pro: "Pro", ultra: "Ultra" };
// Buying is hidden until NEXT_PUBLIC_PAYMENTS_ENABLED=true (apphosting.yaml). Switch to Free stays for anyone paying.
const PAYMENTS_ON = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
const RAZORPAY_ON = process.env.NEXT_PUBLIC_RAZORPAY_ENABLED === "true";

export function Account({ me, onPlanChange, onTrial }: { me: Me | null; onPlanChange: () => Promise<void>; onTrial: () => Promise<void> }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"cashfree" | "razorpay">("cashfree");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);
  const [buying, setBuying] = useState<Tier | null>(null); // the tier whose checkout is open or being waited for
  // paid_until when checkout opened. A paid link always moves it (a first pass or 30 more days), so a
  // change means the webhook has landed, for new passes and extensions alike.
  const paidUntilAtStart = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (buying && me && me.paid_until !== paidUntilAtStart.current && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
      setState("idle");
      setBuying(null);
    }
  }, [me, buying]);
  // Cashfree needs a mobile number for every order. Accepts spaces, dashes, +91 or a leading 0.
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false); // left the field once: show what's wrong
  const digits = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  const phoneProblem =
    /^[1-5]/.test(digits) ? "Indian mobile numbers start with 6, 7, 8 or 9."
    : digits.length < 10 ? "Enter your 10-digit mobile number."
    : digits.length > 10 ? "That’s more than 10 digits."
    : !/^[6-9]/.test(digits) ? "Indian mobile numbers start with 6, 7, 8 or 9."
    : /^(\d)\1{9}$/.test(digits) ? "Enter a real mobile number."
    : null;
  const phoneOk = phoneProblem === null;
  // Too short is only an error once they've left the field; anything else shows as soon as it's typed.
  const showPhoneProblem = !!phoneProblem && (phoneTouched || digits.length >= 10 || /^[1-5]/.test(digits));
  const [wiping, setWiping] = useState<"idle" | "confirming" | "deleting">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [wipeError, setWipeError] = useState<string | null>(null);
  async function wipe() {
    setWipeError(null);
    setWiping("deleting");
    try {
      await api("/api/v1/data", { method: "DELETE" });
      // Library, Ask history and the rest stay mounted with the old data, so start fresh.
      window.location.reload();
    } catch (e) {
      setWipeError((e as Error).message);
      setWiping("confirming");
    }
  }
  // The trial needs a verified email. Sending the link and rechecking are both here, so the user never leaves Account.
  const { sendVerification, refreshVerification } = useAuth();
  const [verify, setVerify] = useState<"idle" | "sending" | "sent" | "checking">("idle");
  async function sendLink() {
    setError(null);
    setVerify("sending");
    try {
      await sendVerification();
      setVerify("sent");
    } catch (e) {
      setError((e as Error).message);
      setVerify("idle");
    }
  }
  async function recheck() {
    setError(null);
    setVerify("checking");
    try {
      await refreshVerification(); // reload the user and get a token that carries the new verified flag
      await onPlanChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerify("sent");
    }
  }
  const [trialBusy, setTrialBusy] = useState(false);
  async function startTrial() {
    setError(null);
    setTrialBusy(true);
    try {
      await onTrial();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrialBusy(false);
    }
  }
  const trialEnds = me?.trial?.ends_at ? new Date(me.trial.ends_at).toLocaleDateString(undefined, { dateStyle: "long" }) : null;
  const paidUntil = me?.paid_until ? new Date(me.paid_until).toLocaleDateString(undefined, { dateStyle: "long" }) : null;

  async function upgrade(tier: Tier) {
    const paymentWindow = provider === "razorpay" ? window.open("", "_blank") : null;
    if (provider === "razorpay" && !paymentWindow) {
      setError("Allow pop-ups to open the payment link, then try again.");
      return;
    }
    setError(null);
    setBuying(tier);
    setState("opening");
    paidUntilAtStart.current = me?.paid_until ?? null;
    try {
      if (paymentWindow) {
        paymentWindow.opener = null;
        const link = await api<{ payment_url: string }>("/api/v1/billing/checkout", { method: "POST", body: { tier, phone: digits, provider } });
        paymentWindow.location.href = link.payment_url;
        setState("waiting");
        let tries = 0;
        poll.current = setInterval(() => {
          if (++tries > 200 && poll.current) { clearInterval(poll.current); poll.current = null; setState("idle"); setBuying(null); }
          void onPlanChange();
        }, 3000);
        return;
      }
      const [order, Cashfree] = await Promise.all([
        api<{ payment_session_id: string; mode: "sandbox" | "production" }>("/api/v1/billing/checkout", { method: "POST", body: { tier, phone: digits } }),
        loadCashfree(),
      ]);
      // Cashfree's checkout opens as a popup over this page and resolves when it closes, so the user never
      // leaves Recall. (In some in-app browsers it redirects instead and comes back to the return URL.)
      const result = await Cashfree({ mode: order.mode }).checkout({ paymentSessionId: order.payment_session_id, redirectTarget: "_modal" });
      if (result.redirect) return;
      if (!result.paymentDetails) {
        // Closed or failed: nothing to wait for. One check in case the payment went through just before closing.
        await onPlanChange();
        setState("idle");
        setBuying(null);
        return;
      }
      // Paid. The pass is granted when Cashfree's webhook arrives (usually within seconds): check every few
      // seconds, up to 2 minutes. The effect above stops this as soon as paid_until moves.
      setState("waiting");
      void onPlanChange();
      let tries = 0;
      poll.current = setInterval(() => {
        if (++tries > 40 && poll.current) { clearInterval(poll.current); poll.current = null; setState("idle"); setBuying(null); }
        void onPlanChange();
      }, 3000);
    } catch (e) {
      paymentWindow?.close();
      setError((e as Error).message);
      setState("idle");
      setBuying(null);
    }
  }

  const paid = !!me && me.plan !== "free";
  const trialing = me?.plan === "free" && !!me.trial?.active;
  const planName = me ? (paid ? TIER_NAME[me.plan] : trialing ? "Trial" : "Free") : null;
  const busy = state === "opening" || state === "waiting";
  // The column that is yours is highlighted; during the trial that is Pro, the tier it gives.
  const mine = me ? (paid ? me.plan : trialing ? "pro" : "free") : null;
  const buyLabel = (tier: Tier, text: string) =>
    buying === tier && state === "opening" ? <><Spinner /> Opening {provider === "razorpay" ? "Razorpay" : "Cashfree"}…</> : buying === tier && state === "waiting" ? <><Spinner /> Checking payment…</> : text;
  return (
    <section className="max-w-4xl space-y-6">
      <p className="max-w-[65ch] text-sm text-muted">Your account details and plan.</p>
      {/* Who you are and what you're on, in one compact row; the plan table below gets the full width. */}
      <div className="sheet flex flex-wrap items-end justify-between gap-x-10 gap-y-4 px-5 py-6 sm:px-8">
        <div className="min-w-0">
          <p className="label">Signed in as</p>
          <p className="mt-2 break-all text-lg font-semibold">{user?.email ?? "Email unavailable"}</p>
        </div>
        <div>
          <p className="label">Current plan</p>
          <p className="chapter mt-1 !text-5xl">{planName ?? <Spinner className="h-6 w-6" label="Loading plan" />}</p>
        </div>
      </div>
      <div className="sheet px-5 py-6 sm:px-8">
        <h2 className="text-xl font-semibold">Your weekly allowance</h2>
        <p className="mt-1 text-sm text-muted">Compare what’s included with each plan. Paid plans are one-time 30-day passes; nothing renews automatically.</p>
        <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="w-2/5 pb-2 font-normal"></th>
              {(["free", "pro", "ultra"] as const).map((p) => (
                <th key={p} className="w-1/5 pb-2 pr-2 font-bold">
                  <span className={mine === p ? "hl hl-solid hl-n1 px-1" : ""}>{TIER_NAME[p]}</span>
                  <span className="mt-1 block text-base font-semibold text-fg">{p === "free" ? "₹0" : inr(PRICES[p])}</span>
                  <span className="block text-xs font-normal">{p === "free" ? "forever" : "per 30 days"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(me?.limits ?? []).map((l) => (
              <tr key={l.key} className="border-t border-border">
                <td className="py-2.5 pr-3 text-muted">{l.label}</td>
                {(["free", "pro", "ultra"] as const).map((p) => (
                  <td key={p} className={`py-2.5 pr-2 ${mine === p ? "font-bold" : ""} ${l[p] === 0 ? "text-muted" : ""}`}>{cell(l[p])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!paid && trialing && (
          <p className="mt-5 text-sm">
            <span className="hl hl-solid hl-n1 px-1 font-semibold">Pro trial until {trialEnds}</span>
            <span className="text-muted"> Everything in Pro is open. You move back to Free after that unless you subscribe.</span>
          </p>
        )}
        {!paid && me?.trial?.available && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-5">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Try Pro free for a week</p>
              <p className="text-muted">{me.trial.blocked ?? "Everything in Pro, no card needed. One trial per account."}</p>
              {verify === "sent" && !me.email_verified && (
                <p className="mt-1 text-muted">Check your inbox for the link, open it, then press “I’ve verified it”.</p>
              )}
            </div>
            {!me.trial.blocked ? (
              <button onClick={() => void startTrial()} disabled={trialBusy} className="btn">
                {trialBusy ? <><Spinner /> Starting…</> : "Start free trial"}
              </button>
            ) : me.email_verified === false ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void sendLink()} disabled={verify === "sending"} className="btn">
                  {verify === "sending" ? <><Spinner /> Sending…</> : verify === "sent" || verify === "checking" ? "Send again" : "Send verification email"}
                </button>
                {(verify === "sent" || verify === "checking") && (
                  <button onClick={() => void recheck()} disabled={verify === "checking"} className="btn-primary">
                    {verify === "checking" ? <><Spinner /> Checking…</> : "I’ve verified it"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
        {!paid && me && me.trial && !me.trial.active && !me.trial.available && me.trial.ends_at && (
          <p className="mt-5 text-sm text-muted">Your free trial ended on {trialEnds}.</p>
        )}
        {paid && (
          <p className="mt-5 text-sm">
            <span className="hl hl-solid hl-n1 px-1 font-semibold">{planName} until {paidUntil}</span>
            <span className="text-muted"> Paid passes don’t renew. Buy again any time to add 30 days.</span>
          </p>
        )}
        {!PAYMENTS_ON && me && !paid && (
          <p className="mt-5 text-sm text-muted">Paid plans are coming soon.</p>
        )}
        {/* Plan actions: Free can buy either tier, Pro can extend or move up to Ultra, Ultra can extend.
            Each purchase is a 30-day pass; nothing is charged again automatically. */}
        {PAYMENTS_ON && me && (
          <div className="mt-6 border-t border-border pt-5">
            {RAZORPAY_ON && <fieldset className="mb-4" disabled={busy}>
              <legend className="label">Payment provider</legend>
              <div className="mt-2 flex gap-5 text-sm">
                <label><input type="radio" name="provider" checked={provider === "cashfree"} onChange={() => setProvider("cashfree")} /> Cashfree</label>
                <label><input type="radio" name="provider" checked={provider === "razorpay"} onChange={() => setProvider("razorpay")} /> Razorpay</label>
              </div>
            </fieldset>}
            <label htmlFor="phone" className="label block">Mobile number</label>
            {/* The number and the buy buttons share a row; on narrow screens the buttons wrap below it. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">+91</span>
              <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16}
                     value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, ""))}
                     onBlur={() => setPhoneTouched(true)} disabled={busy} placeholder="98765 43210"
                     aria-invalid={showPhoneProblem} aria-describedby="phone-help"
                     className={`field pl-12 ${showPhoneProblem ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`} />
            </div>
            {me.plan === "free" && (
              <button onClick={() => void upgrade("pro")} disabled={busy || !phoneOk} className="btn-primary">{buyLabel("pro", "Get Pro")}</button>
            )}
            {me.plan === "pro" && (
              <button onClick={() => void upgrade("pro")} disabled={busy || !phoneOk} className="btn">{buyLabel("pro", "Add 30 days of Pro")}</button>
            )}
            <button onClick={() => void upgrade("ultra")} disabled={busy || !phoneOk} className={me.plan === "pro" ? "btn-primary" : "btn"}>
              {buyLabel("ultra", me.plan === "pro" ? "Upgrade to Ultra" : me.plan === "ultra" ? "Add 30 days of Ultra" : "Get Ultra")}
            </button>
            </div>
            <p id="phone-help" aria-live="polite" className={`mt-2 text-xs ${showPhoneProblem ? "text-danger" : "text-muted"}`}>
              {showPhoneProblem ? phoneProblem : "Needed by the payment provider for your receipt."}
            </p>
          </div>
        )}
        {state === "waiting" && (
          <p className="mt-2 text-xs text-muted">Complete your payment. Your plan updates here after it is confirmed. {provider === "razorpay" && <button className="underline" onClick={() => { if (poll.current) clearInterval(poll.current); poll.current = null; setState("idle"); setBuying(null); }}>Stop checking</button>}</p>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="sheet px-5 py-6 sm:px-8">
        <h2 className="text-xl font-semibold">Clear all data</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">
          Permanently deletes your documents and voice notes, chats, quizzes, agent runs, tasks and drafts.
          Your account and plan stay. This cannot be undone.
        </p>
        {wiping === "idle" ? (
          <button onClick={() => setWiping("confirming")} className="btn mt-5 border-danger text-danger hover:border-danger">Clear all data</button>
        ) : (
          <form className="mt-5 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void wipe(); }}>
            <label className="block">
              <span className="label">Type DELETE to confirm</span>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off"
                     disabled={wiping === "deleting"} className="field mt-1 w-48" />
            </label>
            <button type="submit" disabled={confirmText !== "DELETE" || wiping === "deleting"}
                    className="btn border-danger text-danger hover:border-danger">
              {wiping === "deleting" ? <><Spinner /> Deleting…</> : "Delete everything"}
            </button>
            <button type="button" className="btn" disabled={wiping === "deleting"}
                    onClick={() => { setWiping("idle"); setConfirmText(""); }}>Cancel</button>
          </form>
        )}
        {wipeError && <p role="alert" className="mt-2 text-sm text-danger">{wipeError}</p>}
      </div>
    </section>
  );
}
