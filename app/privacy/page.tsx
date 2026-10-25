import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";
import { getAppName, getSupportEmail } from "@/lib/branding";
import { isGmailOAuthEnabled, receivingDomain, supportedSiteExamples } from "@/lib/email-intake-data";
import { getRetentionConfig } from "@/lib/retention";
import { captchaSiteKey } from "@/lib/captcha";

// The Gmail / Google Limited Use section shows only while "Connect Gmail" is
// switched on (admin), the reCAPTCHA line only while the check is on; retention periods come from admin Settings → Data
// retention, so the policy always states what the Service actually does.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return { title: `Privacy policy · ${appName}` };
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

export default async function PrivacyPage() {
  const [appName, supportEmail, gmailOn, sites, retention, captchaKey] = await Promise.all([
    getAppName(),
    getSupportEmail(),
    isGmailOAuthEnabled(),
    supportedSiteExamples(),
    getRetentionConfig(),
    captchaSiteKey(),
  ]);
  const contact = supportEmail || "our support address";
  return (
    <LegalLayout title="Privacy policy" updated="25 October 2026">
      <p>
        This Privacy Policy explains how {appName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, and
        protects your information when you use our job-search management service (the
        &ldquo;Service&rdquo;). By using the Service you agree to this policy.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information</strong> — your name, email address, and password (stored only as a secure hash).</li>
        <li><strong>Content you add</strong> — job leads, contacts, notes, outreach messages, and résumés (the file and the text we extract from it).</li>
        <li>
          <strong>Jobs you add with AI</strong> — the job post text or screenshot you paste into &ldquo;Add
          with AI&rdquo;. It is sent to your AI provider to fill in the form; we keep only the job details you
          save, not the screenshot.
        </li>
        <li>
          <strong>Career profile</strong> — what you choose to tell us about your career and job preferences:
          job title, experience, skills, education, certifications, the countries you can work in, target
          roles, preferred work mode and locations, notice period, and current and expected pay.
        </li>
        <li>
          <strong>Optional questions</strong> — if you choose to answer them, your gender, disability and
          veteran status. These are entirely optional, kept private to your account, never sent to an AI
          provider, and never used to score or rank you. You can clear them at any time.
        </li>
        <li>
          <strong>Job-alert emails you forward</strong> — the emails you, or a filter you set up, send to your
          private {appName} address (see &ldquo;Email forwarding&rdquo; below).
        </li>
        {gmailOn && (
          <li><strong>Gmail data</strong> — if you connect Google, we read email in your Gmail account to find and parse your LinkedIn job-alert messages (see below).</li>
        )}
        <li><strong>Usage data</strong> — basic technical logs needed to operate and secure the Service.</li>
        <li>
          <strong>Confirmation codes</strong> — when you reset your leads or ask to delete your account, we
          email you a one-time code. We store only a scrambled (hashed) form of it, and it expires after 10
          minutes.
        </li>
        {captchaKey && (
        <li>
          <strong>Security check</strong> — the sign-in, sign-up and password pages use Google reCAPTCHA to
          keep out automated abuse. It sends Google information about your device and how you use the page
          (Google&rsquo;s{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>{" "}
          and{" "}
          <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms</a>{" "}
          apply).
        </li>
        )}
      </ul>

      <h2>Email forwarding</h2>
      <p>
        You get a private address (ending in <code>@{receivingDomain()}</code>). {appName} never accesses
        your mailbox: it only receives what you choose to send to that address.
      </p>
      <ul>
        <li>
          <strong>What we accept:</strong> emails that genuinely come from a supported job site (for example{" "}
          {sites}). We check the sender&rsquo;s digital signature (DKIM, or the forwarding seal Gmail adds);
          anything else is discarded. Job alerts you forward by hand from your own email address are
          accepted the same way.
        </li>
        <li>
          <strong>What we keep:</strong> from each accepted email, the job details — title, company,
          location, the job&rsquo;s link and short tags such as salary or experience — saved as leads in
          your account, plus the email&rsquo;s message ID so the same email is never imported twice. If an
          email can&rsquo;t be read, we keep its subject line (up to 500 characters) as an ingestion issue so
          the problem can be fixed.
        </li>
        <li>
          <strong>What we don&rsquo;t keep:</strong> the email itself. While an email is being processed it
          is held briefly — at most 24 hours if delivery has to be retried — and then deleted.
        </li>
        <li>
          <strong>Delivery log:</strong> for each email we record when it arrived, the job site and sender
          (only the sender&rsquo;s domain for emails we reject), its size and what happened to it. This log
          is kept for {days(retention.inboundLogDays)}.
        </li>
        <li>
          <strong>Gmail&rsquo;s confirmation email:</strong> when you add your address in Gmail, Google sends
          a confirmation email to it. We show it to you in Settings so you can approve forwarding, and
          delete it once forwarding is confirmed or you reset your address.
        </li>
        <li>
          <strong>Stopping:</strong> remove the filter (or forwarding) in Gmail at any time. Resetting your
          address in Settings stops the old address immediately.
        </li>
      </ul>

      {gmailOn ? (
        <>
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
        </>
      ) : (
        <p>
          Any data obtained in the past through a Gmail connection remains subject to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      )}

      <h2>AI processing</h2>
      <p>
        AI features run only when you request them, on the AI provider and API key you add in Settings
        (OpenAI, Anthropic or OpenRouter). For each feature we send only what it needs:
      </p>
      <ul>
        <li><strong>Summaries, fit scores and outreach drafts</strong> — the job&rsquo;s title, company and description, your résumé text, and a contact you added.</li>
        <li><strong>Salary insights</strong> — the job&rsquo;s title, company, location and description, your résumé text, and the country in your profile.</li>
        <li>
          <strong>Résumé ATS check</strong> — the résumé&rsquo;s text and the matching parts of your career
          profile (target roles, skills and tools, current title, years of experience, seniority and
          industries). Your answers to the optional questions are never sent.
        </li>
        <li><strong>Add with AI</strong> — the job post text or screenshot you paste.</li>
      </ul>
      <p>
        The provider uses this only to produce the result we show you, under its own terms and charges.
        We send nothing else, and we never use your data to train AI models.
      </p>
      <p>
        <strong>Reading forwarded emails with AI:</strong> if you have added your own AI key and a
        forwarded email comes from a supported site we can&rsquo;t read automatically, we send that
        email&rsquo;s text to your AI provider to pick out the jobs — with its links replaced by numbers,
        and without attachments or images. This uses your key, so your provider&rsquo;s terms and charges apply. The text is held only
        until it has been read, then deleted.
      </p>

      <h2>How we store and protect your data</h2>
      <p>
        Your data — including forwarded emails while they are processed — is handled on servers we
        operate in India (Amazon Web Services, Mumbai region), with access controls and encryption in
        transit (HTTPS, and encrypted delivery for forwarded email when the sending server supports
        it). Passwords are stored only as secure hashes; API keys{gmailOn ? " and Google tokens" : ""} are
        encrypted at rest. Encrypted backups are kept for up to 30 days. No method of storage is
        perfectly secure, but we take reasonable measures to protect your information. Sensitive actions
        (resetting your leads, requesting account deletion) are confirmed with a one-time code sent to
        your email.
      </p>

      <h2>Sharing</h2>
      <p>
        We do <strong>not</strong> sell your personal information. We share data only with the service
        providers needed to run {appName} — such as {gmailOn ? "Google (for Gmail access you authorize), " : ""}
        the AI provider you use, and our hosting and email providers — and only as required to deliver
        the Service or comply with the law.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Access or update your information from Settings.</li>
        <li>Stop forwarding at any time by removing your Gmail filter; reset your address in Settings.</li>
        {gmailOn && <li>Disconnect Google at any time to revoke Gmail access.</li>}
        <li>See every email that reached your forwarding address in Settings → Email log.</li>
        <li>
          Delete all your leads and everything attached to them at any time (Settings → Account → Reset
          leads), after downloading a copy if you wish.
        </li>
        <li>
          Request deletion of your account and all associated data from Settings → Account, or by contacting
          us. When it&rsquo;s done we delete everything, including stored résumé files, and email you; we keep
          only an anonymised record that the request was handled.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your data while your account is active. Leads stay until you delete them, or until they
        are removed by automatic clean-up of stale leads when that is enabled. Records kept to run the
        Service are deleted automatically: the email delivery log after {days(retention.inboundLogDays)},
        ingestion issues after {days(retention.ingestIssueDays)}, the message IDs used to avoid importing
        an email twice after {days(retention.processedLedgerDays)}, and notifications after{" "}
        {days(retention.notificationDays)}.
        {gmailOn ? " Disconnecting Google stops all further reading of your mailbox." : ""} Confirmation
        codes expire after 10 minutes and are deleted daily. When you reset your leads they are deleted
        straight away. When you ask us to delete your account, we delete your data — including résumé
        files and all data from your job-alert emails — within 30 days and email you when it&rsquo;s done;
        copies in backups expire within a further 30 days. We keep only an anonymised record that your
        request was handled, and limited records that the law requires.
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
