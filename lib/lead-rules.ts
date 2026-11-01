import "server-only";

// The daily run of each user's automatic lead rules (lib/lead-rules-model.ts).
// Called from the daily cron route. Every move is recorded in lead_auto_actions,
// which is what the card's message, Undo and the Timeline read, and each user
// gets one summary notification per run.

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contacts as contactsT,
  fitScores as fitScoresT,
  jobLeads as leadsT,
  leadAutoActions as autoActionsT,
  outreachMessages as outreachT,
  reminders as remindersT,
  resumes as resumesT,
  tasks as tasksT,
  userSettings as settingsT,
} from "@/db/schema";
import {
  decideLeadRule,
  normalizeLeadRules,
  type LeadRules,
  type RuleDecision,
} from "@/lib/lead-rules-model";
import { createNotification } from "@/lib/notifications";
import type { LeadStatus } from "@/lib/types";

/** Stages rules can act on. Interview and Offer Received are clearly active. */
const RULE_STATUSES: LeadStatus[] = ["new", "shortlisted", "applied"];

export interface LeadRulesRunResult {
  users: number;
  moved: number;
}

/** A user's rules, with defaults for anything not set. */
export async function getLeadRules(userId: string): Promise<LeadRules> {
  const [row] = await db
    .select({ leadRules: settingsT.leadRules })
    .from(settingsT)
    .where(eq(settingsT.userId, userId));
  return normalizeLeadRules(row?.leadRules);
}

/** `userId` limits the run to one account. */
export async function runLeadRules(opts: { userId?: string } = {}): Promise<LeadRulesRunResult> {
  const owners = await db
    .selectDistinct({ userId: leadsT.userId })
    .from(leadsT)
    .where(
      and(
        inArray(leadsT.status, RULE_STATUSES),
        opts.userId ? eq(leadsT.userId, opts.userId) : undefined,
      ),
    );

  const result: LeadRulesRunResult = { users: 0, moved: 0 };
  for (const { userId } of owners) {
    try {
      const decisions = await runForUser(userId);
      if (decisions.length) {
        result.users++;
        result.moved += decisions.length;
        await notifySummary(userId, decisions);
      }
    } catch (e) {
      // One account's failure shouldn't stop everyone else's cleanup.
      console.error("lead rules failed for a user", e);
    }
  }
  return result;
}

async function runForUser(userId: string): Promise<RuleDecision[]> {
  const rules = await getLeadRules(userId);
  const leads = await db
    .select({
      id: leadsT.id,
      status: leadsT.status,
      capturedAt: leadsT.capturedAt,
      updatedAt: leadsT.updatedAt,
    })
    .from(leadsT)
    .where(
      and(
        eq(leadsT.userId, userId),
        inArray(leadsT.status, RULE_STATUSES),
        eq(leadsT.topChoice, false),
        eq(leadsT.statusPinned, false),
      ),
    );
  if (!leads.length) return [];

  const [contacts, outreach, reminders, openTasks, undone, defaultResumeId] =
    await Promise.all([
      db
        .select({ leadId: contactsT.leadId, at: sql<Date>`max(${contactsT.updatedAt})` })
        .from(contactsT)
        .where(eq(contactsT.userId, userId))
        .groupBy(contactsT.leadId),
      db
        .select({ leadId: outreachT.leadId, at: sql<Date>`max(coalesce(${outreachT.sentAt}, ${outreachT.createdAt}))` })
        .from(outreachT)
        .where(eq(outreachT.userId, userId))
        .groupBy(outreachT.leadId),
      db
        .select({ leadId: remindersT.leadId, outcome: remindersT.outcome, at: remindersT.updatedAt })
        .from(remindersT)
        .where(eq(remindersT.userId, userId)),
      db
        .select({ jobId: tasksT.jobId })
        .from(tasksT)
        .where(and(eq(tasksT.userId, userId), eq(tasksT.status, "open"))),
      db
        .select({ leadId: autoActionsT.leadId, rule: autoActionsT.rule })
        .from(autoActionsT)
        .where(and(eq(autoActionsT.userId, userId), sql`${autoActionsT.undoneAt} is not null`)),
      defaultResumeFor(userId),
    ]);

  const scores = defaultResumeId
    ? await db
        .select({ leadId: fitScoresT.leadId, score: fitScoresT.score, at: fitScoresT.updatedAt })
        .from(fitScoresT)
        .where(and(eq(fitScoresT.userId, userId), eq(fitScoresT.resumeId, defaultResumeId)))
    : [];
  const scoreByLead = new Map(scores.map((s) => [s.leadId, s]));

  const activity = new Map<string, number>();
  const touch = (leadId: string, at: Date | string | null) => {
    if (!at) return;
    const ms = new Date(at).getTime();
    if (ms > (activity.get(leadId) ?? 0)) activity.set(leadId, ms);
  };
  for (const c of contacts) touch(c.leadId, c.at);
  for (const o of outreach) touch(o.leadId, o.at);
  for (const r of reminders) touch(r.leadId, r.at);

  const pending = new Set<string>();
  const responded = new Set<string>();
  const followedUp = new Set<string>();
  for (const r of reminders) {
    if (r.outcome === "pending") pending.add(r.leadId);
    if (r.outcome === "response-received") responded.add(r.leadId);
    if (r.outcome === "reminder-sent" || r.outcome === "not-responded") followedUp.add(r.leadId);
  }
  const withOpenTask = new Set(openTasks.map((t) => t.jobId));
  const undoneByLead = new Map<string, Set<string>>();
  for (const u of undone) {
    if (!undoneByLead.has(u.leadId)) undoneByLead.set(u.leadId, new Set());
    undoneByLead.get(u.leadId)!.add(u.rule);
  }

  const now = Date.now();
  const applied: RuleDecision[] = [];
  for (const lead of leads) {
    if (pending.has(lead.id) || withOpenTask.has(lead.id)) continue;
    const score = scoreByLead.get(lead.id);
    const decision = decideLeadRule(
      {
        status: lead.status,
        lastActiveMs: Math.max(
          lead.capturedAt.getTime(),
          lead.updatedAt.getTime(),
          activity.get(lead.id) ?? 0,
        ),
        score: score?.score ?? null,
        scoredMs: score ? score.at.getTime() : null,
        followUpsUnanswered: followedUp.has(lead.id) && !responded.has(lead.id),
        undoneRules: undoneByLead.get(lead.id) ?? new Set(),
      },
      rules,
      now,
    );
    if (!decision) continue;

    const moved = await db.transaction(async (tx) => {
      // Guard on the status we read, so a change made a moment ago wins.
      const rows = await tx
        .update(leadsT)
        .set({ status: decision.toStatus, closeOutcome: decision.closeOutcome })
        .where(and(eq(leadsT.id, lead.id), eq(leadsT.userId, userId), eq(leadsT.status, lead.status)))
        .returning({ id: leadsT.id });
      if (!rows.length) return false;
      await tx.insert(autoActionsT).values({
        userId,
        leadId: lead.id,
        rule: decision.rule,
        fromStatus: lead.status,
        toStatus: decision.toStatus,
        reason: decision.reason,
      });
      return true;
    });
    if (moved) applied.push(decision);
  }
  return applied;
}

async function defaultResumeFor(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: resumesT.id })
    .from(resumesT)
    .where(and(eq(resumesT.userId, userId), eq(resumesT.isDefault, true)));
  return row?.id ?? null;
}

/** One line per kind of move, so a big first run stays a single notification. */
async function notifySummary(userId: string, decisions: RuleDecision[]) {
  const count = (test: (d: RuleDecision) => boolean) => decisions.filter(test).length;
  const parts = [
    [count((d) => d.closeOutcome === "position-closed"), "closed as likely filled"],
    [count((d) => d.closeOutcome === "no-response"), "closed with no response"],
    [count((d) => d.toStatus === "discarded"), "discarded for low fit"],
    [count((d) => d.toStatus === "shortlisted"), "moved to Shortlisted"],
  ] as const;
  const body = parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(", ");
  const onlyShortlisted = decisions.every((d) => d.toStatus === "shortlisted");
  await createNotification(userId, {
    type: "lead-rules",
    title: `${decisions.length} lead${decisions.length === 1 ? "" : "s"} moved automatically`,
    body: `${body}. Each card says why and has an Undo button.`,
    href: onlyShortlisted ? "/leads" : "/archive",
  });
}
