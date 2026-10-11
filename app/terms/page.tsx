import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";
import { getAppName, getSupportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return { title: `Terms & conditions · ${appName}` };
}

export default async function TermsPage() {
  const [appName, supportEmail] = await Promise.all([getAppName(), getSupportEmail()]);
  return (
    <LegalLayout title="Terms & conditions" updated="October 2026">
      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of {appName} (the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms. If
        you do not agree, do not use the Service.
      </p>

      <h2>The service</h2>
      <p>
        {appName} helps you capture job leads, organize your job search, and draft outreach with
        AI-assisted tools. The Service is provided to you for your personal job-search use.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>Accounts are for a single person; do not share your login.</li>
        <li>Notify us promptly of any unauthorized use.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to misuse the Service, including by:</p>
      <ul>
        <li>breaking the law or infringing others&rsquo; rights;</li>
        <li>attempting to disrupt, reverse-engineer, or gain unauthorized access to the Service;</li>
        <li>using the Service to send spam or unsolicited messages.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the content you add (leads, notes, résumés, messages). You grant us a
        limited license to store and process that content solely to operate the Service for you.
      </p>

      <h2>Third-party services</h2>
      <p>
        The Service integrates with third parties you choose to connect, including Google (read-only
        Gmail) and our AI provider. Your use of those integrations is also subject to their terms. Our
        handling of your data is described in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that
        AI outputs (summaries, scores, drafts) are accurate or complete — review them before relying on
        them. {appName} never sends messages on your behalf; you are responsible for anything you send.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {appName} is not liable for any indirect, incidental, or
        consequential damages, or for lost opportunities, arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate
        access if you violate these Terms.
      </p>

      <h2>Changes</h2>
      <p>We may update these Terms from time to time; continued use after changes means you accept the updated Terms.</p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : <span>our support address</span>}.
      </p>
    </LegalLayout>
  );
}
