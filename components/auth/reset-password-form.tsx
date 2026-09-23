"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { resetPassword } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";

export function ResetPasswordForm({
  token,
  tokenError,
}: {
  token: string;
  tokenError?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || tokenError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await resetPassword(token, password);
    if (res?.error) {
      setError(res.error.message ?? "Couldn't reset password. Try again.");
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
        <PasswordStrength value={password} />
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
