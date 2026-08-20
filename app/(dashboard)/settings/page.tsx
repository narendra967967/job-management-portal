"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { mockGoogleConnection, mockProfile, mockResumes } from "@/lib/mock-data";
import type { Resume } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, resumes, and Google connection.
        </p>
      </div>

      <ProfileCard />
      <GoogleCard />
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

/* ---------------- Resumes ---------------- */

function ResumesCard() {
  const [resumes, setResumes] = useState<Resume[]>(mockResumes);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    setResumes((r) => [
      ...r,
      {
        id: `resume-${Date.now()}`,
        label,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewLabel("");
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
        Versions you can pick from when drafting outreach. PDF upload arrives with
        the integration phase.
      </p>

      <ul className="mt-4 space-y-2">
        {resumes.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {editingId === r.id ? (
              <>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-8 flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Save"
                  onClick={() => saveEdit(r.id)}
                  className="flex size-8 items-center justify-center rounded-md text-status-applied-foreground hover:bg-muted"
                >
                  <Check className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => setEditingId(null)}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Updated {r.updatedAt}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Rename ${r.label}`}
                  onClick={() => {
                    setEditingId(r.id);
                    setEditLabel(r.label);
                  }}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${r.label}`}
                  onClick={() =>
                    setResumes((list) => list.filter((x) => x.id !== r.id))
                  }
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
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

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New resume label, e.g. PM — Fintech"
          className="flex-1"
        />
        <Button variant="outline" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
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
