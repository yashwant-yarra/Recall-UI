import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { BUSINESS } from "@/lib/legal";

export const metadata: Metadata = { title: "Contact · Recall" };

export default function Contact() {
  return (
    <LegalPage title="Contact us" intro="For support, billing questions, refund requests or privacy requests, reach us here.">
      <dl className="space-y-4">
        <div>
          <dt className="label">Business</dt>
          <dd>{BUSINESS.product}, operated by {BUSINESS.operator}</dd>
        </div>
        <div>
          <dt className="label">Email</dt>
          <dd><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></dd>
        </div>
      </dl>
      <p>We reply to emails within 2 business days. For a billing or refund question, write from the email address on your Recall account and include the date and amount of the payment.</p>
    </LegalPage>
  );
}
