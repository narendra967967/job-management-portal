"use client";

// Admin Settings — affects ONLY the admin dashboard, never the user app or
// global software settings. UI-first with local state; persistence comes later.

import { useState } from "react";
import { Check, User, SlidersHorizontal, Sparkles, Lock } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { cn } from "@/lib/utils";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        These settings apply to the <span className="font-medium text-foreground">admin dashboard</span> only.
      </p>

      <ProfileSection />
      <PreferencesSection />
      <AiSection />
      <SecuritySection />
    </div>
  );
}

/* ---------- shared bits (admin-only) ---------- */
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function SaveBar({ onSave }: { onSave?: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button
        onClick={() => {
          onSave?.();
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        }}
      >
        Save changes
      </Button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-sm text-status-applied-foreground">
          <Check className="size-4" /> Saved
        </span>
      )}
    </div>
  );
}

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/* ---------- sections ---------- */
function ProfileSection() {
  const [name, setName] = useState("Administrator");
  return (
    <Section icon={User} title="Admin profile" description="Your admin account details.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (sign-in)">
          <Input value="admin@jmp" disabled />
        </Field>
      </div>
      <SaveBar />
    </Section>
  );
}

function PreferencesSection() {
  const [theme, setTheme] = useState("system");
  const [rows, setRows] = useState("25");
  return (
    <Section
      icon={SlidersHorizontal}
      title="Preferences"
      description="How the admin dashboard looks and behaves for you."
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
      <SaveBar />
    </Section>
  );
}

function AiSection() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  return (
    <Section
      icon={Sparkles}
      title="AI integration"
      description="AI provider used by admin tools (separate from the user app's AI settings)."
    >
      <div className="grid gap-4 sm:grid-cols-2">
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
      <Field label="API key">
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-…  (stored encrypted once backend is wired)"
        />
      </Field>
      <SaveBar />
    </Section>
  );
}

function SecuritySection() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <Section icon={Lock} title="Security" description="Change your admin password.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password">
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label="New password">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={cn(mismatch && "border-destructive")}
          />
        </Field>
      </div>
      {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
      <SaveBar />
    </Section>
  );
}
