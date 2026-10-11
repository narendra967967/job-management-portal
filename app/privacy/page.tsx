import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";
import { getAppName, getSupportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return { title: `Privacy policy · ${appName}` };
}

export default async function PrivacyPage() {
  const [appName, supportEmail] = await Promise.all([getAppName(), getSupportEmail()]);
  const contact = supportEmail || "our support address";
  return (
    <LegalLayout title="Privacy policy" updated="October 2026">
      <p>
        This Privacy Policy explains how {appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and
        protects your information when you use our job-search management service (the
        &ldquo;Service&rdquo;). By using the Service you agree to this policy.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — your name, email address, and password (stored only as a secure hash).</li>
        <li><strong>Content you add</strong> — job leads, contacts, notes, résumés, and messages you create in the Service.</li>
        <li><strong>Gmail data</strong> — when you connect Google, we read email in your Gmail account to find and parse your LinkedIn job-alert messages (see below).</li>
        <li><strong>Usage data</strong> — basic technical logs needed to operate and secure the Service.</li>
      </ul>

      <h2>How we use your Google/Gmail data</h2>
      <p>
        Connecting Google is optional and grants only the <strong>read-only</strong> Gmail scope
        (<code>gmail.readonly</code>). We use this access solely to read and parse your incoming
        LinkedIn job-alert emails so they can appear as tracked leads in your account. We
        <strong> never send, modify, label, or delete</strong> anything in your mailbox, and we do not
        read email unrelated to this purpose.
      </p>
      <p>
        {appName}&rsquo;s use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Your Google access tokens are stored encrypted, used
        only to provide the Service, never sold, and never used for advertising. You can disconnect
        Google at any time from Settings, which revokes our access.
      </p>

      <h2>AI processing</h2>
      <p>
        To provide AI summaries, fit scores, and message drafts, relevant content (such as a job
        description or your résumé) is sent to our AI provider to generate the result. We send only
        what is needed for the feature you requested.
      </p>

      <h2>How we store and protect your data</h2>
      <p>
        Your data is stored on our hosting and database providers with access controls and encryption
        in transit. Secrets and third-party tokens are encrypted at rest. No method of storage is
        perfectly secure, but we take reasonable measures to protect your information.
      </p>

      <h2>Sharing</h2>
      <p>
        We do <strong>not</strong> sell your personal information. We share data only with the service
        providers needed to run {appName} — such as Google (for Gmail access you authorize), our AI
        provider, and our hosting and email providers — and only as required to deliver the Service or
        comply with the law.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Access or update your information from Settings.</li>
        <li>Disconnect Google at any time to revoke Gmail access.</li>
        <li>Request deletion of your account and associated data by contacting us.</li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your data while your account is active. When you delete your account, we delete your
        associated data, except where we must retain limited records to comply with legal obligations.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time; the &ldquo;Last updated&rdquo; date above reflects the latest version.</p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Contact us at{" "}
        {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : <span>{contact}</span>}.
      </p>
    </LegalLayout>
  );
}
