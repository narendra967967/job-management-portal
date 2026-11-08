import "server-only";

// Renewal reminders: one email a day in the last 7 days of a plan (paid plans
// and the free trial alike), personalized with what the user has in Jobtiva
// and pointing at the next plan up. Run daily (~10:00 IST) by
// POST /api/cron/plan-reminders. plan_reminders_sent's key (user, expiry, day)
// makes a second run the same day a no-op; failed sends are retried.
// Account email: no unsubscribe (spec: memory payments-plan).

import { and, asc, eq, gt, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { planRemindersSent, plans, user } from "@/db/schema";
import { activeLeadCount } from "@/lib/entitlements";
import { toPublicPlan, type PublicPlan } from "@/lib/pricing";
import { upgradeSentence } from "@/lib/plan-highlights";
import { formatPrice } from "@/lib/billing-model";
import { sendAppEmail, SMTP_NOT_CONFIGURED } from "@/lib/email";
import { absoluteUrl } from "@/lib/site-url";
import { getAppName } from "@/lib/branding";

const DAY_MS = 86_400_000;

const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata" });

export interface ReminderEmail {
  subject: string;
  heading: string;
  lines: string[];
  button: { label: string; url: string };
  footerNote: string;
}

/** The reminder for one user on one day. Pure apart from the URLs. */
export function reminderEmail(args: {
  appName: string;
  firstName: string;
  plan: PublicPlan;
  expiresAt: Date;
  daysLeft: number;
  activeLeads: number;
  upsell: PublicPlan | null;
}): ReminderEmail {
  const { appName, firstName, plan, expiresAt, daysLeft, activeLeads, upsell } = args;
  const trial = plan.isFree;
  const what = trial ? "free trial" : `${plan.name} plan`;
  const when = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  const lines = [
    `Hi ${firstName}, your ${what} ends on ${longDate(expiresAt)}.`,
    activeLeads > 0
      ? `You're tracking ${activeLeads.toLocaleString("en-IN")} job ${activeLeads === 1 ? "lead" : "leads"} right now. ${
          trial ? "Pick a plan" : "Renew"
        } before then and nothing changes: your leads, contacts and reminders stay right where they are.`
      : `${trial ? "Pick a plan" : "Renew"} before then to keep everything running without a break.`,
  ];
  if (upsell) {
    const adds = upgradeSentence([plan, upsell], 3);
    const price = upsell.monthlyPrice > 0 ? ` It's ${formatPrice(upsell.monthlyPrice, upsell.currency)} a month.` : "";
    lines.push(
      trial
        ? `${adds || `${upsell.name} is our most popular next step.`}${price}`
        : `Thinking about more room? ${adds || `${upsell.name} gives you more.`}${price} If you upgrade now, the days left on your current plan count toward it.`,
    );
  }
  lines.push(
    `If it does run out, you can still sign in to ${appName}, but everything apart from your plan and account settings stays locked until you pick a plan.`,
  );

  return {
    subject: `Your ${what} ends ${when}`,
    heading: `Your ${what} ends ${when}`,
    lines,
    button: trial
      ? { label: "Choose a plan", url: absoluteUrl("/upgrade") }
      : { label: upsell ? "Renew or upgrade" : "Renew my plan", url: absoluteUrl("/settings?tab=plan") },
    footerNote: "We send this once a day during the last week of your plan, and stop as soon as you renew.",
  };
}

export interface ReminderRunResult {
  due: number;
  sent: number;
  failed: number;
  skipped: number;
}

export async function runPlanReminders(now = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { due: 0, sent: 0, failed: 0, skipped: 0 };
  const appName = await getAppName();

  // Plans ending within 7 days, for active non-admin accounts.
  const due = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      planId: user.planId,
      planExpiresAt: user.planExpiresAt,
    })
    .from(user)
    .where(
      and(
        gt(user.planExpiresAt, now),
        lte(user.planExpiresAt, new Date(now.getTime() + 7 * DAY_MS)),
        ne(user.status, "inactive"),
        ne(user.role, "admin"),
      ),
    );

  const paidOffers = (
    await db
      .select()
      .from(plans)
      .where(and(eq(plans.status, "active"), eq(plans.isFree, false), eq(plans.showOnPricing, true)))
      .orderBy(asc(plans.monthlyPrice), asc(plans.yearlyPrice))
  ).map(toPublicPlan);

  for (const u of due) {
    if (!u.planExpiresAt || !u.planId || !u.email) continue;
    const expiresAt = u.planExpiresAt;
    const daysLeft = Math.min(7, Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)));
    result.due++;

    const [prev] = await db
      .select({ status: planRemindersSent.status })
      .from(planRemindersSent)
      .where(
        and(
          eq(planRemindersSent.userId, u.id),
          eq(planRemindersSent.expiresAt, expiresAt),
          eq(planRemindersSent.daysBefore, daysLeft),
        ),
      );
    if (prev?.status === "sent") {
      result.skipped++;
      continue;
    }

    const [row] = await db.select().from(plans).where(eq(plans.id, u.planId));
    if (!row) {
      result.skipped++;
      continue;
    }
    const plan = toPublicPlan(row);
    // The next plan up: cheapest listed plan priced above this one.
    const upsell = paidOffers.find((p) => p.id !== plan.id && p.monthlyPrice > plan.monthlyPrice) ?? null;

    const email = reminderEmail({
      appName,
      firstName: u.name.split(" ")[0] || "there",
      plan,
      expiresAt,
      daysLeft,
      activeLeads: await activeLeadCount(u.id),
      upsell,
    });

    let error: string | null = null;
    try {
      await sendAppEmail({ to: u.email, ...email });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error = msg === SMTP_NOT_CONFIGURED ? "Email (SMTP) isn't set up" : msg.slice(0, 500);
    }
    const values = {
      userId: u.id,
      expiresAt,
      daysBefore: daysLeft,
      planId: row.id,
      upsellPlanId: upsell?.id ?? null,
      sentAt: new Date(),
      status: error ? "failed" : "sent",
      error,
    };
    await db
      .insert(planRemindersSent)
      .values(values)
      .onConflictDoUpdate({
        target: [planRemindersSent.userId, planRemindersSent.expiresAt, planRemindersSent.daysBefore],
        set: { status: values.status, error: values.error, sentAt: values.sentAt, upsellPlanId: values.upsellPlanId },
      });
    if (error) result.failed++;
    else result.sent++;
  }
  return result;
}
