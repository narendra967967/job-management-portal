// Local dev seed — populates the database with realistic data so the app can be
// built and tested against real persistence before auth/Gmail are wired.
//
// Idempotent: clears the app tables (and the dev user) first, then re-inserts.
// Safe to run repeatedly. NEVER run against a production database.
//
//   npm run db:seed
//
// The dev user id is fixed (DEV_USER_ID, default "dev-user") so the Phase-3 data
// layer can fall back to it until Google login provides a real session user.

import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { hashPassword } from "../lib/password";

config({ path: ".env.local" });
config();

const DEV_USER_ID = process.env.DEV_USER_ID ?? "dev-user";
const DEV_EMAIL = process.env.ALLOWED_EMAIL ?? "narendragpt967967@gmail.com";
// Initial admin-provisioned login (change later via an admin dashboard).
const DEV_PASSWORD = process.env.DEV_PASSWORD ?? "admin1234";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local).");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const d = (s: string) => new Date(`${s}T12:00:00Z`);

  console.log("Clearing existing data…");
  // Children first (FKs). CASCADE on the user delete would also work, but be
  // explicit so a partial schema doesn't surprise us.
  await db.delete(schema.tasks);
  await db.delete(schema.reminders);
  await db.delete(schema.outreachMessages);
  await db.delete(schema.contacts);
  await db.delete(schema.jobLeadDetails);
  await db.delete(schema.jobLeads);
  await db.delete(schema.userSettings);
  await db.delete(schema.gmailConfig);
  await db.delete(schema.resumes);
  // Better Auth tables — remove the dev user last.
  await db.delete(schema.user).where(eq(schema.user.id, DEV_USER_ID));

  console.log(`Seeding dev user ${DEV_USER_ID} (${DEV_EMAIL})…`);
  await db.insert(schema.user).values({
    id: DEV_USER_ID,
    name: "Narendra Gupta",
    email: DEV_EMAIL,
    emailVerified: true,
    mobile: "+1 (555) 018-2245",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Credential login (email + password) — Better Auth's "credential" account.
  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: DEV_USER_ID,
    providerId: "credential",
    userId: DEV_USER_ID,
    password: await hashPassword(DEV_PASSWORD),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Resumes (one default).
  const resumePm = randomUUID();
  const resumeEng = randomUUID();
  await db.insert(schema.resumes).values([
    {
      id: resumePm,
      userId: DEV_USER_ID,
      label: "PM — Payments focus",
      fileName: "Gupta_PM_Payments.pdf",
      fileType: "pdf",
      sizeKb: 212,
      blobUrl: "seed://Gupta_PM_Payments.pdf",
      isDefault: true,
    },
    {
      id: resumeEng,
      userId: DEV_USER_ID,
      label: "Eng Leadership",
      fileName: "Gupta_Eng_Leadership.pdf",
      fileType: "pdf",
      sizeKb: 188,
      blobUrl: "seed://Gupta_Eng_Leadership.pdf",
      isDefault: false,
    },
  ]);

  // Settings + Gmail config.
  await db.insert(schema.userSettings).values({
    userId: DEV_USER_ID,
    reminderIntervalDays: 3,
    staleLeadDays: 14,
    defaultResumeId: resumePm,
    aiProvider: "openai",
    aiModel: null,
  });
  await db.insert(schema.gmailConfig).values({
    userId: DEV_USER_ID,
    senders: ["jobalerts-noreply@linkedin.com"],
    // No label/subject filter by default: LinkedIn alert subjects are the top
    // job's title (e.g. "Project Manager at Acme"), not "job alert", and most
    // inboxes have no "Job Alerts" label — either clause silently excludes real
    // alerts. Sender + lookback is the reliable default.
    label: "",
    subjectKeywords: "",
    lookbackDays: 30,
    connected: false,
  });

  // Leads across statuses.
  const leadStripe = randomUUID();
  const leadDatadog = randomUUID();
  const leadAdyen = randomUUID();
  const leadOptum = randomUUID();
  await db.insert(schema.jobLeads).values([
    {
      id: leadOptum,
      userId: DEV_USER_ID,
      linkedinJobId: "3901234567",
      title: "Delivery Manager — Remote",
      company: "Optum",
      location: "Eden Prairie, MN",
      remote: true,
      tags: ["Actively recruiting"],
      postedRelative: "3 days ago",
      canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901234567",
      status: "new",
      capturedAt: d("2026-08-16"),
    },
    {
      id: leadStripe,
      userId: DEV_USER_ID,
      linkedinJobId: "3901234222",
      title: "Senior Product Manager",
      company: "Stripe",
      location: "Remote (US)",
      remote: true,
      tags: ["Actively recruiting", "Early applicant"],
      postedRelative: "1 day ago",
      canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901234222",
      status: "reviewing",
      capturedAt: d("2026-08-18"),
    },
    {
      id: leadDatadog,
      userId: DEV_USER_ID,
      linkedinJobId: "3901230000",
      title: "Engineering Lead, Platform",
      company: "Datadog",
      location: "New York, NY",
      remote: false,
      tags: ["Actively recruiting"],
      postedRelative: "5 days ago",
      canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901230000",
      status: "applied",
      capturedAt: d("2026-08-14"),
    },
    {
      id: leadAdyen,
      userId: DEV_USER_ID,
      linkedinJobId: "3901111111",
      title: "Group Product Manager, Payments",
      company: "Adyen",
      location: "Remote (EU)",
      remote: true,
      tags: [],
      postedRelative: "6 days ago",
      canonicalJobUrl: "https://www.linkedin.com/jobs/view/3901111111",
      status: "reviewing",
      capturedAt: d("2026-08-13"),
    },
  ]);

  await db.insert(schema.jobLeadDetails).values([
    {
      leadId: leadStripe,
      userId: DEV_USER_ID,
      jdText:
        "Stripe is looking for a Senior Product Manager to own the payments acceptance experience…",
      aiSummary:
        "Senior PM owning payments acceptance at Stripe. High-scale reliability, cross-functional leadership. Remote (US).",
      notes: "Referral from Priya could help — she moved to Stripe last year.",
    },
    {
      leadId: leadDatadog,
      userId: DEV_USER_ID,
      jdText:
        "Datadog seeks an Engineering Lead for the Platform team to guide senior engineers building the observability pipeline…",
      aiSummary:
        "Engineering leadership over Datadog's observability pipeline. On-site NYC. Distributed-systems background.",
      notes: null,
    },
  ]);

  // Contacts — Priya recurs on Stripe + Adyen (cross-lead history, FR-6.1).
  const cPriyaStripe = randomUUID();
  const cMarcus = randomUUID();
  const cDana = randomUUID();
  const cPriyaAdyen = randomUUID();
  await db.insert(schema.contacts).values([
    {
      id: cPriyaStripe,
      userId: DEV_USER_ID,
      leadId: leadStripe,
      name: "Priya Nair",
      title: "Staff Product Manager",
      linkedinUrl: "https://www.linkedin.com/in/priya-nair",
      connectionType: "referral",
      aiParsed: true,
      addedAt: d("2026-08-18"),
    },
    {
      id: cMarcus,
      userId: DEV_USER_ID,
      leadId: leadStripe,
      name: "Marcus Webb",
      title: "Technical Recruiter",
      linkedinUrl: "https://www.linkedin.com/in/marcus-webb",
      connectionType: "recruiter",
      aiParsed: true,
      addedAt: d("2026-08-19"),
    },
    {
      id: cDana,
      userId: DEV_USER_ID,
      leadId: leadDatadog,
      name: "Dana Ortiz",
      title: "Engineering Manager",
      linkedinUrl: "https://www.linkedin.com/in/dana-ortiz",
      connectionType: "hiring-manager",
      aiParsed: false,
      addedAt: d("2026-08-14"),
    },
    {
      id: cPriyaAdyen,
      userId: DEV_USER_ID,
      leadId: leadAdyen,
      name: "Priya Nair",
      title: "Staff Product Manager",
      linkedinUrl: "https://www.linkedin.com/in/priya-nair",
      connectionType: "referral",
      aiParsed: false,
      addedAt: d("2026-08-20"),
    },
  ]);

  // Outreach: cold outreach to Dana (Datadog), referral ask to Priya (Adyen).
  const msgDana = randomUUID();
  const msgPriya = randomUUID();
  await db.insert(schema.outreachMessages).values([
    {
      id: msgDana,
      userId: DEV_USER_ID,
      leadId: leadDatadog,
      contactId: cDana,
      kind: "cold-outreach",
      channel: "LinkedIn",
      status: "sent",
      draftBody: "Hi Dana, I saw the Engineering Lead role on the Platform team…",
      sentBody:
        "Hi Dana, I saw the Engineering Lead, Platform role and wanted to reach out directly…",
      resumeId: resumeEng,
      createdAt: d("2026-08-15"),
      sentAt: d("2026-08-15"),
    },
    {
      id: msgPriya,
      userId: DEV_USER_ID,
      leadId: leadAdyen,
      contactId: cPriyaAdyen,
      kind: "referral-ask",
      channel: "LinkedIn",
      status: "sent",
      draftBody: "Hi Priya, we spoke about the Stripe PM role — Adyen is hiring too…",
      sentBody:
        "Hi Priya, we connected over the Stripe payments PM role. Adyen just posted a Group PM, Payments position — would you be open to a quick intro?",
      resumeId: resumePm,
      createdAt: d("2026-08-20"),
      sentAt: d("2026-08-20"),
    },
  ]);

  // A reminder for the Datadog outreach + its linked follow-up task.
  const remDatadog = randomUUID();
  await db.insert(schema.reminders).values({
    id: remDatadog,
    userId: DEV_USER_ID,
    leadId: leadDatadog,
    outreachMessageId: msgDana,
    sequence: 1,
    dueDate: "2026-08-18",
    outcome: "pending",
    manual: false,
  });
  await db.insert(schema.tasks).values({
    id: randomUUID(),
    userId: DEV_USER_ID,
    jobId: leadDatadog,
    reminderId: remDatadog,
    title: "Follow up — Datadog",
    kind: "follow-up",
    dueDate: "2026-08-18",
    status: "open",
  });

  console.log("Seed complete.");
  console.log(`Login: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
