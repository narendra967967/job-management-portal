"use client";

// Admin Settings (client) — tabbed sections, each loaded from the DB (initial) and
// saved via Server Actions. Secrets show a "configured" state and are only sent
// when the admin types a new value.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { setPasswordPolicy } from "@/lib/admin/password-policy";
import { adminChangePassword } from "@/lib/auth-admin-client";
import type { AdminSettings } from "@/lib/admin/settings-data";
import {
  updateAdminProfileAction,
  updateGeneralAction,
  updateSecurityAction,
  updateCronAction,
  updateBillingAction,
  updateAiAction,
  updateEmailAction,
  sendTestEmailAction,
} from "@/actions/admin-settings";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  render: (i: AdminSettings) => React.ReactNode;
}

const SECTION = {
  profile: { id: "profile", label: "Profile", icon: User, render: (i: AdminSettings) => <ProfileCard initial={i.profile} /> },
  password: { id: "password", label: "Password", icon: Lock, render: () => <PasswordCard /> },
  general: { id: "general", label: "General", icon: Cog, render: (i: AdminSettings) => <GeneralCard initial={i.general} /> },
  billing: { id: "billing", label: "Billing", icon: CreditCard, render: (i: AdminSettings) => <BillingCard initial={i.billing} /> },
  email: { id: "email", label: "Email / SMTP", icon: Mail, render: (i: AdminSettings) => <EmailCard initial={i.smtp} /> },
  ai: { id: "ai", label: "AI", icon: Sparkles, render: (i: AdminSettings) => <AiCard initial={i.ai} /> },
  cron: { id: "cron", label: "Cron & schedule", icon: Clock, render: (i: AdminSettings) => <CronCard initial={i.cron} /> },
  security: { id: "security", label: "Security", icon: ShieldCheck, render: (i: AdminSettings) => <SecurityCard initial={i.security} /> },
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

export function SettingsClient({ initial }: { initial: AdminSettings }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  // Hydrate the client password-policy store from the saved Security config so
  // every PasswordField (here, add user, reset) reflects the real policy.
  useEffect(() => {
    setPasswordPolicy({
      minLength: initial.security.pwMinLength,
      requireUpper: initial.security.pwRequireUpper,
      requireLower: initial.security.pwRequireLower,
      requireNumber: initial.security.pwRequireNumber,
      requireSpecial: initial.security.pwRequireSpecial,
    });
  }, [initial.security]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="lg:flex lg:gap-6">
        <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
          {SECTIONS.map((s) => (
            <TabButton key={s.id} section={s} active={s.id === active} onSelect={setActive} />
          ))}
        </nav>
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
        <div className="mt-4 min-w-0 flex-1 lg:mt-0">{current.render(initial)}</div>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaCls =
  "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type SaveResult = { ok: boolean; error?: string };

function useSaver() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  async function save(fn: () => Promise<SaveResult>) {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    } else {
      setError(res.error ?? "Couldn't save.");
    }
  }
  return { busy, saved, error, setError, save };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary" />
      <span>
        {label}
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function SaveRow({ busy, saved, error, onSave, label = "Save changes" }: { busy: boolean; saved: boolean; error: string; onSave: () => void; label?: string }) {
  return (
    <>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={busy}>{busy ? "Saving…" : label}</Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
      </div>
    </>
  );
}

const TIMEZONES = ["Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "Asia/Singapore"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "applied", label: "Applied" },
  { value: "discarded", label: "Discarded" },
  { value: "closed", label: "Closed" },
];

function MultiSelect({ options, selected, onChange, placeholder = "Select…" }: { options: { value: string; label: string }[]; selected: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
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
  const label = selected.length ? options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ") : placeholder;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cn(selectCls, "flex items-center justify-between gap-2 text-left")}>
        <span className={cn("truncate", !selected.length && "text-muted-foreground")}>{label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg">
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onChange(selected.includes(o.value) ? selected.filter((x) => x !== o.value) : [...selected, o.value])} className="size-4 cursor-pointer rounded border-input accent-primary" />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Account: Profile ---------------- */

function ProfileCard({ initial }: { initial: AdminSettings["profile"] }) {
  const [name, setName] = useState(initial.name);
  // Theme / rows are per-admin UI prefs with no table yet — local only for now.
  const [theme, setTheme] = useState("system");
  const [rows, setRows] = useState("25");
  const sv = useSaver();
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (sign-in)">
          <Input value={initial.email} disabled title="Your login email can't be changed here" />
        </Field>
      </div>
      <SubHead>Preferences</SubHead>
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
            <option>10</option><option>25</option><option>50</option><option>100</option>
          </select>
        </Field>
      </div>
      <SaveRow busy={sv.busy} saved={sv.saved} error={sv.error} onSave={() => sv.save(() => updateAdminProfileAction({ name }))} />
    </section>
  );
}

/* ---------------- Account: Password ---------------- */

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const mismatch = confirmPw.length > 0 && next !== confirmPw;

  async function changePw() {
    if (!current) return setError("Enter your current password.");
    if (!isPasswordValid(next)) return setError("New password doesn't meet all the requirements below.");
    if (next !== confirmPw) return setError("New passwords don't match.");
    setError("");
    setBusy(true);
    const res = await adminChangePassword(current, next);
    setBusy(false);
    if (res?.error) return setError(res.error.message ?? "Couldn't change password.");
    setCurrent("");
    setNext("");
    setConfirmPw("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
          <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={cn(mismatch && "border-destructive")} />
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button onClick={changePw} disabled={busy}>{busy ? "Updating…" : "Change password"}</Button>
          {saved && <span className="text-xs text-status-applied-foreground">Password updated</span>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Application: General ---------------- */

function GeneralCard({ initial }: { initial: AdminSettings["general"] }) {
  const [appName, setAppName] = useState(initial.appName);
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [allowSignup, setAllowSignup] = useState(initial.allowSignup);
  const [maintenance, setMaintenance] = useState(initial.maintenance);
  const sv = useSaver();
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
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        <Toggle checked={allowSignup} onChange={setAllowSignup} label="Allow self sign-up" hint="Off = new users are added by an admin only" />
        <Toggle checked={maintenance} onChange={setMaintenance} label="Maintenance mode" hint="Temporarily blocks user access to the app" />
      </div>
      <SaveRow busy={sv.busy} saved={sv.saved} error={sv.error} onSave={() => sv.save(() => updateGeneralAction({ appName, supportEmail, timezone, allowSignup, maintenance }))} />
    </section>
  );
}

/* ---------------- Application: Billing ---------------- */

function BillingCard({ initial }: { initial: AdminSettings["billing"] }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState(initial.provider);
  const [mode, setMode] = useState(initial.mode);
  const [currency, setCurrency] = useState(initial.currency);
  const [keyId, setKeyId] = useState(initial.keyId);
  const [keySecret, setKeySecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [gstin, setGstin] = useState(initial.gstin);
  const [taxRate, setTaxRate] = useState(String(initial.taxRate));
  const [pricesIncludeTax, setPricesIncludeTax] = useState(initial.pricesIncludeTax);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress);
  const [invoicePrefix, setInvoicePrefix] = useState(initial.invoicePrefix);
  const sv = useSaver();
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
          <Field label="Key secret" hint={initial.hasSecret ? "Saved · type to replace" : "Stored encrypted"}>
            <div className="relative">
              <Input type={showSecret ? "text" : "password"} value={keySecret} onChange={(e) => setKeySecret(e.target.value)} placeholder={initial.hasSecret ? "••••••••" : ""} autoComplete="off" className="pr-9 font-mono" />
              <button type="button" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? "Hide secret" : "Show secret"} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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

      <SaveRow
        busy={sv.busy}
        saved={sv.saved}
        error={sv.error}
        onSave={() =>
          sv.save(() =>
            updateBillingAction({
              enabled, provider, mode, currency, keyId, keySecret: keySecret || undefined,
              gstin, taxRate: Number(taxRate), pricesIncludeTax, companyName, companyAddress, invoicePrefix,
            }),
          )
        }
      />
    </section>
  );
}

/* ---------------- Application: Email / SMTP ---------------- */

function EmailCard({ initial }: { initial: AdminSettings["smtp"] }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [encryption, setEncryption] = useState(initial.encryption);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [fromName, setFromName] = useState(initial.fromName);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [replyTo, setReplyTo] = useState(initial.replyTo);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const sv = useSaver();

  async function sendTest() {
    setTestMsg("");
    setTestBusy(true);
    const res = await sendTestEmailAction(testTo);
    setTestBusy(false);
    setTestMsg(res.ok ? `Test email sent to ${testTo}.` : res.error ?? "Couldn't send.");
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Email / SMTP</h2>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 cursor-pointer rounded border-input accent-primary" />
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
          <Field label="Password" hint={initial.hasPassword ? "Saved · type to replace" : "Use an app password if required · stored encrypted"}>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={initial.hasPassword ? "••••••••" : ""} autoComplete="off" className="pr-9 font-mono" />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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

      <SaveRow
        busy={sv.busy}
        saved={sv.saved}
        error={sv.error}
        onSave={() =>
          sv.save(() =>
            updateEmailAction({
              enabled, host, port: Number(port), encryption, username,
              password: password || undefined, fromName, fromEmail, replyTo,
            }),
          )
        }
      />

      <div className="mt-5 border-t pt-4">
        <h3 className="text-sm font-medium">Send a test email</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className="sm:flex-1" />
          <Button variant="outline" onClick={sendTest} disabled={testBusy}>
            <Send /> {testBusy ? "Sending…" : "Send test"}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Uses the saved settings above.</p>
        {testMsg && <p className="mt-2 text-xs text-muted-foreground">{testMsg}</p>}
      </div>
    </section>
  );
}

/* ---------------- Application: AI ---------------- */

function AiCard({ initial }: { initial: AdminSettings["ai"] }) {
  const [provider, setProvider] = useState(initial.adminProvider);
  const [model, setModel] = useState(initial.adminModel);
  const [key, setKey] = useState("");
  const [summary, setSummary] = useState(initial.defaultPromptSummary);
  const [draft, setDraft] = useState(initial.defaultPromptDraft);
  const [score, setScore] = useState(initial.defaultPromptScore);
  const sv = useSaver();
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
        <Field label="API key" hint={initial.hasKey ? `Saved (…${initial.keyLast4}) · type to replace` : "Stored encrypted · used only server-side"}>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={initial.hasKey ? "••••••••" : "sk-…"} autoComplete="off" className="font-mono" />
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

      <SaveRow
        busy={sv.busy}
        saved={sv.saved}
        error={sv.error}
        onSave={() =>
          sv.save(() =>
            updateAiAction({
              adminProvider: provider, adminModel: model, adminKey: key || undefined,
              defaultPromptSummary: summary, defaultPromptDraft: draft, defaultPromptScore: score,
            }),
          )
        }
      />
    </section>
  );
}

/* ---------------- Application: Cron & schedule ---------------- */

function CronCard({ initial }: { initial: AdminSettings["cron"] }) {
  const [syncEvery, setSyncEvery] = useState(String(initial.syncIntervalHours));
  const [quietEnabled, setQuietEnabled] = useState(initial.quietEnabled);
  const [quietFrom, setQuietFrom] = useState(initial.quietFrom);
  const [quietTo, setQuietTo] = useState(initial.quietTo);
  const [quietTz, setQuietTz] = useState(initial.quietTz);
  const [quietDays, setQuietDays] = useState<string[]>(initial.quietDays);
  const [purgeEnabled, setPurgeEnabled] = useState(initial.purgeEnabled);
  const [purgeDays, setPurgeDays] = useState(String(initial.purgeDays));
  const [purgeStatuses, setPurgeStatuses] = useState<string[]>(initial.purgeStatuses);
  const sv = useSaver();

  function toggleDay(d: string) {
    setQuietDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
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
          <Field label="From"><Input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)} /></Field>
          <Field label="Timezone">
            <select className={selectCls} value={quietTz} onChange={(e) => setQuietTz(e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Applies on</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button key={d} type="button" onClick={() => toggleDay(d)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors", quietDays.includes(d) ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted")}>
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
          <MultiSelect options={LEAD_STATUSES} selected={purgeStatuses} onChange={setPurgeStatuses} placeholder="Select statuses…" />
        </Field>
      </div>

      <SaveRow
        busy={sv.busy}
        saved={sv.saved}
        error={sv.error}
        onSave={() =>
          sv.save(() =>
            updateCronAction({
              syncIntervalHours: Number(syncEvery), quietEnabled, quietFrom, quietTo, quietTz, quietDays,
              purgeEnabled, purgeDays: Number(purgeDays), purgeStatuses,
            }),
          )
        }
      />
    </section>
  );
}

/* ---------------- Application: Security ---------------- */

function SecurityCard({ initial }: { initial: AdminSettings["security"] }) {
  const [minLength, setMinLength] = useState(String(initial.pwMinLength));
  const [reqUpper, setReqUpper] = useState(initial.pwRequireUpper);
  const [reqLower, setReqLower] = useState(initial.pwRequireLower);
  const [reqNumber, setReqNumber] = useState(initial.pwRequireNumber);
  const [reqSpecial, setReqSpecial] = useState(initial.pwRequireSpecial);
  const [sessionValue, setSessionValue] = useState(String(initial.sessionValue));
  const [sessionUnit, setSessionUnit] = useState(initial.sessionUnit);
  const sv = useSaver();

  async function onSave() {
    const n = Number(minLength);
    if (!Number.isFinite(n) || n < 6) {
      sv.setError("Minimum password length must be at least 6.");
      return;
    }
    await sv.save(async () => {
      const res = await updateSecurityAction({
        pwMinLength: Math.round(n),
        pwRequireUpper: reqUpper,
        pwRequireLower: reqLower,
        pwRequireNumber: reqNumber,
        pwRequireSpecial: reqSpecial,
        sessionValue: Number(sessionValue),
        sessionUnit,
      });
      // Reflect the new policy in this session's PasswordField checks immediately.
      if (res.ok) {
        setPasswordPolicy({
          minLength: Math.round(n),
          requireUpper: reqUpper,
          requireLower: reqLower,
          requireNumber: reqNumber,
          requireSpecial: reqSpecial,
        });
      }
      return res;
    });
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
      <Field label="Stay signed in for" hint="How long a user login stays active">
        <div className="flex gap-2">
          <Input type="number" min={1} value={sessionValue} onChange={(e) => setSessionValue(e.target.value)} className="w-24" />
          <select className={cn(selectCls, "w-28")} value={sessionUnit} onChange={(e) => setSessionUnit(e.target.value)}>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </Field>

      <SaveRow busy={sv.busy} saved={sv.saved} error={sv.error} onSave={onSave} />
    </section>
  );
}
