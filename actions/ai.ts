"use server";

// AI Server Actions (Milestone C) — real summaries / contact structuring /
// outreach drafting via the user's configured provider + key (lib/ai). Each
// returns a serializable result so the client can show a friendly error (e.g.
// when no API key is set in Settings). Scoped to the current user.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/current-user";
import { aiComplete, AI_NOT_CONFIGURED } from "@/lib/ai";
import {
  contacts as contactsT,
  jobLeadDetails as detailsT,
  jobLeads as leadsT,
} from "@/db/schema";
import {
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
  type ConnectionType,
  type OutreachKind,
} from "@/lib/types";

const NO_KEY_MSG =
  "No AI key configured. Add your API key in Settings → AI provider.";

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === AI_NOT_CONFIGURED) return NO_KEY_MSG;
  return msg || "AI request failed.";
}

/* ---------------- JD summary (FR-3.3) — stores JD + summary ---------------- */

export async function summarizeJdAction(
  leadId: string,
  jdText: string,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const text = jdText.trim();
  if (!text) return { ok: false, error: "Paste the job description first." };

  const [lead] = await db
    .select({ id: leadsT.id })
    .from(leadsT)
    .where(and(eq(leadsT.id, leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  // Persist the pasted JD immediately (FR-3.1/3.3) so it's saved to this lead
  // even if the AI summary fails (e.g. no API key). Keep any existing summary.
  await db
    .insert(detailsT)
    .values({ leadId, jdText: text })
    .onConflictDoUpdate({ target: detailsT.leadId, set: { jdText: text } });

  try {
    const summary = await aiComplete(
      userId,
      "You summarize job descriptions in 2–3 short lines for quick scanning — role, seniority, location, and key focus. No preamble, no bullet points.",
      text,
      300,
    );
    await db
      .update(detailsT)
      .set({ aiSummary: summary })
      .where(eq(detailsT.leadId, leadId));
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

/* ---------------- Structure pasted contact text (FR-3.2) ------------------- */

export interface ParsedContact {
  name: string;
  title: string;
  linkedinUrl: string;
  connectionType: ConnectionType;
}

const CONNECTION_TYPES = Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[];

export async function structureContactAction(
  pastedText: string,
): Promise<{ ok: true; contact: ParsedContact } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  const text = pastedText.trim();
  if (!text)
    return { ok: false, error: "Paste the hiring-team or referral text first." };

  try {
    const raw = await aiComplete(
      userId,
      'Extract a single contact from pasted LinkedIn hiring-team/referral text. Reply with ONLY minified JSON: {"name","title","linkedinUrl","connectionType"}. connectionType must be one of: recruiter, referral, hiring-manager, other. Use "" for any unknown field.',
      text,
      200,
    );
    const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(json) as Partial<ParsedContact>;
    const connectionType = CONNECTION_TYPES.includes(
      parsed.connectionType as ConnectionType,
    )
      ? (parsed.connectionType as ConnectionType)
      : "other";
    return {
      ok: true,
      contact: {
        name: (parsed.name ?? "").toString(),
        title: (parsed.title ?? "").toString(),
        linkedinUrl: (parsed.linkedinUrl ?? "").toString(),
        connectionType,
      },
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        ok: false,
        error: "Couldn't parse that automatically — please fill the fields manually.",
      };
    }
    return { ok: false, error: friendly(err) };
  }
}

/* ---------------- Draft outreach (FR-4.1 / FR-4.2) ------------------------- */

export async function draftOutreachAction(input: {
  leadId: string;
  contactId: string;
  kind: OutreachKind;
  resumeLabel: string;
}): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();

  const [lead] = await db
    .select({ title: leadsT.title, company: leadsT.company })
    .from(leadsT)
    .where(and(eq(leadsT.id, input.leadId), eq(leadsT.userId, userId)));
  if (!lead) return { ok: false, error: "Lead not found." };

  const [contact] = await db
    .select({
      name: contactsT.name,
      title: contactsT.title,
      connectionType: contactsT.connectionType,
    })
    .from(contactsT)
    .where(and(eq(contactsT.id, input.contactId), eq(contactsT.userId, userId)));
  if (!contact) return { ok: false, error: "Contact not found." };

  const [detail] = await db
    .select({ jdText: detailsT.jdText, aiSummary: detailsT.aiSummary })
    .from(detailsT)
    .where(eq(detailsT.leadId, input.leadId));

  const jd = detail?.aiSummary || detail?.jdText || "(no job description saved yet)";

  const context = [
    `Message type: ${OUTREACH_KIND_LABELS[input.kind]}`,
    `Recipient: ${contact.name}${contact.title ? `, ${contact.title}` : ""} (${CONNECTION_TYPE_LABELS[contact.connectionType]})`,
    `Role: ${lead.title} at ${lead.company}`,
    `My resume: ${input.resumeLabel}`,
    `Job context: ${jd}`,
  ].join("\n");

  try {
    const draft = await aiComplete(
      userId,
      "You draft short, professional LinkedIn outreach for a job seeker (120–160 words). Warm, specific to the role and recipient, no fluff or clichés. Start with a greeting using the recipient's first name. The user will review and edit before sending, so do not invent specific facts about the sender beyond the resume label.",
      context,
      500,
    );
    return { ok: true, draft };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
