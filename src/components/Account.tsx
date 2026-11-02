"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Me, Tier } from "@/lib/types";
import { Spinner } from "./Spinner";
import { useAuth } from "./AuthProvider";

// The plan table comes from the API (`me.limits`), so it always shows the limits the server enforces.
const cell = (n: number | null) => (n === null ? "Unlimited" : n === 0 ? "Not included" : n.toLocaleString());
const TIER_NAME: Record<string, string> = { free: "Free", pro: "Pro", ultra: "Ultra" };

export function Account({ me, onPlanChange, onTrial }: { me: Me | null; onPlanChange: () => Promise<void>; onTrial: () => Promise<void> }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "opening" | "waiting" | "confirming" | "cancelling">("idle");
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);
  const [buying, setBuying] = useState<Tier | null>(null); // the tier whose checkout is open or being waited for
  // Once the webhook has given the user the tier they bought, stop waiting.
  useEffect(() => {
    if (buying && me?.plan === buying && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
      setState("idle");
      setBuying(null);
    }
  }, [me?.plan, buying]);

  // A paying user's renewal can be switched off; they keep their tier until the paid month ends.
  const [ending, setEnding] = useState<{ endsAt: number | null } | null>(null);
  const isPaid = !!me && me.plan !== "free";
  useEffect(() => {
    if (!isPaid) return;
    let live = true;
    api<{ cancel_scheduled: boolean; ends_at: number | null }>("/api/v1/billing/subscription")
      .then((s) => live && setEnding(s.cancel_scheduled ? { endsAt: s.ends_at } : null))
      .catch(() => {}); // the Switch to Free button just stays available
    return () => { live = false; };
  }, [isPaid]);

  async function downgrade() {
    setError(null);
    setState("cancelling");
    try {
      const s = await api<{ ends_at: number | null }>("/api/v1/billing/cancel", { method: "POST", body: {} });
      setEnding({ endsAt: s.ends_at });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState("idle");
    }
  }
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
  const endDate = ending?.endsAt ? new Date(ending.endsAt * 1000).toLocaleDateString(undefined, { dateStyle: "long" }) : null;

  async function upgrade(tier: Tier) {
    setError(null);
    setBuying(tier);
    setState("opening");
    // Open the tab now, inside the click: browsers block popups opened later, after an await.
    const tab = window.open("", "_blank");
    try {
      const { url } = await api<{ url: string }>("/api/v1/billing/checkout", { method: "POST", body: { tier } });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      // The plan changes only when Razorpay's webhook arrives, so check every few seconds (up to 5 min).
      setState("waiting");
      let tries = 0;
      poll.current = setInterval(() => {
        if (++tries > 100 && poll.current) { clearInterval(poll.current); poll.current = null; setState("idle"); setBuying(null); }
        void onPlanChange();
      }, 3000);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
      setState("idle");
      setBuying(null);
    }
  }

  const paid = isPaid;
  const trialing = me?.plan === "free" && !!me.trial?.active;
  const planName = me ? (paid ? TIER_NAME[me.plan] : trialing ? "Trial" : "Free") : null;
  const busy = state === "opening" || state === "waiting";
  // The column that is yours is highlighted; during the trial that is Pro, the tier it gives.
  const mine = me ? (paid ? me.plan : trialing ? "pro" : "free") : null;
  const canSwitch = paid && !ending; // can still stop renewing (not already scheduled to end)
  const confirming = canSwitch && state === "confirming";
  const buyLabel = (tier: Tier, text: string) =>
    buying === tier && state === "opening" ? <><Spinner /> Opening Razorpay…</> : buying === tier && state === "waiting" ? <><Spinner /> Waiting for payment…</> : text;
  return (
    <section className="max-w-4xl space-y-6">
      <p className="max-w-[65ch] text-sm text-muted">Your account details and plan, all in one place.</p>
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
        <p className="label">Plan comparison</p>
        <h2 className="mt-2 text-xl font-semibold">Your weekly allowance</h2>
        <p className="mt-1 text-sm text-muted">Compare what’s included with each plan.</p>
        <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="w-2/5 pb-2 font-normal"></th>
              {(["free", "pro", "ultra"] as const).map((p) => (
                <th key={p} className="w-1/5 pb-2 pr-2 font-bold">
                  <span className={mine === p ? "hl hl-solid hl-n1 px-1" : ""}>{TIER_NAME[p]}</span>
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
        {/* One row of plan actions: Free can buy either tier, Pro can move up to Ultra, and anyone paying can
            switch back to Free. The "are you sure" prompt opens on its own line below. */}
        {me && (me.plan !== "ultra" || (canSwitch && !confirming)) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {me.plan === "free" && (
              <button onClick={() => void upgrade("pro")} disabled={busy} className="btn-primary">{buyLabel("pro", "Get Pro")}</button>
            )}
            {me.plan !== "ultra" && (
              <button onClick={() => void upgrade("ultra")} disabled={busy} className={me.plan === "free" ? "btn" : "btn-primary"}>
                {buyLabel("ultra", me.plan === "pro" ? "Upgrade to Ultra" : "Get Ultra")}
              </button>
            )}
            {canSwitch && !confirming && (
              <button onClick={() => setState("confirming")} disabled={state === "cancelling"} className="btn">
                {state === "cancelling" ? <><Spinner /> Cancelling…</> : "Switch to Free"}
              </button>
            )}
          </div>
        )}
        {paid && ending && (
          <p className="mt-5 text-sm">
            <span className="hl hl-solid hl-n4 px-1 font-semibold">{planName} until {endDate ?? "the end of this billing month"}</span>
            <span className="text-muted"> It will not renew, and you move to Free after that.</span>
          </p>
        )}
        {confirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>Stop renewing? You keep {planName} until the end of the month you paid for.</span>
            <button className="btn border-danger text-danger hover:border-danger" onClick={() => void downgrade()}>Yes, switch to Free</button>
            <button className="btn" onClick={() => setState("idle")}>Keep {planName}</button>
          </div>
        )}
        {state === "waiting" && (
          <p className="mt-2 text-xs text-muted">Finish paying in the Razorpay tab. This page updates by itself once the payment is confirmed.</p>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="sheet px-5 py-6 sm:px-8">
        <p className="label">Your data</p>
        <h2 className="mt-2 text-xl font-semibold">Clear all data</h2>
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
