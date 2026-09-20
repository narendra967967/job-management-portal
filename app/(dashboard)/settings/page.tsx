"use client";

import { useEffect, useRef, useState } from "react";
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
  Filter,
} from "lucide-react";
import {
  useProfile,
  updateProfile,
  useResumes,
  useDefaultResumeId,
  addResume,
  renameResume,
  deleteResume,
  useAppSettings,
  useGmailSettings,
  useGoogle,
  disconnectGoogle,
  syncGmail,
  useSyncInterval,
  useGmailSync,
  useIngestErrors,
  clearIngestErrors,
  useAiSettings,
  updateAiSettings,
  saveAiKey,
  removeAiKey,
  useAiPrompts,
  updateAiPrompts,
} from "@/lib/mock-store";
import { buildGmailQuery } from "@/lib/use-gmail-settings";
import {
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_DRAFT_PROMPT,
} from "@/lib/ai-prompts";
import { signOutToHome, connectGoogle } from "@/lib/auth-client";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="mx-auto max-w-2xl space-y-5 lg:max-w-5xl">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Manage your profile, resumes, and Google connection.
        </p>
      </div>

      <div className="[&>section]:mb-5 lg:columns-2 lg:gap-5 lg:[&>section]:break-inside-avoid">
        <ProfileCard />
        <GoogleCard />
        <SyncScheduleCard />
        <IngestionIssuesCard />
        <AiProviderCard />
        <AiPromptsCard />
        <FollowUpsCard />
        <ResumesCard />
        <AccountCard />
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */

function ProfileCard() {
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [mobile, setMobile] = useState(profile.mobile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setMobile(profile.mobile);
  }, [profile]);

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
            updateProfile({ name, email, mobile });
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
  const google = useGoogle();
  const [settings, updateSettings] = useGmailSettings();

  const [sendersText, setSendersText] = useState("");
  const [label, setLabel] = useState("");
  const [subjectKeywords, setSubjectKeywords] = useState("");
  const [lookbackDays, setLookbackDays] = useState(30);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function runSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const r = await syncGmail();
      setSyncMsg(
        r.connected
          ? `Fetched ${r.fetched}, added ${r.inserted} new, renewed ${r.renewed}` +
              (r.errors ? `, ${r.errors} parse issue${r.errors === 1 ? "" : "s"}.` : ".")
          : (r.message ?? "Not connected."),
      );
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setSendersText(settings.senders.join("\n"));
    setLabel(settings.label);
    setSubjectKeywords(settings.subjectKeywords);
    setLookbackDays(settings.lookbackDays);
  }, [settings]);

  const draft = {
    senders: sendersText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    label,
    subjectKeywords,
    lookbackDays,
  };
  const query = buildGmailQuery(draft);

  function save() {
    updateSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

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
            google.connected
              ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
              : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {google.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Read-only access (<code className="text-[11px]">gmail.readonly</code>).
          JMP can never send, delete, or modify anything in your mailbox.
        </p>
      </div>

      {google.connected ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Connected as{" "}
              <span className="font-medium">
                {google.email ?? "Google account"}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={runSync} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="outline" onClick={() => disconnectGoogle()}>
                Disconnect
              </Button>
            </div>
          </div>
          {syncMsg && (
            <p className="text-xs text-muted-foreground">{syncMsg}</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Button onClick={() => connectGoogle()} disabled={!google.configured}>
            <GoogleGlyph />
            Connect Google
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {google.configured
              ? "Grants read-only Gmail access so JMP can fetch your LinkedIn job alerts."
              : "Gmail connection isn’t available yet — an administrator needs to configure Google access for this workspace."}
          </p>
        </div>
      )}

      {/* ---- Which emails to ingest ---- */}
      <div className="mt-5 border-t pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="size-4 text-muted-foreground" aria-hidden />
          Which emails to read
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          JMP only reads messages matching these rules. Tip: open a real
          LinkedIn alert in Gmail and copy its “From” address to be sure.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="From addresses (one per line)">
            <Textarea
              value={sendersText}
              onChange={(e) => setSendersText(e.target.value)}
              placeholder="jobalerts-noreply@linkedin.com"
              className="min-h-20 font-mono text-[13px]"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gmail label (optional)">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Job Alerts"
              />
            </Field>
            <Field label="Initial history to pull">
              <Select
                items={{
                  "7": "Last 7 days",
                  "30": "Last 30 days",
                  "90": "Last 90 days",
                  "180": "Last 6 months",
                  "0": "All mail",
                }}
                value={String(lookbackDays)}
                onValueChange={(v) => setLookbackDays(Number(v ?? "30"))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="0">All mail</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Subject must contain (optional, comma-separated)">
            <Input
              value={subjectKeywords}
              onChange={(e) => setSubjectKeywords(e.target.value)}
              placeholder="job alert, new jobs"
            />
          </Field>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              Effective Gmail search
            </span>
            <p className="mt-1.5 rounded-lg border bg-muted/40 p-2.5 font-mono text-[12px] break-all text-foreground">
              {query}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              The first sync backfills this window; after that JMP fetches only
              new mail and skips jobs already saved (deduped by LinkedIn job
              ID), so nothing is imported twice.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save}>Save email rules</Button>
            {saved && (
              <span className="text-xs text-status-applied-foreground">Saved</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Sync schedule (cron) ---------------- */

const INTERVAL_LABELS: Record<string, string> = {
  "1": "Every hour",
  "3": "Every 3 hours",
  "6": "Every 6 hours",
  "12": "Every 12 hours",
  "24": "Once a day",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function SyncScheduleCard() {
  const google = useGoogle();
  const [interval, setInterval] = useSyncInterval();
  const sync = useGmailSync();
  const [cfg] = useGmailSettings();

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Sync schedule</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How often JMP checks Gmail for new LinkedIn alerts.
      </p>

      <div className="mt-4">
        <Field label="Run frequency">
          <Select
            items={INTERVAL_LABELS}
            value={String(interval)}
            onValueChange={(v) => setInterval(Number(v ?? "24"))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INTERVAL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
        {!google.connected ? (
          <p className="text-muted-foreground">
            Connect Google (above) to enable syncing.
          </p>
        ) : sync.lastSyncedAt ? (
          <p className="text-foreground">
            Next run fetches alerts received{" "}
            <span className="font-medium">since {fmtDateTime(sync.lastSyncedAt)}</span>.
          </p>
        ) : (
          <p className="text-foreground">
            First run backfills the last{" "}
            <span className="font-medium">
              {cfg.lookbackDays === 0 ? "all" : cfg.lookbackDays} day
              {cfg.lookbackDays === 1 ? "" : "s"}
            </span>
            ; after that it fetches only new mail since the previous run.
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          Last run: {fmtDateTime(sync.lastRunAt)}
          {sync.lastError ? ` · last error: ${sync.lastError}` : ""}
        </p>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Auto-syncs about {INTERVAL_LABELS[String(interval)]?.toLowerCase()} while
        the app is open; the deployed cron runs it in the background.
      </p>
    </section>
  );
}

/* ---------------- Ingestion issues (FR-1.7) ---------------- */

function IngestionIssuesCard() {
  const errors = useIngestErrors();
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Ingestion issues</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alert emails that couldn’t be parsed into leads.
          </p>
        </div>
        {errors.length > 0 && (
          <Button variant="outline" onClick={() => clearIngestErrors()}>
            Clear
          </Button>
        )}
      </div>

      {errors.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No issues — every alert parsed cleanly.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {errors.map((e) => (
            <li key={e.id} className="rounded-lg border p-3">
              <p className="text-xs font-medium">{e.reason}</p>
              {e.rawExcerpt && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {e.rawExcerpt}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fmtDateTime(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- AI provider & API key ---------------- */

function AiProviderCard() {
  const ai = useAiSettings();
  const [provider, setProvider] = useState<AiProvider>(ai.provider);
  const [model, setModel] = useState(ai.model);
  const [keyInput, setKeyInput] = useState("");
  const [editingKey, setEditingKey] = useState(!ai.keyConfigured);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProvider(ai.provider);
    setModel(ai.model);
    setEditingKey(!ai.keyConfigured);
  }, [ai]);

  function pickProvider(p: AiProvider) {
    setProvider(p);
    updateAiSettings({ provider: p, model });
  }

  function saveModel() {
    updateAiSettings({ provider, model });
  }

  function saveKey() {
    const key = keyInput.trim();
    if (key.length < 8) {
      setError("Enter a valid API key.");
      return;
    }
    setError("");
    saveAiKey(key);
    setKeyInput("");
    setEditingKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function removeKey() {
    removeAiKey();
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
            ai.keyConfigured
              ? "rounded-full bg-status-applied px-2.5 py-0.5 text-[11px] font-medium text-status-applied-foreground"
              : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {ai.keyConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select
            items={AI_PROVIDER_LABELS}
            value={provider}
            onValueChange={(v) => pickProvider((v as AiProvider) ?? provider)}
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
            onBlur={saveModel}
            placeholder={AI_PROVIDER_DEFAULT_MODEL[provider]}
          />
        </Field>
      </div>

      <div className="mt-3">
        <span className="text-xs font-medium text-muted-foreground">
          API key
        </span>
        {ai.keyConfigured && !editingKey ? (
          <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              {provider === "openai" ? "sk" : "sk-ant"}-••••••••{ai.keyLast4}
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
              placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"}
              autoComplete="off"
              className="flex-1 font-mono"
            />
            <div className="flex items-center gap-2">
              <Button onClick={saveKey}>Save key</Button>
              {ai.keyConfigured && (
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

/* ---------------- AI prompts ---------------- */

function AiPromptsCard() {
  const prompts = useAiPrompts();
  const [summary, setSummary] = useState(prompts.summary);
  const [draft, setDraft] = useState(prompts.draft);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSummary(prompts.summary);
    setDraft(prompts.draft);
  }, [prompts]);

  function save() {
    updateAiPrompts({ summary, draft });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI prompts</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Customize the instructions used by “Summarize with AI” and “Draft with
        AI”. Leave blank to use the default. Write instructions only — the pasted
        job description and the lead/contact details are added automatically.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Summarize prompt
            </span>
            {summary && (
              <button
                type="button"
                onClick={() => setSummary("")}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            )}
          </div>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={DEFAULT_SUMMARY_PROMPT}
            className="mt-1.5 min-h-24"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Draft outreach prompt
            </span>
            {draft && (
              <button
                type="button"
                onClick={() => setDraft("")}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </button>
            )}
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={DEFAULT_DRAFT_PROMPT}
            className="mt-1.5 min-h-32"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>Save prompts</Button>
          {saved && (
            <span className="text-xs text-status-applied-foreground">Saved</span>
          )}
        </div>
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
  const resumes = useResumes();
  const [defaultResumeId, setDefaultResumeId] = useDefaultResumeId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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
      setPendingName(file.name.replace(/\.[^.]+$/, ""));
      setNameError("");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirmUpload() {
    if (!pending) return;
    const label = pendingName.trim();
    if (!label) {
      setNameError("Give this resume a name.");
      return;
    }
    addResume({
      label,
      fileName: pending.fileName,
      fileType: pending.fileType,
      sizeKb: pending.sizeKb,
    });
    setPending(null);
    setPendingName("");
  }

  function saveEdit(id: string) {
    const label = editLabel.trim();
    if (label) renameResume(id, label);
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
                    <span className="min-w-0 truncate">{r.fileName}</span>
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
                  onClick={() => deleteResume(r.id)}
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
            <div className="min-w-0 space-y-4 py-1">
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
        <Button variant="destructive" onClick={signOutToHome}>
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
