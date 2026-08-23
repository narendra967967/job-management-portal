"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  UserPlus,
  BellPlus,
  Sparkles,
  Send,
  ExternalLink,
  CircleDot,
  Archive,
  Flag,
} from "lucide-react";
import {
  CLOSE_OUTCOME_LABELS,
  CONNECTION_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  OPEN_LEAD_STATUSES,
  OUTREACH_KIND_LABELS,
  isJobOpen,
  type CloseOutcome,
  type Contact,
  type ConnectionType,
  type JobLead,
  type LeadStatus,
  type OutreachKind,
  type Resume,
} from "@/lib/types";
import { getOutreachForLead } from "@/lib/mock-data";
import { computeFitScore, fitBand } from "@/lib/fit";
import { getReminderIntervalDays } from "@/lib/use-app-settings";
import {
  addContact,
  addOutreach,
  addReminder,
  nextReminderSequence,
  updateContact,
  useContactsForLead,
} from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DialogKind = "contact" | "reminder" | "outreach" | null;

export function LeadActions({
  lead,
  resumes,
  status,
  onStatusChange,
  onViewDetails,
  hideViewDetails,
  canAct,
  className,
}: {
  lead: JobLead;
  resumes: Resume[];
  status: LeadStatus;
  onStatusChange?: (status: LeadStatus, outcome?: CloseOutcome | null) => void;
  /** Open the detail modal. When omitted, "View details" navigates to the page. */
  onViewDetails?: () => void;
  /** Hide the "View details" item (e.g. when already on the detail view). */
  hideViewDetails?: boolean;
  /** Whether create-actions (contact/reminder/draft) are allowed (job open). */
  canAct?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const canActNow = canAct ?? isJobOpen(status);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${lead.title}`}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            className,
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">
              {lead.title}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {!hideViewDetails && (
            <DropdownMenuItem
              onClick={() =>
                onViewDetails
                  ? onViewDetails()
                  : router.push(`/leads/${lead.id}`)
              }
            >
              <Eye className="size-4" aria-hidden />
              View details
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CircleDot className="size-4" aria-hidden />
              Change status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={isJobOpen(status) ? status : ""}
                onValueChange={(v) => onStatusChange?.(v as LeadStatus)}
              >
                {OPEN_LEAD_STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStatusChange?.("discarded")}>
                <Archive className="size-4" aria-hidden />
                Discard
              </DropdownMenuItem>
              {(Object.keys(CLOSE_OUTCOME_LABELS) as CloseOutcome[]).map((o) => (
                <DropdownMenuItem
                  key={o}
                  onClick={() => onStatusChange?.("closed", o)}
                >
                  <Flag className="size-4" aria-hidden />
                  Close · {CLOSE_OUTCOME_LABELS[o]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canActNow}
            onClick={() => setDialog("contact")}
          >
            <UserPlus className="size-4" aria-hidden />
            Add contact
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canActNow}
            onClick={() => setDialog("reminder")}
          >
            <BellPlus className="size-4" aria-hidden />
            Add reminder
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canActNow}
            onClick={() => setDialog("outreach")}
          >
            <Send className="size-4" aria-hidden />
            Draft outreach
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              window.open(lead.canonicalJobUrl, "_blank", "noopener")
            }
          >
            <ExternalLink className="size-4" aria-hidden />
            Open on LinkedIn
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LeadActionDialogs
        lead={lead}
        resumes={resumes}
        dialog={dialog}
        onDialogChange={setDialog}
      />
    </>
  );
}

/**
 * The three action dialogs (add contact / add reminder / draft outreach) plus a
 * hook to open them. Lets a surface (e.g. the lead card) trigger the same
 * dialogs from its own inline buttons without the dropdown menu.
 */
export function LeadActionDialogs({
  lead,
  resumes,
  dialog,
  onDialogChange,
  selectedResumeId,
  onResumeChange,
}: {
  lead: JobLead;
  resumes: Resume[];
  dialog: DialogKind;
  onDialogChange: (dialog: DialogKind) => void;
  /** Resume pre-selected in the draft panel (a lead's choice or the default). */
  selectedResumeId?: string;
  /** Called when the user picks a different resume for this lead. */
  onResumeChange?: (resumeId: string) => void;
}) {
  return (
    <>
      <AddContactDialog
        lead={lead}
        open={dialog === "contact"}
        onOpenChange={(o) => onDialogChange(o ? "contact" : null)}
      />
      <AddReminderDialog
        lead={lead}
        open={dialog === "reminder"}
        onOpenChange={(o) => onDialogChange(o ? "reminder" : null)}
      />
      <DraftOutreachDialog
        lead={lead}
        resumes={resumes}
        selectedResumeId={selectedResumeId}
        onResumeChange={onResumeChange}
        open={dialog === "outreach"}
        onOpenChange={(o) => onDialogChange(o ? "outreach" : null)}
      />
    </>
  );
}

/** Manages the action-dialog state and renders them; returns an opener. */
export function useLeadActionDialogs(
  lead: JobLead,
  resumes: Resume[],
  options?: {
    selectedResumeId?: string;
    onResumeChange?: (resumeId: string) => void;
  },
) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const dialogs = (
    <LeadActionDialogs
      lead={lead}
      resumes={resumes}
      dialog={dialog}
      onDialogChange={setDialog}
      selectedResumeId={options?.selectedResumeId}
      onResumeChange={options?.onResumeChange}
    />
  );
  return { openDialog: (kind: Exclude<DialogKind, null>) => setDialog(kind), dialogs };
}

/* ------------------------------------------------------------------ */
/* Add contact                                                         */
/* ------------------------------------------------------------------ */

export function AddContactDialog({
  lead,
  contact,
  open,
  onOpenChange,
}: {
  lead: JobLead;
  /** When provided, the dialog edits this contact instead of adding one. */
  contact?: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = !!contact;
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [aiParsed, setAiParsed] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ConnectionType>("recruiter");
  const [error, setError] = useState("");

  // Sync fields when the dialog opens (prefill for edit, blank for add).
  useEffect(() => {
    if (!open) return;
    if (contact) {
      setName(contact.name);
      setTitle(contact.title);
      setUrl(contact.linkedinUrl ?? "");
      setType(contact.connectionType);
    } else {
      setName("");
      setTitle("");
      setUrl("");
      setType("recruiter");
    }
    setPasted("");
    setAiParsed(false);
    setError("");
  }, [open, contact]);

  function structure() {
    if (!pasted.trim()) {
      setError("Paste the hiring-team or referral text first.");
      return;
    }
    setError("");
    setParsing(true);
    // Mock AI parse — Phase 3 replaces with an OpenAI Server Action that fills
    // these fields for the user to review.
    setTimeout(() => {
      setName("Parsed name");
      setTitle("Parsed title");
      setUrl("");
      setType("recruiter");
      setAiParsed(true);
      setParsing(false);
    }, 700);
  }

  function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (editing && contact) {
      updateContact(contact.id, {
        name,
        title,
        linkedinUrl: url,
        connectionType: type,
      });
    } else {
      addContact({
        leadId: lead.id,
        name,
        title,
        linkedinUrl: url,
        connectionType: type,
        aiParsed,
      });
    }
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<UserPlus className="size-4" aria-hidden />}
      title={editing ? "Edit contact" : "Add contact"}
      description={`${lead.company} · ${lead.title}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{editing ? "Save changes" : "Save contact"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!editing && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <Label htmlFor="paste-contact" className="text-ai">
              <Sparkles className="size-3.5" aria-hidden />
              Paste &amp; structure with AI
            </Label>
            <Textarea
              id="paste-contact"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste hiring-team or referral text from LinkedIn…"
              className="mt-2 min-h-20"
            />
            <Button
              variant="outline"
              onClick={structure}
              disabled={parsing}
              className="mt-2 border-ai/40 text-ai hover:bg-ai-muted/50"
            >
              <Sparkles className="size-4" aria-hidden />
              {parsing ? "Structuring…" : "Structure with AI"}
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="LinkedIn URL">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="linkedin.com/in/…"
            />
          </Field>
          <Field label="Connection">
            <Select
              items={CONNECTION_TYPE_LABELS}
              value={type}
              onValueChange={(v) => setType(v as ConnectionType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONNECTION_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </ActionDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Add reminder (manual)                                               */
/* ------------------------------------------------------------------ */

function AddReminderDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: JobLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const messages = getOutreachForLead(lead.id);
  const [dueDate, setDueDate] = useState("");
  const [label, setLabel] = useState("");
  const [linkedMessage, setLinkedMessage] = useState<string>("none");
  const [error, setError] = useState("");

  function reset() {
    setDueDate("");
    setLabel("");
    setLinkedMessage("none");
    setError("");
  }

  function save() {
    if (!dueDate) {
      setError("Pick a due date.");
      return;
    }
    // PHASE 1: record in the in-memory store (Phase 3 persists via a Server Action).
    addReminder({
      id: `rem-${Date.now()}`,
      outreachMessageId: linkedMessage === "none" ? null : linkedMessage,
      leadId: lead.id,
      sequence: nextReminderSequence(lead.id),
      dueDate,
      outcome: "pending",
      label: label || undefined,
      manual: true,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      icon={<BellPlus className="size-4" aria-hidden />}
      title="Add reminder"
      description={`${lead.company} · ${lead.title}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Add reminder</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Due date">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Note (optional)">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Nudge recruiter about timeline"
          />
        </Field>
        <Field label="Link to a sent message (optional)">
          <Select
            items={{
              none: "None — standalone reminder",
              ...Object.fromEntries(
                messages.map((m) => [
                  m.id,
                  `${OUTREACH_KIND_LABELS[m.kind]} · ${m.channel}`,
                ]),
              ),
            }}
            value={linkedMessage}
            onValueChange={(v) => setLinkedMessage(v ?? "none")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — standalone reminder</SelectItem>
              {messages.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {OUTREACH_KIND_LABELS[m.kind]} · {m.channel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </ActionDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Draft outreach                                                      */
/* ------------------------------------------------------------------ */

function DraftOutreachDialog({
  lead,
  resumes,
  selectedResumeId,
  onResumeChange,
  open,
  onOpenChange,
}: {
  lead: JobLead;
  resumes: Resume[];
  selectedResumeId?: string;
  onResumeChange?: (resumeId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contacts = useContactsForLead(lead.id);
  const initialResumeId =
    selectedResumeId ??
    resumes.find((r) => r.isDefault)?.id ??
    resumes[0]?.id ??
    "";
  const [kind, setKind] = useState<OutreachKind>("referral-ask");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(initialResumeId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fit = computeFitScore(lead.id, resumeId);
  const band = fitBand(fit);
  const contactItems = Object.fromEntries(contacts.map((c) => [c.id, c.name]));
  const resumeItems = Object.fromEntries(
    resumes.map((r) => [r.id, r.isDefault ? `${r.label} · default` : r.label]),
  );

  function pickResume(id: string) {
    setResumeId(id);
    onResumeChange?.(id); // record the per-lead choice so the card reflects it
  }

  function reset() {
    setKind("referral-ask");
    setContactId(contacts[0]?.id ?? "");
    setResumeId(initialResumeId);
    setDraft("");
    setError("");
  }

  function generate() {
    if (!contactId) {
      setError("Add a contact to this lead first.");
      return;
    }
    setError("");
    setBusy(true);
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

  function markSent() {
    if (!draft.trim()) return;
    const today = new Date().toISOString().slice(0, 10);
    const messageId = `msg-${Date.now()}`;
    // PHASE 1: record the sent message in the in-memory store (Phase 3 persists
    // via a Server Action). The draft text becomes the saved sentBody.
    addOutreach({
      id: messageId,
      leadId: lead.id,
      contactId,
      kind,
      channel: "LinkedIn",
      status: "sent",
      draftBody: draft,
      sentBody: draft,
      resumeId,
      createdAt: today,
      sentAt: today,
    });
    // Start the follow-up clock: schedule a reminder at the configured interval.
    const due = new Date();
    due.setDate(due.getDate() + getReminderIntervalDays());
    addReminder({
      id: `rem-${Date.now()}`,
      outreachMessageId: messageId,
      leadId: lead.id,
      sequence: nextReminderSequence(lead.id),
      dueDate: due.toISOString().slice(0, 10),
      outcome: "pending",
      manual: false,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      icon={<Send className="size-4" aria-hidden />}
      title="Draft outreach"
      description={`${lead.company} · ${lead.title}`}
      footer={
        draft ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={markSent}>
              <Send className="size-4" aria-hidden />
              Mark as sent
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        )
      }
    >
      {contacts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Add a contact to this lead first, then draft a message for them.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <Select
                items={OUTREACH_KIND_LABELS}
                value={kind}
                onValueChange={(v) => setKind(v as OutreachKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTREACH_KIND_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact">
              <Select
                items={contactItems}
                value={contactId}
                onValueChange={(v) => setContactId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Resume">
              <Select
                items={resumeItems}
                value={resumeId}
                onValueChange={(v) => pickResume(v ?? "")}
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
            </Field>
          </div>

          {/* Fit score for the selected resume — updates when the resume changes */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <span
              className={cn(
                "flex size-12 shrink-0 flex-col items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                band.chip,
              )}
            >
              {fit}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {band.label}
                <span className="rounded bg-ai-muted px-1.5 py-0.5 text-[10px] font-medium text-ai">
                  <Sparkles className="mr-0.5 inline size-2.5" aria-hidden />
                  preview
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{band.advice}</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={generate}
            disabled={busy}
            className="border-ai/40 text-ai hover:bg-ai-muted/50"
          >
            <Sparkles className="size-4" aria-hidden />
            {busy ? "Drafting…" : "Draft with AI"}
          </Button>

          {draft && (
            <div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-40"
              />
              <p className="mt-2 flex items-start gap-1.5 text-xs text-ai">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                JMP never sends for you — copy the final text, send it yourself,
                then mark it sent to start the follow-up clock.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </ActionDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Shared dialog shell + field                                         */
/* ------------------------------------------------------------------ */

function ActionDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </span>
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="py-1">{children}</div>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
