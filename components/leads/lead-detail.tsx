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
  CheckCircle2,
  XCircle,
  Undo2,
  CircleSlash,
  Archive,
  type LucideIcon,
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
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownLite, looksLikeMarkdown } from "@/components/ui/markdown-lite";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fitBand } from "@/lib/fit";
import {
  useContactsForLead,
  useOutreachForLead,
  useRemindersForLead,
  useLeadStatus,
  useDefaultResumeId,
  useFitScore,
  scoreFit,
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

// Underline tabs: muted by default, primary text + primary underline when
// active. `group/tab` lets the count badge react to the active state.
const tabTrigger =
  "group/tab flex-none rounded-none px-3 py-2.5 text-sm font-medium " +
  "data-active:text-primary data-active:after:bottom-0 data-active:after:bg-primary";

// Per-close-outcome banner styling shown on the detail modal (why it closed).
const OUTCOME_BANNER: Record<
  CloseOutcome,
  { icon: LucideIcon; className: string }
> = {
  offer: {
    icon: CheckCircle2,
    className:
      "border-status-applied-foreground/25 bg-status-applied text-status-applied-foreground",
  },
  rejected: {
    icon: XCircle,
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
  withdrawn: {
    icon: Undo2,
    className:
      "border-status-reviewing-foreground/25 bg-status-reviewing text-status-reviewing-foreground",
  },
  "no-response": {
    icon: CircleSlash,
    className:
      "border-status-discarded-foreground/25 bg-status-discarded text-status-discarded-foreground",
  },
};

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
  // The resume the score is shown for; changing it shows that resume's cached
  // score (or NC) and rescoring computes it fresh.
  const [selectedResumeId, setSelectedResumeId] = useState(incomingResumeId);
  useEffect(() => {
    setSelectedResumeId(incomingResumeId);
  }, [lead.id, incomingResumeId]);

  const cached = useFitScore(lead.id, selectedResumeId);
  const band = cached ? fitBand(cached.score) : null;
  const resumeLabel =
    resumes.find((r) => r.id === selectedResumeId)?.label ?? "resume";
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState("");

  function pickResume(id: string) {
    setSelectedResumeId(id);
    onResumeChange?.(id);
    setScoreError("");
  }
  async function runScore() {
    setScoring(true);
    setScoreError("");
    const res = await scoreFit(lead.id, selectedResumeId);
    if (!res.ok) setScoreError(res.error);
    setScoring(false);
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

        {/* Why this lead is closed / discarded — prominent on the detail view. */}
        {status === "closed" &&
          closeOutcome &&
          (() => {
            const { icon: Icon, className } = OUTCOME_BANNER[closeOutcome];
            return (
              <div
                className={cn(
                  "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2",
                  className,
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    Closed — {CLOSE_OUTCOME_LABELS[closeOutcome]}
                  </p>
                  <p className="text-xs opacity-80">
                    Reopen it from the status menu if you need to work it again.
                  </p>
                </div>
              </div>
            );
          })()}
        {status === "discarded" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-discarded-foreground/25 bg-status-discarded px-3 py-2 text-status-discarded-foreground">
            <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Discarded</p>
              <p className="text-xs opacity-80">
                Moved to Archive and pending follow-ups were cancelled. Reopen it
                from the status menu.
              </p>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {lead.tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="rounded-md bg-ai-muted px-2 py-0.5 text-[11px] font-medium text-ai"
            >
              {tag}
            </span>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            Captured {lead.postedRelative}
          </span>
        </div>

        {/* AI fit score vs the selected resume — computed on demand */}
        <div className="mt-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums",
                cached && band ? band.chip : "bg-muted text-muted-foreground",
              )}
            >
              {cached ? cached.score : "NC"}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
                {cached && band ? band.label : "Not calculated"}
                <span className="rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
                  <Sparkles className="mr-0.5 inline size-2.5" aria-hidden />
                  AI
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {cached && band ? (
                  <>
                    {cached.rationale || band.advice} · scored vs{" "}
                    <span className="font-medium text-foreground">
                      {resumeLabel}
                    </span>
                  </>
                ) : (
                  <>
                    Not scored yet for{" "}
                    <span className="font-medium text-foreground">
                      {resumeLabel}
                    </span>
                    .
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Score / rescore against the chosen resume (AI, on demand) */}
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
                  onValueChange={(v) => pickResume(v ?? selectedResumeId)}
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
              <Button variant="outline" onClick={runScore} disabled={scoring}>
                <RefreshCw
                  className={cn("size-4", scoring && "animate-spin")}
                  aria-hidden
                />
                {scoring ? "Scoring…" : cached ? "Rescore" : "Calculate score"}
              </Button>
            </div>
          )}
          {scoreError && (
            <p className="mt-2 text-xs text-destructive">{scoreError}</p>
          )}
        </div>

        <div className="mt-4">
          <a
            href={lead.canonicalJobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "px-4")}
          >
            <ExternalLink className="size-4" aria-hidden />
            Open on LinkedIn
          </a>
        </div>
      </div>

      {/* Tabbed sections — read views. Adding is done via the actions menu. */}
      <Tabs defaultValue="overview">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
        >
          <TabsTrigger value="overview" className={tabTrigger}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="contacts" className={tabTrigger}>
            Contacts
            {contacts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground group-data-active/tab:bg-primary/10 group-data-active/tab:text-primary">
                {contacts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outreach" className={tabTrigger}>
            Outreach
          </TabsTrigger>
          <TabsTrigger value="reminders" className={tabTrigger}>
            Reminders
          </TabsTrigger>
          <TabsTrigger value="timeline" className={tabTrigger}>
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
        <div className="mt-3">
          <MarkdownEditor
            value={jd}
            onChange={setJd}
            placeholder="Paste the full job description…"
            className="min-h-32"
            ariaLabel="Job description"
          />
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={save}
            disabled={saving || busy}
            className="px-3.5"
          >
            {saving ? "Saving…" : "Save JD"}
          </Button>
          <Button
            onClick={summarize}
            disabled={saving || busy}
            className="border-transparent bg-ai px-3.5 text-ai-foreground hover:bg-ai/90"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Summarizing…" : "Save & Summarize with AI"}
          </Button>
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
  const { confirm, dialog: confirmDialog } = useConfirm();
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
                onDelete={async () => {
                  if (
                    await confirm({
                      title: "Delete contact?",
                      description: `${c.name} will be removed from this lead. This can't be undone.`,
                      confirmLabel: "Delete",
                      destructive: true,
                    })
                  ) {
                    deleteContact(c.id);
                  }
                }}
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
      {confirmDialog}
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
