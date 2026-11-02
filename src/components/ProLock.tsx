"use client";

import { useState } from "react";
import { Spinner } from "./Spinner";

/** Shown in place of a Pro-only screen on the Free plan. Same ruled page as the empty states.
 *  With onTrial, the main action starts the account's free trial right here. */
export function ProLock({ title, text, onUpgrade, onTrial }: { title: string; text: string; onUpgrade: () => void; onTrial?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await onTrial?.(); // the shell reloads the plan, and this screen is replaced by the real one
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="sheet ruled max-w-4xl px-5 py-10 pl-[3.6rem] sm:px-8 sm:pl-[3.6rem]">
      <p className="chapter !text-3xl sm:!text-4xl">{title}</p>
      <p className="mt-3 max-w-[52ch] text-sm leading-7 text-muted">{text}</p>
      <p className="mt-5"><span className="hl hl-solid hl-n1 px-1 text-sm font-semibold">Part of Pro</span></p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {onTrial && (
          <button type="button" onClick={() => void start()} disabled={busy} className="btn-primary">
            {busy ? <><Spinner /> Starting…</> : "Start free trial"}
          </button>
        )}
        <button type="button" onClick={onUpgrade} className={onTrial ? "btn" : "btn-primary"}>See Pro</button>
      </div>
      {onTrial && <p className="mt-3 text-xs text-muted">Free for a week, no card needed. One trial per account.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
