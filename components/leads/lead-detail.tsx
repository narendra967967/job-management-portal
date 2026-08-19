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
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  OUTREACH_KIND_LABELS,
  REMINDER_OUTCOME_LABELS,
  type Contact,
  type JobLead,
  type JobLeadDetail,
  type LeadStatus,
  type OutreachKind,
  type OutreachMessage,
  type Reminder,
  type ReminderOutcome,
  type Resume,
} from "@/lib/types";
import { StatusBadge } from "@/components/leads/status-badge";
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
  contacts: initialContacts,
  outreach,
  reminders,
  resumes,
}: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);

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
          <StatusBadge status={status} />
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as LeadStatus)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Lead status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Tabbed sections */}
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
          <ContactsTab contacts={contacts} onAdd={setContacts} />
        </TabsContent>
        <TabsContent value="outreach" className="mt-4">
          <OutreachTab
            outreach={outreach}
            contacts={contacts}
            resumes={resumes}
          />
        </TabsContent>
        <TabsContent value="reminders" className="mt-4">
          <RemindersTab reminders={reminders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- AI hint banner ---------------- */

function AiHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-ai">
      <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ---------------- Overview: JD + paste-and-parse ---------------- */

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
    // Mock AI: Phase 3 replaces this with an OpenAI Server Action.
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
          <AiHint>You review everything — nothing is saved automatically.</AiHint>
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

/* ---------------- Contacts ---------------- */

function ContactsTab({
  contacts,
  onAdd,
}: {
  contacts: Contact[];
  onAdd: React.Dispatch<React.SetStateAction<Contact[]>>;
}) {
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function parse() {
    if (!pasted.trim()) {
      setError("Paste the hiring-team or referral text first.");
      return;
    }
    setError("");
    setBusy(true);
    // Mock AI parse: Phase 3 replaces with an OpenAI Server Action.
    setTimeout(() => {
      onAdd((prev) => [
        ...prev,
        {
          id: `contact-parsed-${prev.length + 1}`,
          leadId: contacts[0]?.leadId ?? "",
          name: "Parsed contact",
          title: "Structured from pasted text",
          linkedinUrl: null,
          connectionType: "recruiter",
          aiParsed: true,
        },
      ]);
      setPasted("");
      setBusy(false);
    }, 700);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Add contacts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Paste the hiring team or a referral connection from LinkedIn — AI
          structures it into contact records for you to review.
        </p>
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="e.g. Dana Ortiz — Engineering Manager · linkedin.com/in/…"
          className="mt-3 min-h-24"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={parse}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ai px-3.5 text-sm font-medium text-ai-foreground hover:bg-ai/90 disabled:opacity-60"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Structuring…" : "Structure with AI"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-lg border px-3.5 text-sm font-medium hover:bg-muted"
          >
            Add manually
          </button>
        </div>
      </section>

      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" aria-hidden />}
          title="No contacts yet"
          body="Capture a recruiter or referral to start outreach."
        />
      ) : (
        <ul className="space-y-2.5">
          {contacts.map((c) => (
            <li key={c.id}>
              <ContactCard contact={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
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

/* ---------------- Outreach ---------------- */

function OutreachTab({
  outreach,
  contacts,
  resumes,
}: {
  outreach: OutreachMessage[];
  contacts: Contact[];
  resumes: Resume[];
}) {
  const [kind, setKind] = useState<OutreachKind>("referral-ask");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function generate() {
    if (!contactId) {
      setError("Add a contact first, then draft a message.");
      return;
    }
    setError("");
    setBusy(true);
    // Mock AI draft: Phase 3 replaces with an OpenAI Server Action.
    setTimeout(() => {
      const c = contacts.find((x) => x.id === contactId);
      setDraft(
        `Hi ${c?.name.split(" ")[0] ?? "there"},\n\nA ${OUTREACH_KIND_LABELS[
          kind
        ].toLowerCase()} draft appears here once AI is wired — grounded in the JD, your selected resume, and this contact. You review and edit before anything is sent.`,
      );
      setBusy(false);
    }, 700);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Draft a message</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <LabeledSelect
            label="Type"
            value={kind}
            onValueChange={(v) => setKind(v as OutreachKind)}
            options={Object.entries(OUTREACH_KIND_LABELS).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <LabeledSelect
            label="Contact"
            value={contactId}
            onValueChange={setContactId}
            placeholder="Select"
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
          />
          <LabeledSelect
            label="Resume"
            value={resumeId}
            onValueChange={setResumeId}
            options={resumes.map((r) => ({ value: r.id, label: r.label }))}
          />
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-3">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ai px-3.5 text-sm font-medium text-ai-foreground hover:bg-ai/90 disabled:opacity-60"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Drafting…" : "Draft with AI"}
          </button>
        </div>

        {draft && (
          <div className="mt-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-40"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Send className="size-4" aria-hidden />
                Mark as sent
              </button>
              <AiHint>
                JMP never sends for you — copy the final text and send it
                yourself, then mark it sent to start the follow-up clock.
              </AiHint>
            </div>
          </div>
        )}
      </section>

      <div>
        <h2 className="mb-2 text-sm font-medium">History</h2>
        {outreach.length === 0 ? (
          <EmptyState
            icon={<Send className="size-5" aria-hidden />}
            title="No messages yet"
            body="Drafted and sent messages are kept here per contact."
          />
        ) : (
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
                <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">
                  {m.sentBody ?? m.draftBody}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Reminders ---------------- */

function RemindersTab({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="size-5" aria-hidden />}
        title="No reminders"
        body="A follow-up reminder is scheduled automatically once you mark a message sent."
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
            <p className="text-sm font-medium">Reminder {r.sequence}</p>
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
    <Select value={outcome} onValueChange={(v) => setOutcome(v as ReminderOutcome)}>
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

/* ---------------- Shared bits ---------------- */

function LabeledSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

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
