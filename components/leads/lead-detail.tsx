"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Users,
  Send,
  Clock,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  CLOSE_OUTCOME_LABELS,
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
  isJobOpen,
  type CloseOutcome,
  type Contact,
  type JobLead,
  type JobLeadDetail,
  type LeadStatus,
  type Resume,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import { LeadActions, AddContactDialog } from "@/components/leads/lead-actions";
import { ReminderActions } from "@/components/leads/reminder-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { computeFitScore, fitBand } from "@/lib/fit";
import { useDefaultResumeId } from "@/lib/use-default-resume";
import {
  useContactsForLead,
  useOutreachForLead,
  useRemindersForLead,
  useLeadStatus,
  setLeadStatus,
  deleteContact,
} from "@/lib/mock-store";
import { cn } from "@/lib/utils";

interface Props {
  lead: JobLead;
  detail?: JobLeadDetail;
  resumes: Resume[];
}

export function LeadDetail(props: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All leads
      </Link>
      <LeadDetailContent {...props} />
    </div>
  );
}

/**
 * The lead detail body — header card + tabbed read views — with no page chrome
 * (no back link, no max-width wrapper) so it can live on the `/leads/[id]` page
 * OR inside the "View details" modal on the leads list.
 *
 * When `status`/`onStatusChange` are supplied (modal case) the status is
 * controlled by the parent so a change reflects live in the list; otherwise it
 * falls back to local state (standalone page).
 */
export function LeadDetailContent({
  lead,
  detail,
  resumes,
  resumeId,
}: Props & {
  /** Resume to score against; falls back to the user's default resume. */
  resumeId?: string;
}) {
  const contacts = useContactsForLead(lead.id);
  // Status is owned by the store so it stays in sync everywhere and closing a
  // job auto-cancels its follow-ups.
  const { status, closeOutcome } = useLeadStatus(lead.id);
  const setStatus = (s: LeadStatus, o: CloseOutcome | null = null) =>
    setLeadStatus(lead.id, s, o);
  const open = isJobOpen(status);

  const [defaultResumeId] = useDefaultResumeId();
  const scoredResumeId = resumeId || defaultResumeId;
  const fit = computeFitScore(lead.id, scoredResumeId);
  const band = fitBand(fit);
  const resumeLabel =
    resumes.find((r) => r.id === scoredResumeId)?.label ?? "resume";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg leading-snug font-medium md:text-xl">
              {lead.title}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {lead.company} · {lead.location}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={status} />
            <LeadActions
              lead={lead}
              resumes={resumes}
              status={status}
              onStatusChange={setStatus}
              canAct={open}
              hideViewDetails
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {status === "closed" && closeOutcome && (
            <span className="rounded-md bg-status-closed px-2 py-0.5 text-[11px] font-medium text-status-closed-foreground">
              {CLOSE_OUTCOME_LABELS[closeOutcome]}
            </span>
          )}
          {lead.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-ai-muted px-2 py-0.5 text-[11px] font-medium text-ai"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            Captured {lead.postedRelative}
          </span>
        </div>

        {/* Fit score vs the chosen (or default) resume */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums",
              band.chip,
            )}
          >
            {fit}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
              {band.label}
              <span className="rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
                <Sparkles className="mr-0.5 inline size-2.5" aria-hidden />
                preview
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {band.advice} · scored vs {resumeLabel}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <a
            href={lead.canonicalJobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:min-h-10"
          >
            <ExternalLink className="size-4" aria-hidden />
            Open on LinkedIn
          </a>
        </div>
      </div>

      {/* Tabbed sections — read views. Adding is done via the actions menu. */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            {contacts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">
                {contacts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab detail={detail} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab lead={lead} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-4">
          <OutreachTab leadId={lead.id} />
        </TabsContent>
        <TabsContent value="reminders" className="mt-4">
          <RemindersTab leadId={lead.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Overview: JD paste (FR-3.1) + AI summary ---------------- */

function OverviewTab({ detail }: { detail?: JobLeadDetail }) {
  const [jd, setJd] = useState(detail?.jdText ?? "");
  const [summary, setSummary] = useState(detail?.aiSummary ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function summarize() {
    if (!jd.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setError("");
    setBusy(true);
    setTimeout(() => {
      setSummary(
        "AI summary appears here once wired: a 2–3 line scan of the role, seniority, and location pulled from the pasted JD.",
      );
      setBusy(false);
    }, 700);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Job description</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Open the listing on LinkedIn, copy the description, and paste it here.
        </p>
        <Textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description…"
          className="mt-3 min-h-32"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={summarize}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ai px-3.5 text-sm font-medium text-ai-foreground hover:bg-ai/90 disabled:opacity-60"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Summarizing…" : "Summarize with AI"}
          </button>
          <p className="flex items-start gap-1.5 text-xs text-ai">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            You review everything — nothing is saved automatically.
          </p>
        </div>
      </section>

      {summary && (
        <section className="rounded-xl border border-ai/30 bg-ai-muted/40 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ai">
            <Sparkles className="size-4" aria-hidden />
            AI summary
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{summary}</p>
        </section>
      )}
    </div>
  );
}

/* ---------------- Contacts (read list) ---------------- */

function ContactsTab({ lead }: { lead: JobLead }) {
  const contacts = useContactsForLead(lead.id);
  const [editing, setEditing] = useState<Contact | null>(null);

  return (
    <>
      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="No contacts yet"
          body="Use the actions menu (⋯) above to add a recruiter or referral."
        />
      ) : (
        <ul className="space-y-2.5">
          {contacts.map((c) => (
            <li key={c.id}>
              <ContactCard
                contact={c}
                onEdit={() => setEditing(c)}
                onDelete={() => deleteContact(c.id)}
              />
            </li>
          ))}
        </ul>
      )}
      <AddContactDialog
        lead={lead}
        contact={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = contact.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{contact.name}</p>
          {contact.aiParsed && (
            <span className="inline-flex items-center gap-1 rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
              <Sparkles className="size-2.5" aria-hidden />
              AI
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {contact.title} · {CONNECTION_TYPE_LABELS[contact.connectionType]}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Edit ${contact.name}`}
        title="Edit"
        onClick={onEdit}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Delete ${contact.name}`}
        title="Delete"
        onClick={onDelete}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ---------------- Outreach (read history) ---------------- */

function OutreachTab({ leadId }: { leadId: string }) {
  const outreach = useOutreachForLead(leadId);
  if (outreach.length === 0) {
    return (
      <EmptyState
        icon={<Send className="size-5" aria-hidden />}
        title="No messages yet"
        body="Use the actions menu (⋯) above to draft outreach for a contact."
      />
    );
  }
  return (
    <ul className="space-y-2.5">
      {outreach.map((m) => (
        <li key={m.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {OUTREACH_KIND_LABELS[m.kind]} · {m.channel}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                m.status === "sent"
                  ? "bg-status-applied text-status-applied-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {m.status === "sent" ? "Sent" : "Draft"}
            </span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
            {m.sentBody ?? m.draftBody}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Reminders (read list + outcome) ---------------- */

function RemindersTab({ leadId }: { leadId: string }) {
  const reminders = useRemindersForLead(leadId);
  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="size-5" aria-hidden />}
        title="No reminders"
        body="One is scheduled automatically when you mark a message sent — or add one via the actions menu (⋯)."
      />
    );
  }
  return (
    <ul className="space-y-2.5">
      {reminders.map((r) => {
        const done = r.outcome !== "pending";
        return (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  done && "text-muted-foreground line-through",
                )}
              >
                {r.manual
                  ? r.label || "Manual reminder"
                  : `Reminder ${r.sequence}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {done ? "Done" : `Due ${r.dueDate}`}
              </p>
            </div>
            <ReminderActions reminder={r} />
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Shared ---------------- */

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
