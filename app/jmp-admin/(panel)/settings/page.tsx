"use client";

// Admin "Account" settings — the admin's own profile, preferences, AI tools key,
// and password. Mirrors the USER panel's settings design (grouped tab sidebar +
// section cards) but is built from admin-only primitives (no shared user UI).
// UI-first with local state; persistence comes later.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  LogOut,
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
  account: { id: "account", label: "Account", icon: ShieldCheck, render: () => <AccountCard /> },
} satisfies Record<string, SettingsSection>;

const GROUPS: { label: string; items: SettingsSection[] }[] = [
  { label: "General", items: [SECTION.profile, SECTION.preferences] },
  { label: "AI", items: [SECTION.ai] },
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
      <p className="text-sm text-muted-foreground">
        Your admin profile, preferences, and password — these apply to the{" "}
        <span className="font-medium text-foreground">admin dashboard</span> only.
      </p>

      <div className="mt-5 lg:flex lg:gap-6">
        {/* Mobile / tablet: horizontal strip */}
        <nav
          aria-label="Settings sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden"
        >
          {SECTIONS.map((s) => (
            <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
          ))}
        </nav>

        {/* Desktop: grouped vertical sidebar */}
        <nav
          aria-label="Settings sections"
          className="hidden lg:block lg:w-56 lg:shrink-0 lg:space-y-5"
        >
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {g.label}
              </p>
              {g.items.map((s) => (
                <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
              ))}
            </div>
          ))}
          <div className="space-y-1 border-t pt-4">
            {FOOTER.map((s) => (
              <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
            ))}
          </div>
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

/* ---------------- Profile ---------------- */

function ProfileCard() {
  const [name, setName] = useState("Administrator");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Your admin account details.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (sign-in)">
          <Input value="admin@jmp" disabled title="Your login email can't be changed here" />
        </Field>
      </div>
      <SaveRow />
    </section>
  );
}

/* ---------------- Preferences ---------------- */

function PreferencesCard() {
  const [theme, setTheme] = useState("system");
  const [rows, setRows] = useState("25");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Preferences</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How the admin dashboard looks and behaves for you.
      </p>
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

/* ---------------- AI integration ---------------- */

function AiCard() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">AI integration</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        AI provider used by admin tools (separate from the user app&apos;s AI settings).
      </p>
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
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
            className="font-mono"
          />
        </Field>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Stored encrypted and used only server-side once the backend is wired. Your key is never
          sent to the browser or exposed in client code.
        </p>
      </div>
      <SaveRow label="Save key" />
    </section>
  );
}

/* ---------------- Account (password + sign out) ---------------- */

function AccountCard() {
  const router = useRouter();
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
    // TODO: real password change when admin auth is wired.
    setCurrent("");
    setNext("");
    setConfirmPw("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const mismatch = confirmPw.length > 0 && next !== confirmPw;

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Account</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Change your password or sign out.</p>

      <div className="mt-4 space-y-3">
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
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
          {saved && (
            <span className="text-xs text-status-applied-foreground">Password updated</span>
          )}
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        <Button variant="destructive" onClick={() => router.push("/jmp-admin/login")}>
          <LogOut className="size-4" aria-hidden />
          Log out
        </Button>
      </div>
    </section>
  );
}
