"use client";

// Manual "Add lead" feature. A single dialog is mounted once by AddLeadProvider
// (in the dashboard layout); every entry point — the sidebar button, the header
// button, and the mobile FAB — opens it via the useAddLead() hook, so there's
// one form and one piece of state no matter how it's triggered.
//
// The dialog has two tabs:
//  - "Add manually": the form mirroring the job_leads + job_lead_details columns
//    the user can set, plus an optional inline contact.
//  - "Add with AI": paste a job description or a screenshot; the AI extracts the
//    fields into the manual form, which the user reviews and submits.
//
// Validation is enforced server-side (createLeadSchema); the light client checks
// here just give instant feedback. Success/error are surfaced as toasts.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardList,
  X,
  Sparkles,
  ImagePlus,
  Loader2,
} from "lucide-react";
import {
  CONNECTION_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  OPEN_LEAD_STATUSES,
  type ConnectionType,
  type LeadStatus,
} from "@/lib/types";
import { createLead } from "@/lib/mock-store";
import {
  extractLeadFromImageAction,
  extractLeadFromTextAction,
  type ExtractedLead,
} from "@/actions/ai";
import { ActionDialog, Field } from "@/components/leads/lead-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Button onClick={open} size="sm" className="hidden gap-1.5 sm:inline-flex">
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

  const [mode, setMode] = useState<"manual" | "ai">("manual");

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

  // Reset every field when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMode("manual");
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
  }, [open]);

  /** Fill the manual form from an AI extraction, then switch to review it. */
  function applyExtracted(lead: ExtractedLead) {
    if (lead.title) setTitle(lead.title);
    if (lead.company) setCompany(lead.company);
    if (lead.location) setLocation(lead.location);
    setRemote(lead.remote);
    if (lead.jobUrl) setJobUrl(lead.jobUrl);
    if (lead.tags.length) setTags(lead.tags.slice(0, MAX_TAGS));
    if (lead.jdText) setJd(lead.jdText);
    setMode("manual");
  }

  function commitTag(raw: string) {
    const t = raw.trim().replace(/,+$/, "").trim();
    if (!t) return;
    if (t.length > 40) {
      toast.error("Tag too long", "Each tag must be 40 characters or fewer.");
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
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function save() {
    if (!title.trim()) return toast.error("Job title is required.");
    if (!company.trim()) return toast.error("Company is required.");
    if (!location.trim()) return toast.error("Location is required.");
    if (!cName.trim() && (cTitle.trim() || cUrl.trim())) {
      return toast.error(
        "Incomplete contact",
        "Add a contact name, or clear the contact fields.",
      );
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
        ? { name: cName, title: cTitle, linkedinUrl: cUrl, connectionType: cType }
        : undefined,
    });
    setSaving(false);

    if (res.ok) {
      toast.success("Lead added", `${title.trim()} · ${company.trim()}`);
      onOpenChange(false);
      router.push(`/leads/${res.id}`);
    } else {
      toast.error("Couldn't add lead", res.error);
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="sm:max-w-2xl lg:max-w-3xl"
      icon={<ClipboardList className="size-4" aria-hidden />}
      title="Add lead"
      description="Add a job manually, or let AI fill the form from text or a screenshot."
      footer={
        mode === "manual" ? (
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
        ) : (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        )
      }
    >
      <Tabs
        value={mode}
        onValueChange={(v) => setMode((v as "manual" | "ai") ?? "manual")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Add manually</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles className="size-4" aria-hidden />
            Add with AI
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Manual form ---------------- */}
        <TabsContent value="manual" className="mt-4">
          <div className="space-y-4">
            <Field label="Job title *">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Product Manager"
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
                Optional. The job link is used to avoid adding the same job twice.
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
                      onClick={() =>
                        setTags((prev) => prev.filter((x) => x !== t))
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Job description">
                <Textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description (optional — you can add it later)…"
                  className="min-h-28"
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything to remember about this role (optional)…"
                  className="min-h-28"
                />
              </Field>
            </div>

            {/* Optional inline contact */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Add a contact (optional)</p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Fill in a name to attach a recruiter or referral to this lead.
                Leave blank to skip.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                  />
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
                    onValueChange={(v) =>
                      setCType((v as ConnectionType) ?? "recruiter")
                    }
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
          </div>
        </TabsContent>

        {/* ---------------- AI extraction ---------------- */}
        <TabsContent value="ai" className="mt-4">
          <AiExtractPanel onExtracted={applyExtracted} />
        </TabsContent>
      </Tabs>
    </ActionDialog>
  );
}

/* ------------------------------------------------------------------ */
/* AI extraction panel                                                 */
/* ------------------------------------------------------------------ */

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function AiExtractPanel({
  onExtracted,
}: {
  onExtracted: (lead: ExtractedLead) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Revoke the object URL when the preview changes or the panel unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function acceptImage(f: File) {
    if (!IMAGE_TYPES.includes(f.type)) {
      toast.error("Unsupported image", "Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (f.size > IMAGE_MAX_BYTES) {
      toast.error("Image too large", "Maximum size is 5 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function onPaste(e: ClipboardEvent) {
    const img = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    if (img) {
      const f = img.getAsFile();
      if (f) {
        e.preventDefault();
        acceptImage(f);
      }
    }
  }

  async function extract() {
    setBusy(true);
    try {
      let res:
        | { ok: true; lead: ExtractedLead }
        | { ok: false; error: string };
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        res = await extractLeadFromImageAction(fd);
      } else if (text.trim()) {
        res = await extractLeadFromTextAction(text);
      } else {
        toast.error("Nothing to extract", "Paste a job description or an image.");
        return;
      }

      if (res.ok) {
        onExtracted(res.lead);
        toast.success(
          "Details extracted",
          "Review the fields on the form, then submit.",
        );
      } else {
        toast.error("Extraction failed", res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" onPaste={onPaste}>
      <div className="rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ai">
          <Sparkles className="size-4" aria-hidden />
          Fill the form from text or a screenshot
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Paste a job description below, or add a screenshot of the posting. AI
          fills the manual form so you can review and submit.
        </p>
      </div>

      <Field label="Job description or details">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the job posting text, an email, or a paragraph describing the role…"
          className="min-h-32"
        />
      </Field>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          Or add a screenshot
        </p>
        {preview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Job posting screenshot"
              className="max-h-48 rounded-lg border object-contain"
            />
            <button
              type="button"
              aria-label="Remove image"
              onClick={clearImage}
              className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ImagePlus className="size-6" aria-hidden />
            <span>Choose an image, or paste one here (Ctrl/Cmd+V)</span>
            <span className="text-[11px]">PNG, JPEG or WebP · up to 5 MB</span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptImage(f);
          }}
        />
      </div>

      <Button
        onClick={extract}
        disabled={busy}
        className="w-full gap-2 border-transparent bg-ai text-ai-foreground hover:bg-ai/90 sm:w-auto"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {busy ? "Extracting…" : "Extract details"}
      </Button>
    </div>
  );
}
