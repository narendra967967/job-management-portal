import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";
import { getAppName, getSupportEmail } from "@/lib/branding";
import { getPublicBusiness } from "@/lib/billing-data";
import { BusinessAddress } from "@/components/marketing/business-address";

// Refund & cancellation policy (owner decision 2026-11-08): plans don't
// renew automatically, aren't refundable once started, and payment errors are
// refunded in full. Keep in step with the Payments section of /terms.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return {
    title: "Refund & cancellation policy",
    description: `How ${appName} plans end, when a payment is refunded and how to ask for a refund.`,
    alternates: { canonical: "/refunds" },
  };
}

export default async function RefundsPage() {
  const [appName, supportEmail, business] = await Promise.all([getAppName(), getSupportEmail(), getPublicBusiness()]);
  const email = supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : <span>our support address</span>;
  return (
    <LegalLayout title="Refund & cancellation policy" updated="November 8, 2026">
      <p>
        This policy covers payments for {appName} plans. It sits alongside our{" "}
        <a href="/terms">Terms &amp; conditions</a>.
      </p>

      <h2>There&rsquo;s nothing to cancel</h2>
      <p>
        Plans don&rsquo;t renew automatically. A plan runs for the month or year you paid for, then it
        ends, and we never charge you again unless you choose to renew. If you don&rsquo;t want to carry on,
        don&rsquo;t renew. Your account and your data stay put, and you can still sign in, but most
        of {appName} is locked until you pick a plan again.
      </p>
      <p>
        We email you once a day during the last week of your plan, so it never ends by surprise.
      </p>

      <h2>Refunds</h2>
      <p>
        A plan can&rsquo;t be refunded once it has started, so please check the plan, the billing period
        and the total before you pay. That includes stopping partway through a plan. If you upgrade, the
        unused part of your old plan isn&rsquo;t refunded; it carries over as extra days on the new one.
      </p>
      <p>
        The free trial is free, so there&rsquo;s nothing to refund. Deleting your account doesn&rsquo;t
        refund a plan that&rsquo;s still running.
      </p>

      <h2>When we do refund</h2>
      <p>If something goes wrong with a payment, we put it right. We refund the extra payment in full if:</p>
      <ul>
        <li>you were charged more than once for the same plan;</li>
        <li>your payment went through but your plan didn&rsquo;t change, and we can&rsquo;t apply it; or</li>
        <li>you were charged a different amount from the one shown before you paid.</li>
      </ul>
      <p>
        We check each case against our payment records first. The refund goes back to the account or card
        you paid with. Once we&rsquo;ve sent it, your bank usually shows it within 5 to 7 working days.
      </p>

      <h2>How to ask</h2>
      <p>
        Email {email}, or send a request from Help &amp; support in the app. Include the receipt number from
        your payment email and a line about what happened. If your plan didn&rsquo;t change after paying,
        it&rsquo;s worth waiting a few minutes first: a payment confirmed late by your bank still updates
        your plan on its own.
      </p>
      {business && <BusinessAddress business={business} />}
    </LegalLayout>
  );
}
