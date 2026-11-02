import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { inr, PLAN_LIMITS, PRICES, TRIAL_DAYS } from "@/lib/legal";

export const metadata: Metadata = { title: "Pricing · Recall", description: "Recall plans: Free, Pro and Ultra, billed monthly in INR." };


export default function Pricing() {
  return (
    <LegalPage title="Pricing" intro="Start free. Buy a 30-day pass when you need higher weekly limits. All prices are in Indian Rupees (INR). Nothing renews or charges you automatically.">
      <div className="grid gap-3 sm:grid-cols-3">
        {([["Free", "₹0", "forever", "Try Recall with small weekly limits."], ["Pro", inr(PRICES.pro), "per 30 days", "For regular study. Includes live voice tutor, agent and web-search answers."], ["Ultra", inr(PRICES.ultra), "per 30 days", "For heavy use, with the highest weekly limits."]] as const).map(([name, price, per, blurb]) => (
          <div key={name} className="card p-4">
            <p className="label">{name}</p>
            <p className="mt-2 text-3xl font-extrabold">{price}</p>
            <p className="text-sm text-muted">{per}</p>
            <p className="mt-3 text-sm leading-6">{blurb}</p>
          </div>
        ))}
      </div>

      <h2>What each plan includes</h2>
      <p>Usage limits reset every Monday at 00:00 UTC (5:30 AM IST). Total storage is the space your files take up at any time, so it frees up when you delete files. After a pass or trial ends, files over the Free limits are kept for 90 days; after that the oldest are deleted until the rest fit.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Weekly limits by plan</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 label">Limits</th>
              <th scope="col" className="py-2 pr-3 label">Free</th>
              <th scope="col" className="py-2 pr-3 label">Pro</th>
              <th scope="col" className="py-2 label">Ultra</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIMITS.map((r) => (
              <tr key={r.name} className="border-b border-border">
                <th scope="row" className="py-2.5 pr-3 font-semibold">{r.name}</th>
                <td className="py-2.5 pr-3 text-muted">{r.free}</td>
                <td className="py-2.5 pr-3">{r.pro}</td>
                <td className="py-2.5">{r.ultra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How billing works</h2>
      <ul>
        <li>Pro is {inr(PRICES.pro)} and Ultra is {inr(PRICES.ultra)} for 30 days, paid once through Cashfree (UPI, cards or net banking).</li>
        <li>Every account can try Pro free for {TRIAL_DAYS} days, once, with no card needed.</li>
        <li>A pass is never renewed or charged again automatically. When it ends you move to Free, and you can buy another pass at any time. Buying before it ends adds 30 days to the time you have left.</li>
        <li>See the <Link href="/refund">refund policy</Link> for details.</li>
      </ul>
    </LegalPage>
  );
}
