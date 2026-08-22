"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  CONNECTION_TYPE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  OUTREACH_KIND_LABELS,
  type ConnectionType,
  type JobLead,
  type LeadStatus,
  type OutreachKind,
  type Resume,
} from "@/lib/types";
import { getContactsForLead, getOutreachForLead } from "@/lib/mock-data";
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
  className,
}: {
  lead: JobLead;
  resumes: Resume[];
  status: LeadStatus;
  onStatusChange?: (status: LeadStatus) => void;
  /** Open the detail modal. When omitted, "View details" navigates to the page. */
  onViewDetails?: () => void;
  /** Hide the "View details" item (e.g. when already on the detail view). */
  hideViewDetails?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);

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
                value={status}
                onValueChange={(v) => onStatusChange?.(v as LeadStatus)}
              >
                {LEAD_STATUSES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("contact")}>
            <UserPlus className="size-4" aria-hidden />
            Add contact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("reminder")}>
            <BellPlus className="size-4" aria-hidden />
            Add reminder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("outreach")}>
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

      <AddContactDialog
        lead={lead}
        open={dialog === "contact"}
        onOpenChange={(o) => setDialog(o ? "contact" : null)}
      />
      <AddReminderDialog
        lead={lead}
        open={dialog === "reminder"}
        onOpenChange={(o) => setDialog(o ? "reminder" : null)}
      />
      <DraftOutreachDialog
        lead={lead}
        resumes={resumes}
        open={dialog === "outreach"}
        onOpenChange={(o) => setDialog(o ? "outreach" : null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Add contact                                                         */
/* ------------------------------------------------------------------ */

function AddContactDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: JobLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ConnectionType>("recruiter");
  const [error, setError] = useState("");

  function reset() {
    setPasted("");
    setName("");
    setTitle("");
    setUrl("");
    setType("recruiter");
    setError("");
  }

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
      setParsing(false);
    }, 700);
  }

  function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    // Mock: Phase 3 persists via a Server Action. Close on success.
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
      icon={<UserPlus className="size-4" aria-hidden />}
      title="Add contact"
      description={`${lead.company} · ${lead.title}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save contact</Button>
        </>
      }
    >
      <div className="space-y-4">
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
            <Select value={type} onValueChange={(v) => setType(v as ConnectionType)}>
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
  open,
  onOpenChange,
}: {
  lead: JobLead;
  resumes: Resume[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contacts = getContactsForLead(lead.id);
  const [kind, setKind] = useState<OutreachKind>("referral-ask");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setKind("referral-ask");
    setContactId(contacts[0]?.id ?? "");
    setResumeId(resumes[0]?.id ?? "");
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
            <Button onClick={() => onOpenChange(false)}>
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
              <Select value={kind} onValueChange={(v) => setKind(v as OutreachKind)}>
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
              <Select value={contactId} onValueChange={(v) => setContactId(v ?? "")}>
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
              <Select value={resumeId} onValueChange={(v) => setResumeId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
