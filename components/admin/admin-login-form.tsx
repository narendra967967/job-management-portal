"use client";

// Admin login form — standalone (no admin shell). Authenticates via Better Auth
// (email + password) and requires an admin-role account; the (panel) layout
// re-checks the session + role on every authed page. Rendered by
// app/jmp-admin/login/page.tsx, which passes the reCAPTCHA site key.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { adminAuthClient, adminSignInEmail } from "@/lib/auth-admin-client";
import { useRecaptcha } from "@/components/auth/use-recaptcha";

export function AdminLoginForm({ captchaSiteKey = null }: { captchaSiteKey?: string | null }) {
  const router = useRouter();
  const getCaptcha = useRecaptcha(captchaSiteKey);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await adminSignInEmail(email.trim(), password, await getCaptcha("admin_login"));
    if (res.error) {
      setError(res.error.message ?? "Invalid email or password.");
      setBusy(false);
      return;
    }
    // Admin panel is admin-only — reject non-admins (and sign them back out).
    const role = (res.data?.user as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      // Generic message — don't reveal that the credentials are valid.
      await adminAuthClient.signOut();
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }
    router.push("/jmp-admin/dashboard");
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Brand light pools on the dark panel — colour for the glass card to frost. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(34rem 26rem at 50% 0%, oklch(0.55 0.2 277 / 0.45), transparent 70%)",
            "radial-gradient(28rem 22rem at 100% 100%, oklch(0.5 0.18 308 / 0.35), transparent 70%)",
            "radial-gradient(26rem 20rem at 0% 80%, oklch(0.55 0.1 200 / 0.22), transparent 70%)",
          ].join(", "),
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {/* The mark is a gradient-on-transparent logo — seat it on a light tile
              (and contain, not crop) so it reads on the dark control panel. */}
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/40 ring-1 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/branding/logo"
              alt="Jobtiva"
              width={40}
              height={40}
              className="size-10 object-contain"
            />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">Jobtiva Admin</h1>
            <p className="text-sm text-slate-400">Sign in to the control panel</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/5 backdrop-blur-xl sm:p-7"
        >
          <div className="space-y-1.5">
            <Label className="text-slate-200">Email</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@jmp"
              className="h-11 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
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
                className="h-11 border-white/10 bg-slate-950/50 pr-11 text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-200"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">{error}</p>
          )}

          <Button type="submit" disabled={busy} className="h-11 w-full justify-center gap-2">
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
