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
  User,
  Mail,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Wand2,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  COUNTRY_CODES,
  isValidEmail,
  joinMobile,
  splitMobile,
  validateMobile,
} from "@/lib/validation";
import {
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_DRAFT_PROMPT,
} from "@/lib/ai-prompts";
import { signOutToHome, connectGoogle } from "@/lib/auth-client";
import { previewPromptAction } from "@/actions/ai";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_PROVIDER_DEFAULT_MODEL,
  AI_PROVIDER_KEY_PREFIX,
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

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  render: () => React.ReactNode;
}

const SECTION = {
  profile: { id: "profile", label: "Profile", icon: User, render: () => <ProfileCard /> },
  google: { id: "google", label: "Gmail connection", icon: Mail, render: () => <GoogleCard /> },
  schedule: { id: "schedule", label: "Sync schedule", icon: RefreshCw, render: () => <SyncScheduleCard /> },
  issues: { id: "issues", label: "Ingestion issues", icon: AlertTriangle, render: () => <IngestionIssuesCard /> },
  ai: { id: "ai", label: "AI provider", icon: Sparkles, render: () => <AiProviderCard /> },
  prompts: { id: "prompts", label: "AI prompts", icon: Wand2, render: () => <AiPromptsCard /> },
  followups: { id: "followups", label: "Follow-ups", icon: Bell, render: () => <FollowUpsCard /> },
  resumes: { id: "resumes", label: "Resumes", icon: FileText, render: () => <ResumesCard /> },
  account: { id: "account", label: "Account", icon: ShieldCheck, render: () => <AccountCard /> },
} satisfies Record<string, SettingsSection>;

// Grouped and ordered by how central each area is to capturing and acting on
// leads: identity first, then the email pipeline that feeds everything, then
// AI enrichment, then outreach. Account (log out) sits on its own at the end.
const GROUPS: { label: string; items: SettingsSection[] }[] = [
  { label: "General", items: [SECTION.profile] },
  { label: "Email & sync", items: [SECTION.google, SECTION.schedule, SECTION.issues] },
  { label: "AI", items: [SECTION.ai, SECTION.prompts] },
  { label: "Outreach", items: [SECTION.followups, SECTION.resumes] },
];
const FOOTER: SettingsSection[] = [SECTION.account];
const SECTIONS: SettingsSection[] = [...GROUPS.flatMap((g) => g.items), ...FOOTER];

function TabButton({
  section,
  active,
  onSelect,
}: {
  section: SettingsSection;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors lg:w-full",
        active
          ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/10"
          : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground/70",
        )}
      />
      {section.label}
    </button>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Manage your profile, resumes, and Google connection.
        </p>
      </div>

      <div className="mt-5 lg:flex lg:gap-6">
        {/* Mobile / tablet: flat horizontal strip. The app's own left rail
            already appears at md, so a second sidebar there would squeeze the
            panel into a horizontal scroll — the grouped sidebar waits for lg. */}
        <nav
          aria-label="Settings sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden"
        >
          {SECTIONS.map((s) => (
            <TabButton
              key={s.id}
              section={s}
              active={s.id === active}
              onSelect={setActive}
            />
          ))}
        </nav>

        {/* Desktop: grouped vertical sidebar. */}
        <nav
          aria-label="Settings sections"
          className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-5"
        >
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {g.label}
              </p>
              {g.items.map((s) => (
                <TabButton
                  key={s.id}
                  section={s}
                  active={s.id === active}
                  onSelect={setActive}
                />
              ))}
            </div>
          ))}
          <div className="space-y-1 border-t pt-4">
            {FOOTER.map((s) => (
              <TabButton
                key={s.id}
                section={s}
                active={s.id === active}
                onSelect={setActive}
              />
            ))}
          </div>
        </nav>

        <div className="mt-4 min-w-0 flex-1 lg:mt-0">{current.render()}</div>
      </div>
    </div>
  );
}

/* ---------------- Profile ---------------- */

const DIAL_ITEMS: Record<string, string> = Object.fromEntries(
  COUNTRY_CODES.map((c) => [c.dial, `${c.flag} ${c.dial}`]),
);

interface ProfileErrors {
  name?: string;
  email?: string;
  mobile?: string;
}

function ProfileCard() {
  const profile = useProfile();
  const initialMobile = splitMobile(profile.mobile);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [dial, setDial] = useState(initialMobile.dial);
  const [national, setNational] = useState(initialMobile.national);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const m = splitMobile(profile.mobile);
    setName(profile.name);
    setEmail(profile.email);
    setDial(m.dial);
    setNational(m.national);
    setErrors({});
  }, [profile]);

  function validate(): ProfileErrors {
    const next: ProfileErrors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address.";
    const mobileError = validateMobile(dial, national);
    if (mobileError) next.mobile = mobileError;
    return next;
  }

  function save() {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      mobile: joinMobile(dial, national),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Used to identify you and sign in.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            aria-invalid={!!errors.name}
            required
          />
          {errors.name && (
            <span className="text-[11px] text-destructive">{errors.name}</span>
          )}
        </Field>
        <Field label="Mobile number">
          <div className="flex gap-2">
            <Select
              items={DIAL_ITEMS}
              value={dial}
              onValueChange={(v) => setDial(v ?? dial)}
            >
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.iso} value={c.dial}>
                    {c.flag} {c.dial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={national}
              onChange={(e) => {
                setNational(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (errors.mobile) setErrors((p) => ({ ...p, mobile: undefined }));
              }}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              aria-invalid={!!errors.mobile}
              className="flex-1"
            />
          </div>
          {errors.mobile && (
            <span className="text-[11px] text-destructive">{errors.mobile}</span>
          )}
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            aria-invalid={!!errors.email}
            required
          />
          {errors.email && (
            <span className="text-[11px] text-destructive">{errors.email}</span>
          )}
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save}>Save changes</Button>
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
  const [sendersError, setSendersError] = useState("");
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
    const badSenders = draft.senders.filter((s) => !isValidEmail(s));
    if (badSenders.length > 0) {
      setSendersError(
        `Not a valid email address: ${badSenders.join(", ")}. Put one address per line.`,
      );
      return;
    }
    setSendersError("");
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
              onChange={(e) => {
                setSendersText(e.target.value);
                if (sendersError) setSendersError("");
              }}
              placeholder="jobalerts-noreply@linkedin.com"
              aria-invalid={!!sendersError}
              className="min-h-20 font-mono text-[13px]"
            />
            {sendersError && (
              <span className="text-[11px] text-destructive">{sendersError}</span>
            )}
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
              {AI_PROVIDER_KEY_PREFIX[provider]}-••••••••{ai.keyLast4}
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
              placeholder={`${AI_PROVIDER_KEY_PREFIX[provider]}-…`}
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

type PromptType = "summary" | "draft";

const SAMPLE_DRAFT_CONTEXT = `Message type: Cold outreach
Recipient: Priya Nair, Staff Product Manager (Referral)
Role: Senior Product Manager at Stripe
My resume: PM — Payments focus
Job context: Own the payments acceptance experience at scale — reliability, cross-functional leadership, remote (US).`;

function AiPromptsCard() {
  const prompts = useAiPrompts();
  const [summary, setSummary] = useState(prompts.summary);
  const [draft, setDraft] = useState(prompts.draft);
  const prev = useRef(prompts);
  const [savedType, setSavedType] = useState<PromptType | null>(null);

  // Test modal state.
  const [testType, setTestType] = useState<PromptType | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  // Only reset a field when its *saved* value changes, so saving one prompt
  // (which refreshes the store) doesn't wipe an unsaved edit to the other.
  useEffect(() => {
    if (prompts.summary !== prev.current.summary) setSummary(prompts.summary);
    if (prompts.draft !== prev.current.draft) setDraft(prompts.draft);
    prev.current = prompts;
  }, [prompts]);

  const valueOf = (t: PromptType) => (t === "summary" ? summary : draft);
  const defaultOf = (t: PromptType) =>
    t === "summary" ? DEFAULT_SUMMARY_PROMPT : DEFAULT_DRAFT_PROMPT;

  // Save just one prompt; keep the other at its currently-saved value.
  function saveOne(t: PromptType) {
    updateAiPrompts({
      summary: t === "summary" ? summary : prompts.summary,
      draft: t === "draft" ? draft : prompts.draft,
    });
    setSavedType(t);
    setTimeout(() => setSavedType((s) => (s === t ? null : s)), 1500);
  }

  function openTest(t: PromptType) {
    setTestType(t);
    setTestResult("");
    setTestError("");
    setTestInput(t === "draft" ? SAMPLE_DRAFT_CONTEXT : "");
  }

  async function runTest() {
    if (!testType) return;
    setTesting(true);
    setTestError("");
    setTestResult("");
    // Test the current (unsaved) prompt, falling back to the default if empty.
    const system = valueOf(testType).trim() || defaultOf(testType);
    const res = await previewPromptAction(system, testInput);
    if (res.ok) setTestResult(res.output);
    else setTestError(res.error);
    setTesting(false);
  }

  function saveFromTest() {
    if (!testType) return;
    saveOne(testType);
    setTestType(null);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI prompts</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Customize the instructions used by “Summarize with AI” and “Draft with
        AI”. Leave blank to use the default. Write instructions only — the pasted
        job description and the lead/contact details are added automatically. Use
        <span className="font-medium"> Test</span> to preview a prompt before
        saving it.
      </p>

      <div className="mt-4 space-y-6">
        <PromptEditor
          label="Summarize prompt"
          value={summary}
          onChange={setSummary}
          onReset={() => setSummary("")}
          onTest={() => openTest("summary")}
          onSave={() => saveOne("summary")}
          saved={savedType === "summary"}
          placeholder={DEFAULT_SUMMARY_PROMPT}
          minHeight="min-h-24"
        />
        <PromptEditor
          label="Draft outreach prompt"
          value={draft}
          onChange={setDraft}
          onReset={() => setDraft("")}
          onTest={() => openTest("draft")}
          onSave={() => saveOne("draft")}
          saved={savedType === "draft"}
          placeholder={DEFAULT_DRAFT_PROMPT}
          minHeight="min-h-32"
        />
      </div>

      <Dialog
        open={testType !== null}
        onOpenChange={(o) => !o && !testing && setTestType(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Test {testType === "draft" ? "draft outreach" : "summarize"} prompt
            </DialogTitle>
            <DialogDescription>
              Run your prompt against sample text and review the result. Nothing
              is saved until you approve it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-test-input">
                {testType === "draft"
                  ? "Sample context"
                  : "Sample job description"}
              </Label>
              <Textarea
                id="prompt-test-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={
                  testType === "draft"
                    ? "Recipient, role, resume, job context…"
                    : "Paste a job description to summarize…"
                }
                className="min-h-28"
              />
            </div>

            <Button onClick={runTest} disabled={testing || !testInput.trim()}>
              <Sparkles className="size-4" aria-hidden />
              {testing
                ? "Running…"
                : testResult
                  ? "Run again"
                  : testType === "draft"
                    ? "Draft & test"
                    : "Summarize & test"}
            </Button>

            {testError && (
              <p className="text-xs text-destructive">{testError}</p>
            )}
            {testResult && (
              <div className="space-y-1.5">
                <Label>Generated result</Label>
                <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {testResult}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Happy with this? Save the prompt. Otherwise close, tweak it,
                  and test again.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestType(null)}
              disabled={testing}
            >
              Cancel
            </Button>
            <Button onClick={saveFromTest} disabled={!testResult || testing}>
              <Check className="size-4" aria-hidden />
              Looks good — save prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PromptEditor({
  label,
  value,
  onChange,
  onReset,
  onTest,
  onSave,
  saved,
  placeholder,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  onTest: () => void;
  onSave: () => void;
  saved: boolean;
  placeholder: string;
  minHeight: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {value && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Reset to default
          </button>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("mt-1.5", minHeight)}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" onClick={onTest}>
          <Sparkles className="size-4" aria-hidden />
          Test
        </Button>
        <Button onClick={onSave}>Save</Button>
        {saved && (
          <span className="text-xs text-status-applied-foreground">Saved</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Follow-ups ---------------- */

/** Days settings are whole numbers in 1–365. */
function clampDays(raw: string): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(365, n);
}

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
            max={365}
            step={1}
            value={settings.reminderIntervalDays}
            onChange={(e) =>
              update({
                reminderIntervalDays: clampDays(e.target.value),
              })
            }
          />
        </Field>
        <Field label="Flag lead as stale after (days)">
          <Input
            type="number"
            min={1}
            max={365}
            step={1}
            value={settings.staleLeadDays}
            onChange={(e) => update({ staleLeadDays: clampDays(e.target.value) })}
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
          <li key={r.id} className="rounded-lg border p-3">
            {editingId === r.id ? (
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText className="size-4" aria-hidden />
                </span>
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
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileText className="size-4" aria-hidden />
                  </span>
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
                </div>
                <div className="flex items-center justify-end gap-0.5">
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
                </div>
              </div>
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
