import Link from "next/link";

const LINKS = [
  ["/pricing", "Pricing"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/refund", "Refunds & cancellation"],
  ["/contact", "Contact"],
] as const;

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${className}`}>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="text-muted underline-offset-4 hover:text-fg hover:underline">{label}</Link>
      ))}
    </nav>
  );
}
