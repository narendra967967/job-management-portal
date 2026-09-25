"use client";

// Manual "Add lead" feature. A single dialog is mounted once by AddLeadProvider
// (in the dashboard layout); every entry point — the sidebar button, the header
// button, and the mobile FAB — opens it via the useAddLead() hook, so there's
// one form and one piece of state no matter how it's triggered.
//
// The dialog has two tabs:
//  - "Add manually": the core lead fields (shared LeadCoreFields, reused by the
//    Edit dialog) plus an optional inline contact.
//  - "Add with AI": paste a job description or a screenshot; the AI extracts the
//    fields into the manual form, which the user reviews and submits.
//
// Validation is enforced server-side (createLeadSchema); the light client checks
// here just give instant feedback. Success/error are surfaced as toasts.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardList,
  ClipboardPaste,
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
import { ActionDialog, Field } from "@/components/leads/action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { toast } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
/* Shared lead-core fields (used by Add + Edit)                        */
/* ------------------------------------------------------------------ */

export const MAX_TAGS = 15;

/** The lead fields both the Add and Edit dialogs collect (no contact). */
export interface LeadCoreValue {
  title: string;
  company: string;
  location: string;
  remote: boolean;
  jobUrl: string;
  status: LeadStatus;
  tags: string[];
  jdText: string;
  notes: string;
}

export const EMPTY_LEAD_CORE: LeadCoreValue = {
  title: "",
  company: "",
  location: "",
  remote: false,
  jobUrl: "",
  status: "new",
  tags: [],
  jdText: "",
  notes: "",
};

// Only the open statuses can be set here.
const STATUS_ITEMS = Object.fromEntries(
  OPEN_LEAD_STATUSES.map((s) => [s, LEAD_STATUS_LABELS[s]]),
) as Record<string, string>;

/** True when the string looks like an http(s) URL (mirror of the server rule). */
export function looksLikeUrl(v: string): boolean {
  return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v.trim());
}

export function LeadCoreFields({
  value,
  onChange,
  showStatus = true,
}: {
  value: LeadCoreValue;
  onChange: (patch: Partial<LeadCoreValue>) => void;
  /** Whether to show the Status select (Add shows it; Edit hides it). */
  showStatus?: boolean;
}) {
  const [tagInput, setTagInput] = useState("");

  function commitTag(raw: string) {
    const t = raw.trim().replace(/,+$/, "").trim();
    if (!t) return;
    if (t.length > 40) {
      toast.error("Tag too long", "Each tag must be 40 characters or fewer.");
      return;
    }
    if (value.tags.length >= MAX_TAGS) return;
    if (!value.tags.includes(t)) onChange({ tags: [...value.tags, t] });
    setTagInput("");
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && value.tags.length) {
      onChange({ tags: value.tags.slice(0, -1) });
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Job title *">
        <Input
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Senior Product Manager"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company *">
          <Input
            value={value.company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="e.g. Acme Corp"
          />
        </Field>
        <Field label="Location *">
          <Input
            value={value.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="e.g. Bengaluru, India"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={value.remote}
          onChange={(e) => onChange({ remote: e.target.checked })}
          className="size-4 rounded border-input accent-primary"
        />
        <span className="text-sm">This role is remote</span>
      </label>

      <Field label="Job URL *">
        <Input
          type="url"
          value={value.jobUrl}
          onChange={(e) => onChange({ jobUrl: e.target.value })}
          placeholder="https://www.linkedin.com/jobs/view/…"
        />
        <span className="text-[11px] text-muted-foreground">
          Required. The job link is the unique key used to avoid adding the same
          job twice.
        </span>
      </Field>

      <div className={cn("grid gap-3", showStatus && "sm:grid-cols-2")}>
        {showStatus && (
          <Field label="Status">
            <Select
              items={STATUS_ITEMS}
              value={value.status}
              onValueChange={(v) => onChange({ status: (v as LeadStatus) ?? "new" })}
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
        )}
        <Field label="Tags">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={() => commitTag(tagInput)}
            placeholder="Type and press Enter"
            disabled={value.tags.length >= MAX_TAGS}
          />
        </Field>
      </div>
      {value.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => onChange({ tags: value.tags.filter((x) => x !== t) })}
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
          <MarkdownEditor
            value={value.jdText}
            onChange={(v) => onChange({ jdText: v })}
            placeholder="Paste the full job description (optional — you can add it later)…"
            className="min-h-28"
            ariaLabel="Job description"
          />
        </Field>
        <Field label="Notes">
          <MarkdownEditor
            value={value.notes}
            onChange={(v) => onChange({ notes: v })}
            placeholder="Anything to remember about this role (optional)…"
            className="min-h-28"
            ariaLabel="Notes"
          />
        </Field>
      </div>
    </div>
  );
}

/**
 * Validate required lead-core fields on the client for instant feedback (the
 * server is still the source of truth). Returns an error message or null.
 */
export function validateLeadCore(v: LeadCoreValue): string | null {
  if (!v.title.trim()) return "Job title is required.";
  if (!v.company.trim()) return "Company is required.";
  if (!v.location.trim()) return "Location is required.";
  if (!v.jobUrl.trim()) return "Job URL is required.";
  if (!looksLikeUrl(v.jobUrl))
    return "Enter a valid Job URL starting with http:// or https://.";
  return null;
}

/* ------------------------------------------------------------------ */
/* The Add dialog                                                      */
/* ------------------------------------------------------------------ */

function AddLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [core, setCore] = useState<LeadCoreValue>(EMPTY_LEAD_CORE);

  // Optional inline contact.
  const [cName, setCName] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [cType, setCType] = useState<ConnectionType>("recruiter");

  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<LeadCoreValue>) => setCore((c) => ({ ...c, ...p }));

  // Reset everything when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMode("manual");
    setCore(EMPTY_LEAD_CORE);
    setCName("");
    setCTitle("");
    setCUrl("");
    setCType("recruiter");
    setSaving(false);
  }, [open]);

  /** Fill the manual form from an AI extraction, then switch to review it. */
  function applyExtracted(lead: ExtractedLead) {
    const p: Partial<LeadCoreValue> = { remote: lead.remote };
    if (lead.title) p.title = lead.title;
    if (lead.company) p.company = lead.company;
    if (lead.location) p.location = lead.location;
    if (lead.jobUrl) p.jobUrl = lead.jobUrl;
    if (lead.tags.length) p.tags = lead.tags.slice(0, MAX_TAGS);
    if (lead.jdText) p.jdText = lead.jdText;
    patch(p);
    setMode("manual");
  }

  async function save() {
    const err = validateLeadCore(core);
    if (err) return toast.error(err);
    if (!cName.trim() && (cTitle.trim() || cUrl.trim())) {
      return toast.error(
        "Incomplete contact",
        "Add a contact name, or clear the contact fields.",
      );
    }

    setSaving(true);
    const res = await createLead({
      ...core,
      contact: cName.trim()
        ? { name: cName, title: cTitle, linkedinUrl: cUrl, connectionType: cType }
        : undefined,
    });
    setSaving(false);

    if (res.ok) {
      toast.success("Lead added", `${core.title.trim()} · ${core.company.trim()}`);
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

        <TabsContent value="manual" className="mt-4">
          <div className="space-y-4">
            <LeadCoreFields value={core} onChange={patch} />

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
  const [canReadClipboard, setCanReadClipboard] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Revoke the object URL when the preview changes or the panel unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Whether the async Clipboard API is available (for the explicit paste button).
  useEffect(() => {
    setCanReadClipboard(
      typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.read === "function",
    );
  }, []);

  // Stable so the document-paste listener can register once.
  const acceptImage = useCallback((f: File) => {
    if (!IMAGE_TYPES.includes(f.type)) {
      toast.error("Unsupported image", "Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (f.size > IMAGE_MAX_BYTES) {
      toast.error("Image too large", "Maximum size is 5 MB.");
      return;
    }
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, []);

  // Ctrl/Cmd+V anywhere on this tab pastes a clipboard image (e.g. after a
  // Win+Shift+S screenshot). Scoped to when the AI panel is mounted; text
  // pastes into inputs are left alone (we only act on image items).
  useEffect(() => {
    function onDocPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            acceptImage(f);
          }
          return;
        }
      }
    }
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, [acceptImage]);

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Explicit "Paste from clipboard" button — reads the clipboard on click. */
  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          acceptImage(new File([blob], "clipboard-image", { type: blob.type }));
          return;
        }
      }
      toast.error(
        "No image in clipboard",
        "Copy a screenshot first (Win+Shift+S), then try again.",
      );
    } catch {
      toast.error(
        "Clipboard blocked",
        "Your browser blocked clipboard access — press Ctrl/Cmd+V instead.",
      );
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
    <div className="space-y-4">
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
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input py-6 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                Choose image
              </Button>
              {canReadClipboard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pasteFromClipboard}
                  className="gap-1.5"
                >
                  <ClipboardPaste className="size-3.5" aria-hidden />
                  Paste from clipboard
                </Button>
              )}
            </div>
            <span className="text-[11px]">
              …or press Ctrl/Cmd+V · PNG, JPEG or WebP · up to 5 MB
            </span>
          </div>
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
