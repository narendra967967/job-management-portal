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
} from "lucide-react";
import {
  CONNECTION_TYPE_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
  type Contact,
  type JobLead,
  type JobLeadDetail,
  type LeadStatus,
  type OutreachMessage,
  type Reminder,
  type ReminderOutcome,
  type Resume,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
import { LeadActions } from "@/components/leads/lead-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  lead: JobLead;
  detail?: JobLeadDetail;
  contacts: Contact[];
  outreach: OutreachMessage[];
  reminders: Reminder[];
  resumes: Resume[];
}

export function LeadDetail({
  lead,
  detail,
  contacts,
  outreach,
  reminders,
  resumes,
}: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All leads
      </Link>

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
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
          <ContactsTab contacts={contacts} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-4">
          <OutreachTab outreach={outreach} />
        </TabsContent>
        <TabsContent value="reminders" className="mt-4">
          <RemindersTab reminders={reminders} />
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

function ContactsTab({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-5" aria-hidden />}
        title="No contacts yet"
        body="Use the actions menu (⋯) above to add a recruiter or referral."
      />
    );
  }
  return (
    <ul className="space-y-2.5">
      {contacts.map((c) => (
        <li key={c.id}>
          <ContactCard contact={c} />
        </li>
      ))}
    </ul>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
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
        <p className="truncate text-xs text-muted-foreground">{contact.title}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {CONNECTION_TYPE_LABELS[contact.connectionType]}
      </span>
    </div>
  );
}

/* ---------------- Outreach (read history) ---------------- */

function OutreachTab({ outreach }: { outreach: OutreachMessage[] }) {
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

function RemindersTab({ reminders }: { reminders: Reminder[] }) {
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
      {reminders.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium">
              {r.manual ? r.label || "Manual reminder" : `Reminder ${r.sequence}`}
            </p>
            <p className="text-xs text-muted-foreground">Due {r.dueDate}</p>
          </div>
          <ReminderOutcomeSelect initial={r.outcome} />
        </li>
      ))}
    </ul>
  );
}

function ReminderOutcomeSelect({ initial }: { initial: ReminderOutcome }) {
  const [outcome, setOutcome] = useState<ReminderOutcome>(initial);
  return (
    <Select value={outcome} onValueChange={(v) => setOutcome((v as ReminderOutcome) ?? initial)}>
      <SelectTrigger className="w-full sm:w-52" aria-label="Reminder outcome">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(REMINDER_OUTCOME_LABELS).map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
