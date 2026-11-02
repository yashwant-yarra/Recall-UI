import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TRIAL_DAYS } from "@/lib/legal";

export const metadata: Metadata = { title: "Refund & Cancellation · Recall" };

export default function Refund() {
  return (
    <LegalPage title="Refund & Cancellation Policy" intro="How to cancel a Recall subscription, and when you can get your money back.">
      <h2>Cancelling</h2>
      <ul>
        <li>You can cancel Pro or Ultra at any time from the Account page. No call or email is needed.</li>
        <li>Cancelling stops future charges. You keep your paid plan until the end of the month you already paid for, then move to Free.</li>
        <li>Cancelling does not delete your documents or data. You can also delete those yourself from the Account page.</li>
        <li>The free Pro trial ({TRIAL_DAYS} days) needs no card and ends on its own.</li>
      </ul>

      <h2>Refunds</h2>
      <ul>
        <li><strong>First payment:</strong> if you are not satisfied, ask for a refund within 7 days of your first payment on a plan and we will refund it in full.</li>
        <li><strong>Renewals:</strong> if you were charged for a renewal after you meant to cancel, tell us within 7 days of the charge and we will refund it in full.</li>
        <li><strong>Double or wrong charges:</strong> refunded in full once confirmed.</li>
        <li><strong>Other cases:</strong> payments are otherwise non-refundable, and we do not refund part of a month already used.</li>
      </ul>

      <h2>Upgrading</h2>
      <p>When you move from Pro to Ultra, your Pro subscription is cancelled and Ultra starts. If anything about the switch looks wrong on your statement, <Link href="/contact">contact us</Link> and we will fix it.</p>

      <h2>How to ask for a refund</h2>
      <p><Link href="/contact">Contact us</Link> from the email on your account, with the date and amount of the payment. We reply within 2 business days.</p>

      <h2>When you get the money</h2>
      <p>Approved refunds go back to the original payment method through Razorpay. Banks usually take 5 to 7 business days to show it.</p>
    </LegalPage>
  );
}
