"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecaptcha } from "@/components/auth/use-recaptcha";

export function ForgotPasswordForm({ captchaSiteKey = null }: { captchaSiteKey?: string | null }) {
  const getCaptcha = useRecaptcha(captchaSiteKey);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    // Ignore the result on purpose — never reveal whether an account exists —
    // except a failed security check, which the user can act on.
    const res = await requestPasswordReset(email.trim(), await getCaptcha("forgot_password")).catch(() => null);
    setBusy(false);
    if (res?.error?.code === "CAPTCHA_FAILED") {
      setError(res.error.message ?? "Security check failed. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-status-applied text-status-applied-foreground">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium">{email}</span>
            , we&apos;ve sent a link to reset your password.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Email</span>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          className="h-11 bg-white/70"
        />
      </label>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="h-11 w-full">
        {busy ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/login"
        className="flex min-h-11 items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to sign in
      </Link>
    </form>
  );
}
