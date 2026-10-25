import { getAppName } from "@/lib/branding";
import { supportedSiteExamples } from "@/lib/email-intake-data";
import { absoluteUrl } from "@/lib/site-url";
import { freeStartLabel } from "@/lib/plans";
import { getPricingPlans } from "@/lib/pricing";
import { upgradeSentence } from "@/lib/plan-highlights";

// /llms.txt — a plain summary of the product for AI assistants and answer
// engines (llmstxt.org format). Public facts only; no infrastructure details.

export const dynamic = "force-dynamic";

export async function GET() {
  const [appName, sites, freeStart, pricingPlans] = await Promise.all([
    getAppName(),
    supportedSiteExamples().catch(() => "LinkedIn and Naukri"),
    freeStartLabel().catch(() => ({ label: "free trial", trialDays: 14 })),
    getPricingPlans(),
  ]);
  const upgrade = upgradeSentence(pricingPlans, 20);

  const body = `# ${appName}

> ${appName} is a job application tracker with AI. It turns the job alerts people forward from their email into organized job leads, scores each role against their résumé, checks résumés for applicant tracking systems (ATS) and helps write better applications. It never applies to jobs or sends messages on the user's behalf.

## What it does

- Turns job alerts into leads: users forward alerts from job sites such as ${sites}, and many more, to a private address; each job becomes a lead within seconds, and repeats refresh the existing lead.
- Adds jobs from a pasted job post or a screenshot: AI fills in the details and keeps the job description word for word.
- Tracks every application through stages: New, Shortlisted, Applied, Interview and Offer, with top-choice starring, a board view and a list view.
- Scores how well each job fits the user's résumé, with salary estimates on supported plans.
- Checks résumés for ATS: a score out of 100, missing keywords and specific fixes (supported plans).
- Keeps a career profile (target roles, skills, preferences) that the AI uses for scoring, résumé checks and drafts.
- Drafts tailored applications and recruiter or referral outreach; the user edits and sends them.
- Reminders, to-dos and recruiter contacts kept with each job.

## Who it is for

Job seekers who prefer to apply carefully to fewer, well-matched roles rather than mass-apply. It suits busy, mid-career professionals especially well.

## Key facts

- Not an auto-apply tool: the user always reviews and applies.
- Privacy: it never connects to the user's mailbox; it only receives the job alerts they forward and keeps the job details, not the emails. Data is not sold or used for advertising.
- AI runs on the user's own API key from OpenAI, Anthropic or OpenRouter.
- Users can see every email that reached their address, export their leads, reset them, or request account deletion from Settings.
- Plans: new accounts start with a ${freeStart.label}.${upgrade ? ` ${upgrade}` : ""} Prices are on the pricing page.

## Pages

- [Home](${absoluteUrl("/")}): product overview and FAQ
- [Pricing](${absoluteUrl("/pricing")}): plans, prices and what each includes
- [Sign up](${absoluteUrl("/signup")}): create a free account
- [Privacy policy](${absoluteUrl("/privacy")})
- [Terms & conditions](${absoluteUrl("/terms")})
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
