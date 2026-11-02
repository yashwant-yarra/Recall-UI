import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TRIAL_DAYS } from "@/lib/legal";

export const metadata: Metadata = { title: "Refund & Cancellation · Recall" };

export default function Refund() {
  return (
    <LegalPage title="Refund & Cancellation Policy" intro="How Recall passes end, and when you can get your money back.">
      <h2>Cancelling</h2>
      <ul>
        <li>Pro and Ultra are one-time 30-day passes. They never renew or charge you again, so there is nothing to cancel: a pass simply ends after 30 days and you move to Free.</li>
        <li>When a pass ends, your documents and data stay. You can delete them yourself from the Account page at any time.</li>
        <li>The free Pro trial ({TRIAL_DAYS} days) needs no card and ends on its own.</li>
      </ul>

      <h2>Refunds</h2>
      <ul>
        <li><strong>First pass:</strong> if you are not satisfied, ask for a refund within 7 days of buying your first pass on a plan and we will refund it in full.</li>
        <li><strong>Double or wrong charges:</strong> refunded in full once confirmed.</li>
        <li><strong>Other cases:</strong> passes are otherwise non-refundable, and we do not refund the unused part of a pass.</li>
      </ul>

      <h2>Upgrading</h2>
      <p>When you buy Ultra while a Pro pass is running, the days left on Pro become Ultra days, and the new 30 days are added on top. If anything about the switch looks wrong, <Link href="/contact">contact us</Link> and we will fix it.</p>

      <h2>How to ask for a refund</h2>
      <p><Link href="/contact">Contact us</Link> from the email on your account, with the date and amount of the payment. We reply within 2 business days.</p>

      <h2>When you get the money</h2>
      <p>Approved refunds go back to the original payment method through Cashfree. Banks usually take 5 to 7 business days to show it.</p>
    </LegalPage>
  );
}
