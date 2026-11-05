/** A small spinning loader. Pass a label for screen readers when it stands alone. */
export function Spinner({ className = "h-4 w-4", label }: { className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="none" role={label ? "status" : undefined}
         aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A spinner with a short message, for a section that's waiting on the server. */
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <Spinner />
      {text}
    </p>
  );
}
export function LoadingMark() {
  return (
    <svg viewBox="0 0 160 128" className="recall-loading h-32 w-40 text-accent" fill="none" aria-hidden="true">
      <path d="M20 104h120" stroke="var(--border)" strokeWidth="1" />
      <path className="recall-loading-highlight" d="M48 72h65" stroke="var(--hl-1)" strokeWidth="17" strokeLinecap="square" />
      <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path pathLength="1" className="recall-loading-spine" d="M58 89V35" />
        <path pathLength="1" className="recall-loading-loop" d="M58 35h23c25 0 25 30 0 30H58" />
        <path pathLength="1" className="recall-loading-leg" d="m81 65 23 24" />
      </g>
      <g stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
        <path className="recall-loading-note" d="M24 43h10m-6 7h6" />
        <path className="recall-loading-note" d="M123 77h12m-12 7h7" />
      </g>
    </svg>
  );
}


/** Full-screen wait while Firebase restores the session. */
export function Opening() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" role="status">
      <LoadingMark />
      <div>
        <p className="text-lg font-semibold">Opening Recall</p>
        <p className="mt-1 text-sm text-muted">Getting your workspace ready…</p>
      </div>
    </div>
  );
}
