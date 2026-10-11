"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserPlus, MailCheck, Check } from "lucide-react";
import { signUpAction } from "@/actions/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

// Client-safe mirror of the server password policy (passed in from the page).
type Policy = {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
};

function buildRules(p: Policy): { label: string; test: (v: string) => boolean }[] {
  const r: { label: string; test: (v: string) => boolean }[] = [
    { label: `At least ${p.minLength} characters`, test: (v) => v.length >= p.minLength },
  ];
  if (p.requireUpper) r.push({ label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) });
  if (p.requireLower) r.push({ label: "A lowercase letter", test: (v) => /[a-z]/.test(v) });
  if (p.requireNumber) r.push({ label: "A number", test: (v) => /\d/.test(v) });
  if (p.requireSpecial) r.push({ label: "A special character", test: (v) => /[^A-Za-z0-9]/.test(v) });
  return r;
}

export function SignupForm({ policy }: { policy: Policy }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const rules = useMemo(() => buildRules(policy), [policy]);

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-semibold">Check your email</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          Click it to activate your account — it expires in 1 hour.
        </p>
        <Link href="/login" className="mt-5 text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter your name.");
    if (!email.trim()) return setError("Enter your email.");
    if (rules.some((r) => !r.test(password))) return setError("Your password doesn't meet the requirements below.");
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    const res = await signUpAction({ name: name.trim(), email: email.trim(), password });
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="h-10" maxLength={80} />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Email</span>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="h-10" />
      </label>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Password</span>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        {password.length > 0 && (
          <ul className="mt-2 space-y-1">
            {rules.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={cn("flex items-center gap-1.5 text-[11px]", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  <span className={cn("flex size-3.5 items-center justify-center rounded-full", ok ? "bg-emerald-500/15" : "bg-muted")}>
                    {ok && <Check className="size-2.5" aria-hidden />}
                  </span>
                  {r.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Confirm password</span>
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {confirm.length > 0 && confirm !== password && (
          <p className="text-[11px] text-destructive">Passwords don&apos;t match.</p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={busy} className="h-10 w-full">
        <UserPlus className="size-4" aria-hidden />
        {busy ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
