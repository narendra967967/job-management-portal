"use client";

import { useState } from "react";
import { signInEmail } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const res = await signInEmail(email.trim(), password);
    if (res?.error) {
      setError(res.error.message ?? "Incorrect email or password.");
      setBusy(false);
      return;
    }
    window.location.href = "/leads";
  }

  return (
    <form onSubmit={submit}>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Email</span>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
        />
      </label>
      <label className="mt-3 block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Password
        </span>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="mt-5 w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
