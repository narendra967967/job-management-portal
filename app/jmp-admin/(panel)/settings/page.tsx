"use client";

// Settings — the single place for the admin's account AND all app-wide
// configuration. Mirrors the user panel's settings design (grouped tab sidebar +
// section cards), built from admin-only primitives. UI-first; most Application
// sections are placeholders until their backends are wired.

import { useState } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { PasswordField, isPasswordValid } from "@/components/admin/ui/password-field";
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
  general: { id: "general", label: "General", icon: Cog, render: () => <PlaceholderCard title="General" /> },
  billing: { id: "billing", label: "Billing", icon: CreditCard, render: () => <PlaceholderCard title="Billing" /> },
  email: { id: "email", label: "Email / SMTP", icon: Mail, render: () => <EmailCard /> },
  ai: { id: "ai", label: "AI", icon: Sparkles, render: () => <AiCard /> },
  cron: { id: "cron", label: "Cron & schedule", icon: Clock, render: () => <PlaceholderCard title="Cron & schedule" /> },
  security: { id: "security", label: "Security", icon: ShieldCheck, render: () => <PlaceholderCard title="Security" /> },
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

function PlaceholderCard({ title }: { title: string }) {
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">soon</span>
      </div>
      <p className="mt-8 mb-4 text-center text-xs text-muted-foreground">Coming soon.</p>
    </section>
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
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <select className={selectCls} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </Field>
        <Field label="Model">
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o-mini" />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="API key">
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" autoComplete="off" className="font-mono" />
        </Field>
      </div>
      <SaveRow label="Save key" />

      <div className="mt-5 border-t pt-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Default user prompts</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">soon</span>
        </div>
        <p className="mt-6 mb-2 text-center text-xs text-muted-foreground">Coming soon.</p>
      </div>
    </section>
  );
}
