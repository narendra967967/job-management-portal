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
    <LegalLayout title="Privacy policy" updated="19 October 2026">
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
        (<code>gmail.readonly</code>). We use it for one purpose: to turn your job-alert emails into
        tracked job leads in your account.
      </p>
      <ul>
        <li>
          <strong>What we read:</strong> only messages that match your job-alert search — by default
          LinkedIn job-alert emails, adjustable under Settings → Gmail. We do not open other email.
        </li>
        <li>
          <strong>What we keep:</strong> from each matching message, the job title, company, location
          and posting link, saved as a lead, plus the Gmail message ID so the same email is never
          imported twice. If a message can&rsquo;t be parsed, we keep its subject line (up to 500
          characters) so the problem can be fixed. We do not store the full content of your emails.
        </li>
        <li>
          <strong>What we never do:</strong> send, modify, label, or delete anything in your mailbox.
        </li>
      </ul>
      <p>
        {appName}&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. In particular, Google user data:
      </p>
      <ul>
        <li>is used only to provide and improve the features you see in {appName};</li>
        <li>
          is transferred to others only as needed to provide those features (for example, to an AI
          provider when you request an AI feature — see below), to comply with the law, or as part of
          a merger or acquisition with your prior notice;
        </li>
        <li>is never sold and never used for advertising;</li>
        <li>
          is never read by a person unless you ask us to (for example, in a support request), it is
          needed for security or to comply with the law, or it has been aggregated and anonymised;
        </li>
        <li>is never used to develop, improve, or train generalised AI or machine-learning models.</li>
      </ul>
      <p>
        Your Google tokens are stored encrypted. Disconnecting Google in Settings revokes our access
        at Google and deletes the stored tokens; you can also remove access at any time from your{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          Google Account permissions
        </a>
        .
      </p>

      <h2>AI processing</h2>
      <p>
        AI features — job-description summaries, fit scores, outreach drafts and salary insights —
        run only when you request them. For the feature you ask for, we send the relevant details to
        the AI provider configured for your account (OpenAI, Anthropic or OpenRouter, using your own
        API key if you have added one): for example the job title and company (which may come from
        your Gmail job alerts), the job description, your résumé text, or a contact you added. The
        provider uses it only to generate the result we show you. We send nothing else, and we never
        use this data to train AI models.
      </p>

      <h2>How we store and protect your data</h2>
      <p>
        Your data is stored on servers we operate in India (Amazon Web Services, Mumbai region), with
        access controls and encryption in transit (HTTPS). Passwords are stored only as secure
        hashes; API keys and Google tokens are encrypted at rest. Encrypted backups are kept for up to
        30 days. No method of storage is perfectly secure, but we take reasonable measures to protect
        your information.
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
        We keep your data while your account is active. Leads imported from Gmail stay until you
        delete them, or until they are removed by automatic clean-up of stale leads when that is
        enabled. Disconnecting Google stops all further reading of your mailbox. When you ask us to
        delete your account, we delete your data, including all Gmail-derived data, within 30 days;
        copies in backups expire within a further 30 days. We keep only limited records that the law
        requires.
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
