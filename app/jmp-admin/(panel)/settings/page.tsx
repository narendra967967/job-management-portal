"use client";

// Settings — the single place for the admin's account AND all app-wide
// configuration. Mirrors the user panel's settings design (grouped tab sidebar +
// section cards), built from admin-only primitives. UI-first; most Application
// sections are placeholders until their backends are wired.

import { useState } from "react";
import {
  User,
  SlidersHorizontal,
  Sparkles,
  Lock,
  Cog,
  Mail,
  Wallet,
  Receipt,
  Wand2,
  Clock,
  ShieldCheck,
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
  preferences: { id: "preferences", label: "Preferences", icon: SlidersHorizontal, render: () => <PreferencesCard /> },
  ai: { id: "ai", label: "AI integration", icon: Sparkles, render: () => <AiCard /> },
  password: { id: "password", label: "Password", icon: Lock, render: () => <PasswordCard /> },
  general: { id: "general", label: "General", icon: Cog, render: () => <PlaceholderCard title="General" /> },
  email: { id: "email", label: "Email / SMTP", icon: Mail, render: () => <PlaceholderCard title="Email / SMTP" /> },
  payments: { id: "payments", label: "Payments", icon: Wallet, render: () => <PlaceholderCard title="Payments" /> },
  taxes: { id: "taxes", label: "Taxes & GST", icon: Receipt, render: () => <PlaceholderCard title="Taxes & GST" /> },
  prompts: { id: "prompts", label: "AI & prompts", icon: Wand2, render: () => <PlaceholderCard title="AI & prompts" /> },
  cron: { id: "cron", label: "Cron & schedule", icon: Clock, render: () => <PlaceholderCard title="Cron & schedule" /> },
  security: { id: "security", label: "Security", icon: ShieldCheck, render: () => <PlaceholderCard title="Security" /> },
} satisfies Record<string, SettingsSection>;

const GROUPS: { label: string; items: SettingsSection[] }[] = [
  { label: "Account", items: [SECTION.profile, SECTION.preferences, SECTION.ai, SECTION.password] },
  {
    label: "Application",
    items: [SECTION.general, SECTION.email, SECTION.payments, SECTION.taxes, SECTION.prompts, SECTION.cron, SECTION.security],
  },
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
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

/* ---------------- Account sections ---------------- */

function ProfileCard() {
  const [name, setName] = useState("Narendra Gupta");
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
      <SaveRow />
    </section>
  );
}

function PreferencesCard() {
  const [theme, setTheme] = useState("system");
  const [rows, setRows] = useState("25");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Preferences</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

function AiCard() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI integration</h2>
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
