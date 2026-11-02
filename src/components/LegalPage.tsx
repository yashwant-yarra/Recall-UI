import Link from "next/link";
import { BUSINESS } from "@/lib/legal";
import { LegalLinks } from "./LegalLinks";

// Shared frame for the public pages (pricing and policies): readable without signing in.
export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="label hover:text-fg">← Recall</Link>
        <article className="sheet mt-4 p-6 sm:p-10">
          <p className="label">Last updated {BUSINESS.updated}</p>
          <h1 className="chapter mt-3">{title}</h1>
          {intro && <p className="mt-4 text-base leading-7 text-muted">{intro}</p>}
          <div className="mt-8 space-y-4 text-[0.97rem] leading-7 [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
            {children}
          </div>
        </article>
        <LegalLinks className="mt-6" />
      </div>
    </main>
  );
}
