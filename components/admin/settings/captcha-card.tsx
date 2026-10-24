"use client";

// Admin → Settings → Security → Google reCAPTCHA v3 on the sign-in, sign-up and
// password pages (user + admin). Turning it on first fetches a live token with
// the entered site key in this browser; the server only saves if Google accepts
// it with the secret — so bad keys can't lock anyone out (lib/captcha.ts).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/admin/ui/input";
import { Field, SaveRow, SubHead, Toggle } from "@/components/admin/settings/form-bits";
import { updateCaptchaAction } from "@/actions/admin-settings";
import { recaptchaToken } from "@/components/auth/use-recaptcha";
import type { AdminSettings } from "@/lib/admin/settings-data";

export function CaptchaCard({ initial }: { initial: AdminSettings["captcha"] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [siteKey, setSiteKey] = useState(initial.siteKey);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function onSave() {
    setBusy(true);
    setError("");
    const key = siteKey.trim();
    // A live token proves the site key works on this domain.
    const testToken = enabled && key ? await recaptchaToken(key, "admin_test") : "";
    const res = await updateCaptchaAction({ enabled, siteKey: key, secret: secret.trim() || undefined, testToken });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save.");
      return;
    }
    setSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Google reCAPTCHA</h2>

      {initial.forcedOff && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-status-shortlisted px-3 py-2 text-xs text-status-shortlisted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Turned off on the server (RECAPTCHA_FORCE_OFF=true) — no page is checked until that&apos;s removed.
        </p>
      )}

      <div className="mt-4">
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label="Check sign-in, sign-up and password pages"
          hint="User log in, sign up, forgot and reset password, and admin log in. Invisible v3 check."
        />
      </div>

      <SubHead>Keys</SubHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site key" hint="reCAPTCHA v3 key from the Google reCAPTCHA console">
          <Input value={siteKey} onChange={(e) => setSiteKey(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
        <Field
          label="Secret key"
          hint={initial.secretLast4 ? `Saved, ends in ${initial.secretLast4} — leave blank to keep it` : "Stored encrypted"}
        >
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={initial.secretLast4 ? `••••${initial.secretLast4}` : ""}
          />
        </Field>
      </div>

      <SaveRow busy={busy} saved={saved} error={error} onSave={onSave} label={busy ? "Checking keys…" : "Save changes"} />
    </section>
  );
}
