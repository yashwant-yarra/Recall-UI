"use client";

import { useEffect, useRef } from "react";

type Provider = "cashfree" | "razorpay";

/** Asks how to pay for a pass, after a buy button is clicked. Closes before the provider's own window opens. */
export function PayDialog({ plan, price, onPick, onClose }: {
  plan: string;
  price: string;
  onPick: (provider: Provider) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function pick(provider: Provider) {
    dialog.current?.close(); // the provider's checkout must not open under this dialog
    onPick(provider);
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="pay-title" aria-describedby="pay-help"
            onClick={(e) => e.target === dialog.current && dialog.current?.close()} // click on the backdrop
            className="m-auto w-[min(28rem,94vw)] rounded-[3px] border border-border bg-surface p-0 text-fg shadow-[var(--lift)] backdrop:bg-scrim">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="pay-title" className="text-lg font-bold">Choose how to pay</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="p-2 text-muted hover:text-fg">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      <div className="space-y-4 px-5 py-5">
        <p id="pay-help" className="text-sm text-muted">
          <span className="font-semibold text-fg">{plan}, 30 days, {price}.</span> Paid once; nothing renews automatically.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => pick("cashfree")} className="btn min-h-12">Cashfree</button>
          <button type="button" onClick={() => pick("razorpay")} className="btn min-h-12">Razorpay</button>
        </div>
        <p className="text-xs text-muted">Both take UPI, cards and net banking. The payment opens over this page.</p>
      </div>
    </dialog>
  );
}
