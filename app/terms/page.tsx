import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";
import { getAppName, getSupportEmail } from "@/lib/branding";
import { isGmailOAuthEnabled } from "@/lib/email-intake-data";
import { captchaSiteKey } from "@/lib/captcha";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return {
    title: "Terms & conditions",
    description: `The terms for using ${appName}: your account, plans, email forwarding, AI features, acceptable use and how to close your account.`,
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const [appName, supportEmail, gmailOn, captchaKey] = await Promise.all([
    getAppName(),
    getSupportEmail(),
    isGmailOAuthEnabled(),
    captchaSiteKey(),
  ]);
  return (
    <LegalLayout title="Terms & conditions" updated="25 October 2026">
      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) apply to your use of {appName} (the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to them. If you
        don&rsquo;t agree, please don&rsquo;t use the Service.
      </p>

      <h2>The service</h2>
      <p>
        {appName} helps you capture job leads (from job alerts you forward, or jobs you add yourself),
        organize your job search, keep a career profile and résumés, and research and apply with
        AI-assisted tools. {appName} never applies to jobs or sends messages on your behalf. The Service is
        provided to you for your personal job-search use.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>Accounts are for a single person; do not share your login.</li>
        <li>Notify us promptly of any unauthorized use.</li>
        <li>
          Some actions, such as resetting your leads or asking us to delete your account, are confirmed
          with a one-time code sent to your email. Keep access to your email secure; anyone who can read it may be
          able to confirm these actions.
        </li>
      </ul>

      <h2>Plans</h2>
      <p>
        Some features depend on your plan. For example, salary insights, the résumé ATS check and
        personal notes are available only on plans that include them. Plan details are shown in the app;
        for any paid plan, the price, billing period and renewal terms are shown before you buy. If your
        plan expires, access to the Service pauses until it is renewed; your data is kept in the meantime.
      </p>

      <h2>Email forwarding</h2>
      <ul>
        <li>
          Your forwarding address is personal, so keep it private. If it is shared by mistake, reset it in
          Settings; the old address stops working immediately.
        </li>
        <li>
          Forward only emails you are entitled to share with us: your own job alerts. Do not forward other
          people&rsquo;s email or sensitive personal mail.
        </li>
        <li>
          We accept only genuine job alerts from supported job sites, including ones you forward by hand.
          Anything else, or anything over our limits, is discarded without notice.
        </li>
        <li>
          Supported sites may change, and forwarding may be paused for maintenance or security; job alerts
          sent during a pause may not be imported.
        </li>
      </ul>

      <h2>AI features</h2>
      <ul>
        <li>
          AI features run on your own API key from an AI provider you choose (OpenAI, Anthropic or
          OpenRouter). You are responsible for that account, its charges and its terms.
        </li>
        <li>
          AI output can be wrong or incomplete. That includes summaries, fit scores, salary estimates,
          résumé ATS scores, drafts and job details filled in from a pasted post or screenshot. Review it before relying
          on it. The ATS score is our estimate, not a prediction of any particular employer&rsquo;s system,
          and no score guarantees an interview or a job.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to misuse the Service, including by:</p>
      <ul>
        <li>breaking the law or infringing others&rsquo; rights;</li>
        <li>attempting to disrupt, reverse-engineer, or gain unauthorized access to the Service;</li>
        <li>using the Service to send spam or unsolicited messages;</li>
        <li>sending email to {appName} addresses that you are not entitled to share, or sending large volumes to overload the Service;</li>
        <li>accessing the Service by automated means, or trying to get around its security checks, rate limits or plan limits.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the content you add (leads, notes, résumés, your career profile,
        messages). You grant us a limited license to store and process that content solely to operate the
        Service for you. Only add content you&rsquo;re entitled to share, such as job posts and
        screenshots you paste, and keep your own information accurate.
      </p>

      <h2>Third-party services</h2>
      <p>
        The Service works with third parties you choose to use, including the job sites whose alerts you
        forward{gmailOn ? ", Google (read-only Gmail, if you connect it)" : ""}{captchaKey ? ", Google reCAPTCHA (the security check on the sign-in pages)" : ""} and AI providers. Your use of
        those services is also subject to their terms. If you add your own AI key, AI features (including
        reading job emails we can&rsquo;t read automatically) run on your account with that provider, and
        its charges apply. Our handling of your data is described in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee that
        AI outputs (summaries, scores, drafts) are accurate or complete, so review them before relying on
        them. Job details come from the job sites&rsquo; emails and may be incomplete or out of date, so
        check the posting before you apply. {appName} never sends messages on your behalf; you are responsible
        for anything you send.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {appName} is not liable for any indirect, incidental, or
        consequential damages, or for lost opportunities, arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <ul>
        <li>
          You may stop using the Service at any time. You can ask us to delete your account and all its
          data from Settings → Account (or by contacting us); we delete it after confirming your request and
          email you when it&rsquo;s done. You can cancel the request until then. Your data is deleted as
          described in our <a href="/privacy">Privacy Policy</a>.
        </li>
        <li>
          Reset leads (Settings → Account) permanently deletes all your leads and what is attached to them.
          Deleted data can&rsquo;t be restored, so download a copy first if you might need it.
        </li>
        <li>We may suspend or terminate access if you violate these Terms.</li>
      </ul>

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
