"use client";

// Settings — the single place for the admin's account AND all app-wide
// configuration. Mirrors the user panel's settings design (grouped tab sidebar +
// section cards), built from admin-only primitives. UI-first; most Application
// sections are placeholders until their backends are wired.

import { useEffect, useRef, useState } from "react";
import {
  User,
  Lock,
  Cog,
  CreditCard,
  Mail,
  Sparkles,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  Send,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { PasswordField, isPasswordValid } from "@/components/admin/ui/password-field";
import { usePasswordPolicy, setPasswordPolicy } from "@/lib/admin/password-policy";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  render: () => React.ReactNode;
}

const SECTION = {
  profile: { id: "profile", label: "Profile", icon: User, render: () => <ProfileCard /> },
  password: { id: "password", label: "Password", icon: Lock, render: () => <PasswordCard /> },
  general: { id: "general", label: "General", icon: Cog, render: () => <GeneralCard /> },
  billing: { id: "billing", label: "Billing", icon: CreditCard, render: () => <BillingCard /> },
  email: { id: "email", label: "Email / SMTP", icon: Mail, render: () => <EmailCard /> },
  ai: { id: "ai", label: "AI", icon: Sparkles, render: () => <AiCard /> },
  cron: { id: "cron", label: "Cron & schedule", icon: Clock, render: () => <CronCard /> },
  security: { id: "security", label: "Security", icon: ShieldCheck, render: () => <SecurityCard /> },
} satisfies Record<string, SettingsSection>;

const GROUPS: { label: string; items: SettingsSection[] }[] = [
  { label: "Account", items: [SECTION.profile, SECTION.password] },
  { label: "Application", items: [SECTION.general, SECTION.billing, SECTION.email, SECTION.ai, SECTION.cron, SECTION.security] },
];
const SECTIONS: SettingsSection[] = GROUPS.flatMap((g) => g.items);

function TabButton({ section, active, onSelect }: { section: SettingsSection; active: boolean; onSelect: (id: string) => void }) {
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
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} />
      {section.label}
    </button>
  );
}

export default function AdminSettingsPage() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="lg:flex lg:gap-6">
        {/* Mobile / tablet: horizontal strip */}
        <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
          {SECTIONS.map((s) => (
            <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
          ))}
        </nav>

        {/* Desktop: grouped vertical sidebar */}
        <nav aria-label="Settings sections" className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-5">
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">{g.label}</p>
              {g.items.map((s) => (
                <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-4 min-w-0 flex-1 lg:mt-0">{current.render()}</div>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SaveRow({ onSave, label = "Save changes" }: { onSave?: () => void; label?: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button
        onClick={() => {
          onSave?.();
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        {label}
      </Button>
      {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
    </div>
  );
}

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaCls =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Checkbox + label (+ optional hint) row.
function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
      />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

// Multi-select dropdown (checkbox list in a popover). Closes on outside click.
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = selected.length
    ? options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ")
    : placeholder;

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(selectCls, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cn("truncate", !selected.length && "text-muted-foreground")}>{label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "applied", label: "Applied" },
  { value: "discarded", label: "Discarded" },
  { value: "closed", label: "Closed" },
];

// Section subtitle used to group fields within a card.
function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

// Error line + Save button + "Saved" flash. Each card owns its error/saved state.
function SaveActions({
  error,
  saved,
  onSave,
  label = "Save changes",
}: {
  error: string;
  saved: boolean;
  onSave: () => void;
  label?: string;
}) {
  return (
    <>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave}>{label}</Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
      </div>
    </>
  );
}

/* ---------------- Account ---------------- */

function ProfileCard() {
  const [name, setName] = useState("Narendra Gupta");
  const [theme, setTheme] = useState("system");
  const [rows, setRows] = useState("25");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (sign-in)">
          <Input value="narendragpt967967@gmail.com" disabled title="Your login email can't be changed here" />
        </Field>
      </div>

      <h3 className="mt-5 mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Preferences</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Theme">
          <select className={selectCls} value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Rows per page">
          <select className={selectCls} value={rows} onChange={(e) => setRows(e.target.value)}>
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </Field>
      </div>

      <SaveRow />
    </section>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function changePw() {
    if (!current) return setError("Enter your current password.");
    if (!isPasswordValid(next)) return setError("New password doesn't meet all the requirements below.");
    if (next !== confirmPw) return setError("New passwords don't match.");
    setError("");
    setCurrent("");
    setNext("");
    setConfirmPw("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const mismatch = confirmPw.length > 0 && next !== confirmPw;

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Password</h2>
      <div className="mt-4 space-y-3">
        <Field label="Current password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password">
          <PasswordField value={next} onChange={setNext} placeholder="Create a strong password" />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            className={cn(mismatch && "border-destructive")}
          />
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={changePw}>Change password</Button>
          {saved && <span className="text-xs text-status-applied-foreground">Password updated</span>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Application: Email / SMTP ---------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailCard() {
  const [enabled, setEnabled] = useState(true);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [encryption, setEncryption] = useState("starttls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fromName, setFromName] = useState("JMP");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");

  const configured = host.trim() !== "" && EMAIL_RE.test(fromEmail.trim());

  function save() {
    if (enabled) {
      if (!host.trim()) return setError("SMTP host is required.");
      if (!port.trim() || !Number.isFinite(Number(port))) return setError("Enter a valid port.");
      if (!EMAIL_RE.test(fromEmail.trim())) return setError("Enter a valid “From” email.");
      if (replyTo.trim() && !EMAIL_RE.test(replyTo.trim())) return setError("Enter a valid reply-to email.");
    }
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function sendTest() {
    if (!EMAIL_RE.test(testTo.trim())) {
      setTestMsg("Enter a valid email address.");
      return;
    }
    // Mock send until the backend is wired.
    setTestMsg(`Test email sent to ${testTo.trim()}.`);
    setTimeout(() => setTestMsg(""), 3000);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Email / SMTP</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            configured ? "bg-status-applied text-status-applied-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 cursor-pointer rounded border-input accent-primary"
        />
        Send emails via SMTP
      </label>

      <div className={cn("mt-4 space-y-3", !enabled && "pointer-events-none opacity-50")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SMTP host" hint="Your provider's mail server, e.g. smtp.gmail.com">
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Port" hint="587 STARTTLS · 465 SSL · 25 none">
              <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
            </Field>
            <Field label="Encryption" hint="Match your provider">
              <select className={selectCls} value={encryption} onChange={(e) => setEncryption(e.target.value)}>
                <option value="none">None</option>
                <option value="starttls">STARTTLS</option>
                <option value="ssl">SSL</option>
                <option value="tls">TLS</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" hint="Usually your full email address">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" autoComplete="off" />
          </Field>
          <Field label="Password" hint="Use an app password if required · stored encrypted">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From name" hint="Sender name recipients see">
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="JMP" />
          </Field>
          <Field label="From email" hint="Address emails are sent from">
            <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
          </Field>
        </div>

        <Field label="Reply-to (optional)" hint="Where replies go, if different from the From address">
          <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@example.com" />
        </Field>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save}>Save changes</Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
      </div>

      <div className="mt-5 border-t pt-4">
        <h3 className="text-sm font-medium">Send a test email</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="sm:flex-1"
          />
          <Button variant="outline" onClick={sendTest}>
            <Send /> Send test
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Sends a sample email using the settings above.</p>
        {testMsg && <p className="mt-2 text-xs text-muted-foreground">{testMsg}</p>}
      </div>
    </section>
  );
}

/* ---------------- Application: AI (integration + default prompts) ---------------- */

function AiCard() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [summary, setSummary] = useState("");
  const [draft, setDraft] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    if (key.trim() && key.trim().length < 8) return setError("Enter a valid API key.");
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider" hint="Which service runs AI features">
          <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </Field>
        <Field label="Model" hint="Leave blank to use the provider default">
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="API key" hint="Stored encrypted · used only server-side">
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" autoComplete="off" className="font-mono" />
        </Field>
      </div>

      <SubHead>Default user prompts</SubHead>
      <div className="space-y-3">
        <Field label="Summarize job description" hint="Fallback users can override in their own settings">
          <textarea className={textareaCls} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Instructions for summarizing a job description…" />
        </Field>
        <Field label="Draft outreach" hint="Fallback users can override">
          <textarea className={textareaCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Instructions for drafting outreach…" />
        </Field>
        <Field label="Fit score" hint="Fallback users can override">
          <textarea className={textareaCls} value={score} onChange={(e) => setScore(e.target.value)} placeholder="Instructions for scoring résumé/job fit…" />
        </Field>
      </div>

      <SaveActions error={error} saved={saved} onSave={save} />
    </section>
  );
}

/* ---------------- Application: General ---------------- */

const TIMEZONES = ["Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "Asia/Singapore"];

function GeneralCard() {
  const [appName, setAppName] = useState("Job Management Portal");
  const [supportEmail, setSupportEmail] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [allowSignup, setAllowSignup] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    if (!appName.trim()) return setError("App name is required.");
    if (supportEmail.trim() && !EMAIL_RE.test(supportEmail.trim())) return setError("Enter a valid support email.");
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">General</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="App name" hint="Shown in the app and in emails">
          <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
        </Field>
        <Field label="Support email" hint="Where user queries are directed">
          <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@example.com" />
        </Field>
        <Field label="Default timezone" hint="Used for schedules and timestamps">
          <select className={selectCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <Toggle checked={allowSignup} onChange={setAllowSignup} label="Allow self sign-up" hint="Off = new users are added by an admin only" />
        <Toggle checked={maintenance} onChange={setMaintenance} label="Maintenance mode" hint="Temporarily blocks user access to the app" />
      </div>
      <SaveActions error={error} saved={saved} onSave={save} />
    </section>
  );
}

/* ---------------- Application: Billing ---------------- */

function BillingCard() {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("razorpay");
  const [mode, setMode] = useState("test");
  const [currency, setCurrency] = useState("INR");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [gstin, setGstin] = useState("");
  const [taxRate, setTaxRate] = useState("18");
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("JMP-");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    if (enabled) {
      if (!keyId.trim() || !keySecret.trim()) return setError("Enter the payment gateway key ID and secret.");
    }
    const rate = Number(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return setError("Tax rate must be between 0 and 100.");
    if (gstin.trim() && gstin.trim().length !== 15) return setError("A GSTIN is 15 characters.");
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Billing</h2>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 cursor-pointer rounded border-input accent-primary" />
        Enable payments
      </label>

      <SubHead>Gateway</SubHead>
      <div className={cn("space-y-3", !enabled && "pointer-events-none opacity-50")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Provider" hint="Payment gateway">
            <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
            </select>
          </Field>
          <Field label="Mode" hint="Use test keys until go-live">
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </Field>
          <Field label="Currency" hint="Charge currency">
            <select className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Key ID" hint="Publishable / key id from the provider">
            <Input value={keyId} onChange={(e) => setKeyId(e.target.value)} autoComplete="off" className="font-mono" />
          </Field>
          <Field label="Key secret" hint="Stored encrypted · never shown to users">
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                autoComplete="off"
                className="pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </div>
      </div>

      <SubHead>Tax</SubHead>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="GSTIN" hint="15-character GST number (optional)">
          <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="font-mono" />
        </Field>
        <Field label="Tax rate (%)" hint="GST percentage applied to plans">
          <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Toggle checked={pricesIncludeTax} onChange={setPricesIncludeTax} label="Plan prices include tax" hint="Off = tax is added on top at checkout" />
      </div>

      <SubHead>Invoicing</SubHead>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" hint="Shown on invoices">
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Invoice number prefix" hint="e.g. JMP-0001">
            <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
          </Field>
        </div>
        <Field label="Company address" hint="Appears on GST invoices">
          <textarea className={textareaCls} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
        </Field>
      </div>

      <SaveActions error={error} saved={saved} onSave={save} />
    </section>
  );
}

/* ---------------- Application: Cron & schedule ---------------- */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CronCard() {
  const [syncEvery, setSyncEvery] = useState("6");
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietFrom, setQuietFrom] = useState("22:00");
  const [quietTo, setQuietTo] = useState("07:00");
  const [quietTz, setQuietTz] = useState("Asia/Kolkata");
  const [quietDays, setQuietDays] = useState<string[]>([...DAYS]);
  const [purgeEnabled, setPurgeEnabled] = useState(false);
  const [purgeDays, setPurgeDays] = useState("90");
  const [purgeStatuses, setPurgeStatuses] = useState<string[]>(["discarded", "closed"]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleDay(d: string) {
    setQuietDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function save() {
    if (purgeEnabled) {
      const n = Number(purgeDays);
      if (!Number.isFinite(n) || n < 1) return setError("Enter a valid retention window (days).");
    }
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Cron & schedule</h2>

      <div className="mt-4">
        <Field label="Gmail sync frequency" hint="How often new LinkedIn alerts are fetched">
          <select className={selectCls} value={syncEvery} onChange={(e) => setSyncEvery(e.target.value)}>
            <option value="1">Every hour</option>
            <option value="3">Every 3 hours</option>
            <option value="6">Every 6 hours</option>
            <option value="12">Every 12 hours</option>
            <option value="24">Once a day</option>
          </select>
        </Field>
      </div>

      <SubHead>Quiet hours</SubHead>
      <Toggle checked={quietEnabled} onChange={setQuietEnabled} label="Pause syncs during quiet hours" hint="No background syncs run in this window" />
      <div className={cn("mt-3 space-y-3", !quietEnabled && "pointer-events-none opacity-50")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <Input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} />
          </Field>
          <Field label="Timezone">
            <select className={selectCls} value={quietTz} onChange={(e) => setQuietTz(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Applies on</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  quietDays.includes(d) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SubHead>Lead retention</SubHead>
      <Toggle checked={purgeEnabled} onChange={setPurgeEnabled} label="Auto-delete stale leads" hint="Keeps the database lean over time" />
      <div className={cn("mt-3 grid gap-3 sm:grid-cols-2", !purgeEnabled && "pointer-events-none opacity-50")}>
        <Field label="Delete leads older than (days)" hint="Based on last activity">
          <Input type="number" min={1} value={purgeDays} onChange={(e) => setPurgeDays(e.target.value)} />
        </Field>
        <Field label="Applies to statuses" hint="Only leads in these statuses are purged">
          <MultiSelect
            options={LEAD_STATUSES}
            selected={purgeStatuses}
            onChange={setPurgeStatuses}
            placeholder="Select statuses…"
          />
        </Field>
      </div>

      <SaveActions error={error} saved={saved} onSave={save} />
    </section>
  );
}

/* ---------------- Application: Security ---------------- */

function SecurityCard() {
  const policy = usePasswordPolicy();
  const [minLength, setMinLength] = useState(String(policy.minLength));
  const [reqUpper, setReqUpper] = useState(policy.requireUpper);
  const [reqLower, setReqLower] = useState(policy.requireLower);
  const [reqNumber, setReqNumber] = useState(policy.requireNumber);
  const [reqSpecial, setReqSpecial] = useState(policy.requireSpecial);
  const [sessionLength, setSessionLength] = useState("7");
  const [sessionUnit, setSessionUnit] = useState("days");
  const [allowList, setAllowList] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save() {
    const n = Number(minLength);
    if (!Number.isFinite(n) || n < 6) return setError("Minimum password length must be at least 6.");
    const s = Number(sessionLength);
    if (!Number.isFinite(s) || s < 1) return setError("Enter a valid session length.");
    const bad = allowList
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !EMAIL_RE.test(l));
    if (bad.length) return setError(`Not a valid email in the allow-list: ${bad[0]}`);
    // Sync the shared policy so every PasswordField (add user, reset, change
    // password) updates its live checks immediately.
    setPasswordPolicy({
      minLength: Math.round(n),
      requireUpper: reqUpper,
      requireLower: reqLower,
      requireNumber: reqNumber,
      requireSpecial: reqSpecial,
    });
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Security</h2>

      <SubHead>Password policy</SubHead>
      <Field label="Minimum length" hint="Applies to every new password across the app">
        <Input type="number" min={6} value={minLength} onChange={(e) => setMinLength(e.target.value)} className="w-28" />
      </Field>
      <div className="mt-3 space-y-2">
        <Toggle checked={reqUpper} onChange={setReqUpper} label="Require an uppercase letter" />
        <Toggle checked={reqLower} onChange={setReqLower} label="Require a lowercase letter" />
        <Toggle checked={reqNumber} onChange={setReqNumber} label="Require a number" />
        <Toggle checked={reqSpecial} onChange={setReqSpecial} label="Require a special character" />
      </div>

      <SubHead>Sessions</SubHead>
      <Field label="Stay signed in for" hint="How long a login stays active">
        <div className="flex gap-2">
          <Input type="number" min={1} value={sessionLength} onChange={(e) => setSessionLength(e.target.value)} className="w-24" />
          <select className={cn(selectCls, "w-28")} value={sessionUnit} onChange={(e) => setSessionUnit(e.target.value)}>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </Field>

      <SubHead>Access</SubHead>
      <Field label="Sign-in allow-list" hint="One email per line · only these can sign in (blank = no restriction)">
        <textarea className={textareaCls} value={allowList} onChange={(e) => setAllowList(e.target.value)} placeholder={"admin@example.com\nteam@example.com"} />
      </Field>
      <div className="mt-3">
        <Toggle checked={twoFactor} onChange={setTwoFactor} label="Require two-factor authentication" hint="Applies to all users at next sign-in" />
      </div>

      <SaveActions error={error} saved={saved} onSave={save} />
    </section>
  );
}
