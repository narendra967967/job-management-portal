"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  Trash2,
  Pencil,
  Check,
  X,
  Star,
  ShieldCheck,
  KeyRound,
  LogOut,
} from "lucide-react";
import { useDefaultResumeId } from "@/lib/use-default-resume";
import { useAppSettings } from "@/lib/use-app-settings";
import {
  mockAiSettings,
  mockGoogleConnection,
  mockProfile,
  mockResumes,
} from "@/lib/mock-data";
import {
  AI_PROVIDER_DEFAULT_MODEL,
  AI_PROVIDER_LABELS,
  RESUME_ACCEPT,
  RESUME_ALLOWED_EXT,
  RESUME_MAX_BYTES,
  type AiProvider,
  type Resume,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Manage your profile, resumes, and Google connection.
        </p>
      </div>

      <ProfileCard />
      <GoogleCard />
      <AiProviderCard />
      <FollowUpsCard />
      <ResumesCard />
      <AccountCard />
    </div>
  );
}

/* ---------------- Profile ---------------- */

function ProfileCard() {
  const [name, setName] = useState(mockProfile.name);
  const [email, setEmail] = useState(mockProfile.email);
  const [mobile, setMobile] = useState(mockProfile.mobile);
  const [saved, setSaved] = useState(false);

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Used to identify you and sign in.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mobile number">
          <Input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="tel"
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          Save changes
        </Button>
        {saved && (
          <span className="text-xs text-status-applied-foreground">Saved</span>
        )}
      </div>
    </section>
  );
}

/* ---------------- Google connection ---------------- */

function GoogleCard() {
  const [connected, setConnected] = useState(mockGoogleConnection.connected);

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Google connection</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Connect Gmail so JMP can read your LinkedIn job-alert emails.
          </p>
        </div>
        <span
          className={
            connected
              ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
              : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Read-only access (<code className="text-[11px]">gmail.readonly</code>).
          JMP can never send, delete, or modify anything in your mailbox.
        </p>
      </div>

      {connected ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Connected as{" "}
            <span className="font-medium">{mockProfile.email}</span>
          </p>
          <Button variant="outline" onClick={() => setConnected(false)}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={() => setConnected(true)}>
            <GoogleGlyph />
            Connect Google
          </Button>
        </div>
      )}
    </section>
  );
}

/* ---------------- AI provider & API key ---------------- */

function AiProviderCard() {
  const [provider, setProvider] = useState<AiProvider>(mockAiSettings.provider);
  const [model, setModel] = useState(mockAiSettings.model);
  const [keyConfigured, setKeyConfigured] = useState(
    mockAiSettings.keyConfigured,
  );
  const [keyLast4, setKeyLast4] = useState<string | null>(
    mockAiSettings.keyLast4,
  );
  const [keyInput, setKeyInput] = useState("");
  const [editingKey, setEditingKey] = useState(!mockAiSettings.keyConfigured);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function saveKey() {
    const key = keyInput.trim();
    if (key.length < 8) {
      setError("Enter a valid API key.");
      return;
    }
    setError("");
    // Mock: Phase 3 sends this to a Server Action that encrypts it at rest. The
    // raw key is never stored in client state or read back to the browser.
    setKeyLast4(key.slice(-4));
    setKeyConfigured(true);
    setKeyInput("");
    setEditingKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function removeKey() {
    setKeyConfigured(false);
    setKeyLast4(null);
    setKeyInput("");
    setEditingKey(true);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">AI provider</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Powers job-description summaries, contact structuring, and outreach
            drafting.
          </p>
        </div>
        <span
          className={
            keyConfigured
              ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
              : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {keyConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select
            items={AI_PROVIDER_LABELS}
            value={provider}
            onValueChange={(v) => setProvider((v as AiProvider) ?? provider)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {AI_PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Model (optional)">
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
          />
        </Field>
      </div>

      <div className="mt-3">
        <span className="text-xs font-medium text-muted-foreground">
          API key
        </span>
        {keyConfigured && !editingKey ? (
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              {provider === "openai" ? "sk" : "sk-ant"}-••••••••{keyLast4}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditingKey(true)}>
                Replace
              </Button>
              <Button variant="outline" onClick={removeKey}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={
                provider === "openai" ? "sk-…" : "sk-ant-…"
              }
              autoComplete="off"
              className="flex-1 font-mono"
            />
            <div className="flex items-center gap-2">
              <Button onClick={saveKey}>Save key</Button>
              {keyConfigured && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingKey(false);
                    setKeyInput("");
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        {saved && (
          <p className="mt-2 text-xs text-status-applied-foreground">
            API key saved
          </p>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Stored encrypted and used only server-side for AI calls. Your key is
          never sent to the browser or exposed in client code.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Follow-ups ---------------- */

function FollowUpsCard() {
  const [settings, update] = useAppSettings();
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Follow-ups</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How reminders are scheduled and when stalled leads get flagged.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Reminder interval (days)">
          <Input
            type="number"
            min={1}
            value={settings.reminderIntervalDays}
            onChange={(e) =>
              update({
                reminderIntervalDays: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </Field>
        <Field label="Flag lead as stale after (days)">
          <Input
            type="number"
            min={1}
            value={settings.staleLeadDays}
            onChange={(e) =>
              update({ staleLeadDays: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A follow-up is auto-scheduled {settings.reminderIntervalDays} day
        {settings.reminderIntervalDays === 1 ? "" : "s"} after a message is
        marked sent. Open leads with no pending follow-up for{" "}
        {settings.staleLeadDays} days are flagged <em>Stale</em> for review.
      </p>
    </section>
  );
}

/* ---------------- Resumes ---------------- */

function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

interface PendingFile {
  fileName: string;
  fileType: Resume["fileType"];
  sizeKb: number;
}

function ResumesCard() {
  const [resumes, setResumes] = useState<Resume[]>(mockResumes);
  const [defaultResumeId, setDefaultResumeId] = useDefaultResumeId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // After a valid file is picked, we hold it here and ask for a display name.
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [nameError, setNameError] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!(RESUME_ALLOWED_EXT as readonly string[]).includes(ext)) {
      setError("Upload a PDF or Word document (.pdf, .doc, .docx).");
    } else if (file.size > RESUME_MAX_BYTES) {
      setError("File must be under 5 MB.");
    } else {
      setError("");
      setPending({
        fileName: file.name,
        fileType: ext as Resume["fileType"],
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
      });
      // Pre-fill the name from the filename; the user can change it.
      setPendingName(file.name.replace(/\.[^.]+$/, ""));
      setNameError("");
    }
    // Reset so re-selecting the same file fires change again.
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirmUpload() {
    if (!pending) return;
    const label = pendingName.trim();
    if (!label) {
      setNameError("Give this resume a name.");
      return;
    }
    // Mock: Phase 3 uploads the file to blob storage via a Server Action and
    // stores its URL + metadata. Here we only capture the metadata.
    setResumes((r) => [
      ...r,
      {
        id: `resume-${Date.now()}`,
        label,
        fileName: pending.fileName,
        fileType: pending.fileType,
        sizeKb: pending.sizeKb,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setPending(null);
    setPendingName("");
  }

  function saveEdit(id: string) {
    const label = editLabel.trim();
    if (label) {
      setResumes((r) => r.map((x) => (x.id === id ? { ...x, label } : x)));
    }
    setEditingId(null);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Resumes</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Upload PDF or Word files to pick from when drafting outreach. The
        default resume is used to score how well each lead fits.
      </p>

      <ul className="mt-4 space-y-2">
        {resumes.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText className="size-4" aria-hidden />
            </span>
            {editingId === r.id ? (
              <>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-9 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onClick={() => saveEdit(r.id)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-status-applied-foreground hover:bg-muted"
                >
                  <Check className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => setEditingId(null)}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{r.label}</p>
                    {r.id === defaultResumeId && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Star className="size-2.5 fill-current" aria-hidden />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-px font-medium uppercase">
                      {r.fileType}
                    </span>
                    <span className="truncate">{r.fileName}</span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap">
                      {formatSize(r.sizeKb)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={
                    r.id === defaultResumeId
                      ? `${r.label} is the default resume`
                      : `Set ${r.label} as default`
                  }
                  title={
                    r.id === defaultResumeId ? "Default resume" : "Set as default"
                  }
                  onClick={() => setDefaultResumeId(r.id)}
                  disabled={r.id === defaultResumeId}
                  className={`flex size-11 items-center justify-center rounded-md sm:size-9 hover:bg-muted disabled:opacity-100 ${
                    r.id === defaultResumeId
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star
                    className={`size-4 ${r.id === defaultResumeId ? "fill-current" : ""}`}
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${r.label}`}
                  onClick={() => {
                    setEditingId(r.id);
                    setEditLabel(r.label);
                  }}
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${r.label}`}
                  onClick={() =>
                    setResumes((list) => list.filter((x) => x.id !== r.id))
                  }
                  className="flex size-11 items-center justify-center rounded-md sm:size-9 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </>
            )}
          </li>
        ))}
        {resumes.length === 0 && (
          <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No resumes yet.
          </li>
        )}
      </ul>

      <input
        ref={fileRef}
        type="file"
        accept={RESUME_ACCEPT}
        onChange={onFile}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        className="mt-3"
      >
        <Upload className="size-4" aria-hidden />
        Upload resume
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">
        PDF or Word (.pdf, .doc, .docx), up to 5 MB.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null);
            setPendingName("");
            setNameError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name this resume</DialogTitle>
            <DialogDescription>
              A short name to recognise it by when drafting outreach.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pending.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="uppercase">{pending.fileType}</span> ·{" "}
                    {formatSize(pending.sizeKb)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resume-name">Resume name</Label>
                <Input
                  id="resume-name"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmUpload()}
                  placeholder="e.g. PM — Fintech"
                  autoFocus
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setPendingName("");
                setNameError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmUpload}>Add resume</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ---------------- Account ---------------- */

function AccountCard() {
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Account</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Single-user access to this workspace.
      </p>
      <div className="mt-4">
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </Button>
      </div>
    </section>
  );
}

/* ---------------- Shared ---------------- */

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

function GoogleGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
