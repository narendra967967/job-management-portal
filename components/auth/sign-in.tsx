"use client";

import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { signInEmail } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Password
        </span>
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {show ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </label>

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
