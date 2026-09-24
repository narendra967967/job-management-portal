"use client";

// Manual "Add lead" feature. A single dialog is mounted once by AddLeadProvider
// (in the dashboard layout); every entry point — the sidebar button, the header
// button, and the mobile FAB — opens it via the useAddLead() hook, so there's
// one form and one piece of state no matter how it's triggered.
//
// The form mirrors the job_leads + job_lead_details columns the user can set,
// plus an optional inline contact. Validation is enforced server-side by
// createLeadSchema; the light client checks here just give instant feedback.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardList, X } from "lucide-react";
import {
  CONNECTION_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  OPEN_LEAD_STATUSES,
  type ConnectionType,
  type LeadStatus,
} from "@/lib/types";
import { createLead } from "@/lib/mock-store";
import { ActionDialog, Field } from "@/components/leads/lead-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* Provider + hook — one shared dialog for all entry points            */
/* ------------------------------------------------------------------ */

const AddLeadContext = createContext<{ open: () => void } | null>(null);

/** Open the shared Add-lead dialog from anywhere inside the provider. */
export function useAddLead() {
  const ctx = useContext(AddLeadContext);
  if (!ctx) throw new Error("useAddLead must be used within <AddLeadProvider>.");
  return ctx;
}

export function AddLeadProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AddLeadContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <AddLeadDialog open={open} onOpenChange={setOpen} />
    </AddLeadContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Trigger buttons                                                     */
/* ------------------------------------------------------------------ */

/** Full-width primary button pinned at the top of the desktop sidebar. The
 *  data attribute lets the mobile nav drawer close itself when it's tapped. */
export function SidebarAddLeadButton() {
  const { open } = useAddLead();
  return (
    <Button
      onClick={open}
      data-closes-nav=""
      className="w-full justify-center gap-2"
    >
      <Plus className="size-4" aria-hidden />
      Add lead
    </Button>
  );
}

/** Compact button for the top bar (hidden on mobile, where the FAB is used). */
export function HeaderAddLeadButton() {
  const { open } = useAddLead();
  return (
    <Button
      onClick={open}
      size="sm"
      className="hidden gap-1.5 sm:inline-flex"
    >
      <Plus className="size-4" aria-hidden />
      Add lead
    </Button>
  );
}

/** Floating action button — mobile only (the 5-slot bottom nav is full). */
export function AddLeadFab() {
  const { open } = useAddLead();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Add lead"
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:hidden"
    >
      <Plus className="size-6" aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* The dialog                                                          */
/* ------------------------------------------------------------------ */

const MAX_TAGS = 15;

// Only the open statuses can be set at creation time.
const STATUS_ITEMS = Object.fromEntries(
  OPEN_LEAD_STATUSES.map((s) => [s, LEAD_STATUS_LABELS[s]]),
) as Record<string, string>;

function AddLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  // Core lead fields.
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [status, setStatus] = useState<LeadStatus>("new");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");

  // Optional inline contact.
  const [cName, setCName] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [cType, setCType] = useState<ConnectionType>("recruiter");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset every field when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCompany("");
    setLocation("");
    setRemote(false);
    setJobUrl("");
    setStatus("new");
    setTags([]);
    setTagInput("");
    setJd("");
    setNotes("");
    setCName("");
    setCTitle("");
    setCUrl("");
    setCType("recruiter");
    setSaving(false);
    setError("");
  }, [open]);

  function commitTag(raw: string) {
    const t = raw.trim().replace(/,+$/, "").trim();
    if (!t) return;
    if (t.length > 40) {
      setError("Each tag must be 40 characters or fewer.");
      return;
    }
    if (tags.length >= MAX_TAGS) return;
    if (!tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      // Backspace on an empty box removes the last chip.
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function save() {
    setError("");
    if (!title.trim()) return setError("Job title is required.");
    if (!company.trim()) return setError("Company is required.");
    if (!location.trim()) return setError("Location is required.");
    // Guard against a half-filled contact (details but no name).
    if (!cName.trim() && (cTitle.trim() || cUrl.trim())) {
      return setError("Add a contact name, or clear the contact fields.");
    }

    setSaving(true);
    const res = await createLead({
      title,
      company,
      location,
      remote,
      jobUrl,
      status,
      tags,
      jdText: jd,
      notes,
      contact: cName.trim()
        ? {
            name: cName,
            title: cTitle,
            linkedinUrl: cUrl,
            connectionType: cType,
          }
        : undefined,
    });
    setSaving(false);

    if (res.ok) {
      onOpenChange(false);
      router.push(`/leads/${res.id}`);
    } else {
      setError(res.error);
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="sm:max-w-xl"
      icon={<ClipboardList className="size-4" aria-hidden />}
      title="Add lead"
      description="Add a job manually — the same as one captured from your inbox."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Adding…" : "Add lead"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Job title *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Product Manager"
            autoFocus
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company *">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </Field>
          <Field label="Location *">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bengaluru, India"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          <span className="text-sm">This role is remote</span>
        </label>

        <Field label="Job URL">
          <Input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/…"
          />
          <span className="text-[11px] text-muted-foreground">
            Optional. A LinkedIn link is used to avoid duplicate leads.
          </span>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select
              items={STATUS_ITEMS}
              value={status}
              onValueChange={(v) => setStatus((v as LeadStatus) ?? "new")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPEN_LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tags">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={() => commitTag(tagInput)}
              placeholder="Type and press Enter"
              disabled={tags.length >= MAX_TAGS}
            />
          </Field>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        <Field label="Job description">
          <Textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description (optional — you can add it later)…"
            className="min-h-24"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember about this role (optional)…"
            className="min-h-16"
          />
        </Field>

        {/* Optional inline contact */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Add a contact (optional)</p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Fill in a name to attach a recruiter or referral to this lead. Leave
            blank to skip.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={cName} onChange={(e) => setCName(e.target.value)} />
            </Field>
            <Field label="Title">
              <Input
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value)}
              />
            </Field>
            <Field label="LinkedIn URL">
              <Input
                value={cUrl}
                onChange={(e) => setCUrl(e.target.value)}
                placeholder="linkedin.com/in/…"
              />
            </Field>
            <Field label="Connection">
              <Select
                items={CONNECTION_TYPE_LABELS}
                value={cType}
                onValueChange={(v) => setCType((v as ConnectionType) ?? "recruiter")}
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
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </ActionDialog>
  );
}
