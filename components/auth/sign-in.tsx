"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { signInEmail } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await signInEmail(email.trim(), password, remember);
    if (res?.error) {
      setError(res.error.message ?? "Incorrect email or password.");
      setBusy(false);
      return;
    }
    window.location.href = "/leads";
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
          className="h-10"
        />
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Password
          </span>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-3.5 rounded border-input accent-primary"
        />
        Keep me signed in
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="h-10 w-full">
        <LogIn className="size-4" aria-hidden />
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
