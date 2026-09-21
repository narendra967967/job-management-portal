"use client";

import { useEffect, useState } from "react";
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
  UserPlus,
  RefreshCw,
} from "lucide-react";
import {
  CLOSE_OUTCOME_LABELS,
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
  isJobOpen,
  type CloseOutcome,
  type Contact,
  type JobLead,
  type JobLeadDetail,
  type LeadStatus,
  type Resume,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import {
  LeadActions,
  AddContactDialog,
  useLeadActionDialogs,
} from "@/components/leads/lead-actions";
import { ReminderActions } from "@/components/leads/reminder-actions";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownLite, looksLikeMarkdown } from "@/components/ui/markdown-lite";
import { computeFitScore, fitBand } from "@/lib/fit";
import {
  useContactsForLead,
  useOutreachForLead,
  useRemindersForLead,
  useLeadStatus,
  useDefaultResumeId,
  setLeadStatus,
  deleteContact,
  saveJd,
  summarizeJd,
} from "@/lib/mock-store";
import { cn, formatDateTime } from "@/lib/utils";

interface Props {
  lead: JobLead;
  detail?: JobLeadDetail;
  resumes: Resume[];
}

// Selected tab uses the primary color (overrides the primitive's neutral pill).
// `group/tab` lets the count badge react to the active state too.
const tabActive =
  "group/tab data-active:bg-primary data-active:text-primary-foreground " +
  "dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground";

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
  onResumeChange,
}: Props & {
  /** Resume to score against; falls back to the user's default resume. */
  resumeId?: string;
  /** Called when the user rescores against a different resume (so the caller
   *  — e.g. the leads card — can reflect the new choice). */
  onResumeChange?: (resumeId: string) => void;
}) {
  const contacts = useContactsForLead(lead.id);
  // Status is owned by the store so it stays in sync everywhere and closing a
  // job auto-cancels its follow-ups.
  const { status, closeOutcome } = useLeadStatus(lead.id);
  const setStatus = (s: LeadStatus, o: CloseOutcome | null = null) =>
    setLeadStatus(lead.id, s, o);
  const open = isJobOpen(status);

  const [defaultResumeId] = useDefaultResumeId();
  const incomingResumeId = resumeId || defaultResumeId;
  // `scored` = the resume the shown score is based on; `selected` = the resume
  // picked in the dropdown, applied on Rescore.
  const [scoredResumeId, setScoredResumeId] = useState(incomingResumeId);
  const [selectedResumeId, setSelectedResumeId] = useState(incomingResumeId);
  const [rescored, setRescored] = useState(false);
  useEffect(() => {
    setScoredResumeId(incomingResumeId);
    setSelectedResumeId(incomingResumeId);
  }, [lead.id, incomingResumeId]);

  const fit = computeFitScore(lead.id, scoredResumeId);
  const band = fitBand(fit);
  const resumeLabel =
    resumes.find((r) => r.id === scoredResumeId)?.label ?? "resume";

  function rescore() {
    setScoredResumeId(selectedResumeId);
    onResumeChange?.(selectedResumeId);
    setRescored(true);
    setTimeout(() => setRescored(false), 1500);
  }

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
        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
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
                {band.advice} · scored vs{" "}
                <span className="font-medium text-foreground">{resumeLabel}</span>
              </p>
            </div>
          </div>

          {/* Re-score against a different resume */}
          {resumes.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Score against resume
                </span>
                <Select
                  items={Object.fromEntries(
                    resumes.map((r) => [
                      r.id,
                      r.isDefault ? `${r.label} · default` : r.label,
                    ]),
                  )}
                  value={selectedResumeId}
                  onValueChange={(v) => setSelectedResumeId(v ?? selectedResumeId)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                        {r.isDefault ? " · default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={rescore}>
                  <RefreshCw className="size-4" aria-hidden />
                  Rescore
                </Button>
                {rescored && (
                  <span className="text-xs text-status-applied-foreground">
                    Rescored
                  </span>
                )}
              </div>
            </div>
          )}
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
          <TabsTrigger value="overview" className={tabActive}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="contacts" className={tabActive}>
            Contacts
            {contacts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums group-data-active/tab:bg-primary-foreground/20 group-data-active/tab:text-primary-foreground">
                {contacts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outreach" className={tabActive}>
            Outreach
          </TabsTrigger>
          <TabsTrigger value="reminders" className={tabActive}>
            Reminders
          </TabsTrigger>
          <TabsTrigger value="timeline" className={tabActive}>
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab leadId={lead.id} detail={detail} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab lead={lead} canAct={open} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-4">
          <OutreachTab lead={lead} resumes={resumes} canAct={open} />
        </TabsContent>
        <TabsContent value="reminders" className="mt-4">
          <RemindersTab leadId={lead.id} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <LeadTimeline leadId={lead.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Overview: JD paste (FR-3.1) + AI summary ---------------- */

function OverviewTab({ leadId, detail }: { leadId: string; detail?: JobLeadDetail }) {
  const [jd, setJd] = useState(detail?.jdText ?? "");
  const [summary, setSummary] = useState(detail?.aiSummary ?? "");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!jd.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setError("");
    setSaving(true);
    const res = await saveJd(leadId, jd);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } else {
      setError(res.error);
    }
    setSaving(false);
  }

  async function summarize() {
    if (!jd.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await summarizeJd(leadId, jd);
    if (res.ok) setSummary(res.summary);
    else setError(res.error);
    setBusy(false);
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
            onClick={save}
            disabled={saving || busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save JD"}
          </button>
          <button
            type="button"
            onClick={summarize}
            disabled={saving || busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ai px-3.5 text-sm font-medium text-ai-foreground hover:bg-ai/90 disabled:opacity-60"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Summarizing…" : "Save & Summarize with AI"}
          </button>
          {saved && (
            <span className="text-xs text-status-applied-foreground">Saved</span>
          )}
        </div>
      </section>

      {summary && (
        <section className="rounded-xl border border-ai/30 bg-ai-muted/40 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ai">
            <Sparkles className="size-4" aria-hidden />
            AI summary
          </h2>
          <div className="mt-2 max-h-96 overflow-y-auto pr-1">
            {looksLikeMarkdown(summary) ? (
              <MarkdownLite text={summary} />
            ) : (
              <p className="text-sm leading-relaxed break-words whitespace-pre-line">
                {summary}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- Contacts (read list) ---------------- */

function ContactsTab({ lead, canAct }: { lead: JobLead; canAct: boolean }) {
  const contacts = useContactsForLead(lead.id);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          onClick={() => setAdding(true)}
          disabled={!canAct}
          title={canAct ? "Add contact" : "Reopen this job to add contacts"}
        >
          <UserPlus className="size-4" aria-hidden />
          Add contact
        </Button>
      </div>
      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="No contacts yet"
          body="Add a recruiter, hiring manager, or referral for this lead."
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
        open={editing !== null || adding}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setAdding(false);
          }
        }}
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
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-9"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Delete ${contact.name}`}
        title="Delete"
        onClick={onDelete}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive sm:size-9"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ---------------- Outreach (read history) ---------------- */

function OutreachTab({
  lead,
  resumes,
  canAct,
}: {
  lead: JobLead;
  resumes: Resume[];
  canAct: boolean;
}) {
  const outreach = useOutreachForLead(lead.id);
  const { openDialog, dialogs } = useLeadActionDialogs(lead, resumes);

  const draftButton = (
    <div className="mb-3 flex justify-end">
      <Button
        onClick={() => openDialog("outreach")}
        disabled={!canAct}
        title={canAct ? "Draft outreach" : "Reopen this job to draft outreach"}
      >
        <Send className="size-4" aria-hidden />
        Draft outreach
      </Button>
    </div>
  );

  if (outreach.length === 0) {
    return (
      <>
        {draftButton}
        <EmptyState
          icon={<Send className="size-5" aria-hidden />}
          title="No messages yet"
          body="Draft an outreach message for one of your contacts."
        />
        {dialogs}
      </>
    );
  }
  return (
    <>
      {draftButton}
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
          <p className="mt-2 text-sm break-words whitespace-pre-line text-muted-foreground">
            {m.sentBody ?? m.draftBody}
          </p>
        </li>
        ))}
      </ul>
      {dialogs}
    </>
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
                {r.reason ??
                  (r.manual ? "Manual reminder" : `Reminder ${r.sequence}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {done
                  ? REMINDER_OUTCOME_LABELS[r.outcome]
                  : `Due ${formatDateTime(r.dueDate)}`}
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
