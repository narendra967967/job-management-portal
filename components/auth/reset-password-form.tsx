"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { resetPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

function rulesFor(p: PasswordPolicy): { label: string; test: (v: string) => boolean }[] {
  const rules = [{ label: `At least ${p.minLength} characters`, test: (v: string) => v.length >= p.minLength }];
  if (p.requireUpper) rules.push({ label: "An uppercase letter (A–Z)", test: (v: string) => /[A-Z]/.test(v) });
  if (p.requireLower) rules.push({ label: "A lowercase letter (a–z)", test: (v: string) => /[a-z]/.test(v) });
  if (p.requireNumber) rules.push({ label: "A number (0–9)", test: (v: string) => /\d/.test(v) });
  if (p.requireSpecial) rules.push({ label: "A special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) });
  return rules;
}

export function ResetPasswordForm({
  token,
  tokenError,
  policy,
}: {
  token: string;
  tokenError?: string;
  policy: PasswordPolicy;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || tokenError;
  const rules = rulesFor(policy);
  const passwordValid = rules.every((r) => r.test(password));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordValid) {
      setError("Password doesn't meet all the requirements below.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await resetPasswordAction(token, password);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  if (invalidLink) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          This reset link is invalid or has expired. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium">Password updated</p>
        <p className="text-sm text-muted-foreground">
          You can now sign in with your new password.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          New password
        </span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {password.length > 0 && (
          <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {rules.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={cn("flex items-center gap-1.5 text-[11px]", ok ? "text-status-applied-foreground" : "text-muted-foreground")}>
                  {ok ? <Check className="size-3 shrink-0" aria-hidden /> : <X className="size-3 shrink-0 opacity-60" aria-hidden />}
                  {r.label}
                </li>
              );
            })}
          </ul>
        )}
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Confirm new password
        </span>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="h-10 w-full">
        {busy ? "Updating…" : "Update password"}
      </Button>
      <Link
        href="/"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to sign in
      </Link>
    </form>
  );
}
