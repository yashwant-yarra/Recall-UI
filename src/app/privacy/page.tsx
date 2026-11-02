import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { BUSINESS } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · Recall" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" intro={`This explains what ${BUSINESS.product} (operated by ${BUSINESS.operator}) collects, why, and who handles it.`}>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and, if you sign in with Google, GitHub or Microsoft, the basic profile that provider shares.</li>
        <li><strong>Your content:</strong> documents you upload, voice notes and voice you speak to the tutor, your questions and chats, quizzes, and tasks and drafts the agent prepares.</li>
        <li><strong>Usage:</strong> how many uploads, questions and other actions you use each day, to enforce plan limits.</li>
        <li><strong>Billing:</strong> your plan, when your pass ends, the payment link ID, and the mobile number you give at checkout (passed to Cashfree, which requires it). Your card or UPI details go straight to Cashfree; we never receive or store them.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to run Recall for you: sign you in, index and search your material, generate answers, quizzes and speech, apply your plan&apos;s limits and take payment. We do not sell your data and do not show ads.</p>

      <h2>Who handles it</h2>
      <ul>
        <li><strong>Firebase Authentication (Google):</strong> sign-in.</li>
        <li><strong>Google Cloud:</strong> stores your files and runs the service. Our servers are in Singapore (asia-southeast1).</li>
        <li><strong>Neon:</strong> the database holding your account data, chats and the searchable index of your material.</li>
        <li><strong>Google Vertex AI (Gemini):</strong> your questions and the matching passages of your material are sent to the AI model to produce answers, quizzes and speech. They are used to answer you, not to advertise to you.</li>
        <li><strong>Cashfree Payments:</strong> payments.</li>
      </ul>
      <p>Each of these providers has its own privacy terms. We share only what each needs to do its job.</p>

      <h2>Keeping it safe</h2>
      <p>Connections use HTTPS. Access to your content requires your signed-in account, and other users cannot see it. Secrets such as payment keys are kept in a secrets manager, not in code.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete all your documents, voice notes, chats, quizzes, tasks and drafts from the Account page whenever you like.</li>
        <li>To delete your account or get a copy of your data, <Link href="/contact">contact us</Link> and we will act on it within 30 days.</li>
        <li>Billing records may be kept as long as the law requires for tax and accounting.</li>
      </ul>

      <h2>Children</h2>
      <p>Recall is not meant for children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the top changes too. For anything material we will tell you in the app or by email.</p>

      <h2>Contact</h2>
      <p>Privacy questions or requests: <Link href="/contact">contact us</Link>.</p>
    </LegalPage>
  );
}
