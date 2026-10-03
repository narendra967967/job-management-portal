"use client";

// Admin login — standalone (no admin shell). UI-first: submitting currently
// just enters the panel; real credential auth is wired in the backend phase.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // TODO: replace with real admin auth. UI-only for now.
    setTimeout(() => router.push("/jmp-admin/dashboard"), 400);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Shield className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">JMP Admin</h1>
            <p className="text-sm text-slate-400">Sign in to the control panel</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-6 shadow-xl backdrop-blur"
        >
          <div className="space-y-1.5">
            <Label className="text-slate-200">Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@jmp"
              className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-200">Password</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-700 bg-slate-900 pr-9 text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full justify-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-slate-500">
            Authorized administrators only.
          </p>
        </form>
      </div>
    </div>
  );
}
