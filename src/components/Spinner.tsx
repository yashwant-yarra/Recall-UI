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
