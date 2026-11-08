"use client";

// Admin → Settings → Payments: one card per payment gateway (Razorpay for now;
// more are added as modules). Each has on/off (confirmed both ways), test/live
// mode, the key ID, write-only secrets, the webhook URL to paste into the
// gateway's dashboard, and Test connection. Spec: memory payments-plan.
// Secrets are write-only: saved encrypted, never sent back to the browser.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, PlugZap } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { Field, selectCls } from "@/components/admin/settings/form-bits";
import { GATEWAY_LABELS, type GatewaySettings } from "@/lib/billing-model";
import { saveGatewayAction, setGatewayEnabledAction, testGatewayAction } from "@/actions/admin-payments";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

/** Razorpay key IDs start rzp_test_ or rzp_live_, matching the mode. */
function keyIdError(keyId: string, mode: "test" | "live"): string {
  const k = keyId.trim();
  if (!k) return "";
  if (!/^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.test(k)) return "That doesn't look like a Razorpay key ID (rzp_test_… or rzp_live_…).";
  if (!k.startsWith(`rzp_${mode}_`)) return `This is a ${k.startsWith("rzp_live_") ? "live" : "test"} key, but the mode is ${mode}.`;
  return "";
}

export function PaymentsCard({ gateways, billingMissing }: { gateways: GatewaySettings[]; billingMissing: string[] }) {
  return (
    <div className="space-y-4">
      {billingMissing.length > 0 && (
        <p className="rounded-lg bg-status-shortlisted/50 px-3 py-2.5 text-xs text-status-shortlisted-foreground">
          Billing isn&rsquo;t complete, so online payment stays off even with a gateway on, and users request plans
          through support. Still needed in Settings → Billing: {billingMissing.join(", ")}.
        </p>
      )}
      {/* Remount when the stored values change, so the form starts from them. */}
      {gateways.map((g) => (
        <GatewayCard key={`${g.id}|${g.mode}|${g.keyId}`} gateway={g} />
      ))}
    </div>
  );
}

function GatewayCard({ gateway: g }: { gateway: GatewaySettings }) {
  const mounted = useMounted();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(g.mode);
  const [keyId, setKeyId] = useState(g.keyId);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => setWebhookUrl(`${window.location.origin}/api/webhooks/${g.id}`), [g.id]);

  const idError = keyIdError(keyId, mode);

  async function save(confirmedLive = false) {
    if (idError) return setError(idError);
    if (mode === "live" && g.mode !== "live" && !confirmedLive) return setLiveOpen(true);
    setError("");
    setSaving(true);
    const res = await saveGatewayAction({ id: g.id, mode, keyId: keyId.trim(), keySecret, webhookSecret });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setKeySecret("");
    setWebhookSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  async function testConnection() {
    setTesting(true);
    setError("");
    const res = await testGatewayAction({ id: g.id });
    setTesting(false);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function toggle() {
    const res = await setGatewayEnabledAction({ id: g.id, enabled: !g.enabled });
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  function requestSwitch() {
    if (!g.enabled && !(g.keyId && g.hasKeySecret && g.hasWebhookSecret)) {
      return setError("Save the key ID, key secret and webhook secret before turning it on.");
    }
    setError("");
    setSwitchOpen(true);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* select manually */
    }
  }

  const label = GATEWAY_LABELS[g.id];

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">{label}</h2>
        <Badge variant={g.enabled ? "success" : "neutral"}>{g.enabled ? "Active" : "Inactive"}</Badge>
        <Badge variant={g.mode === "live" ? "warning" : "neutral"}>{g.mode === "live" ? "Live" : "Test"}</Badge>
        <Button
          variant={g.enabled ? "destructive" : "default"}
          className="ml-auto min-h-9"
          onClick={requestSwitch}
        >
          {g.enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Mode" hint="Test keys charge nothing; switch to live for real payments">
          <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value as "test" | "live")}>
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </Field>
        <Field label="Key ID" hint="Razorpay Dashboard → Account & Settings → API keys">
          <Input
            value={keyId}
            onChange={(e) => {
              setKeyId(e.target.value);
              if (error) setError("");
            }}
            placeholder={mode === "live" ? "rzp_live_…" : "rzp_test_…"}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!idError}
            className="font-mono"
          />
          {idError && <span className="block text-[11px] text-destructive">{idError}</span>}
        </Field>
        <SecretField
          label="Key secret"
          hint={g.hasKeySecret ? "Saved · type to replace" : "Shown once when you create the key; stored encrypted"}
          value={keySecret}
          onChange={setKeySecret}
          isSet={g.hasKeySecret}
          show={show}
        />
        <SecretField
          label="Webhook secret"
          hint={g.hasWebhookSecret ? "Saved · type to replace" : "The secret you set when adding the webhook in Razorpay"}
          value={webhookSecret}
          onChange={setWebhookSecret}
          isSet={g.hasWebhookSecret}
          show={show}
        />
      </div>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        {show ? "Hide what I'm typing" : "Show what I'm typing"}
      </button>

      <div className="mt-3">
        <Field label="Webhook URL" hint="Add it in Razorpay → Webhooks with the events payment.captured, payment.failed and order.paid">
          <div className="flex items-stretch gap-2">
            <Input value={webhookUrl} readOnly className="bg-muted/40 font-mono text-muted-foreground" />
            <Button variant="outline" className="min-h-9 shrink-0" onClick={copyUrl} aria-label="Copy webhook URL">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            </Button>
          </div>
        </Field>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
        <Button variant="outline" className="min-h-9" onClick={testConnection} disabled={testing}>
          <PlugZap className="size-4" aria-hidden />
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {mounted && g.lastTestAt && (
          <span className={g.lastTestOk ? "text-xs text-status-applied-foreground" : "text-xs text-destructive"}>
            {g.lastTestOk ? "Connected" : "Couldn't connect"} · {formatDateTime(g.lastTestAt)}
          </span>
        )}
      </div>

      <ConfirmDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        title={g.enabled ? `Turn off ${label}?` : `Turn on ${label}?`}
        description={
          g.enabled
            ? "Users go back to requesting plans through support. Payments already made aren't affected."
            : g.mode === "live"
              ? "Users will pay for plans online with real money. Upgrade requests through support are replaced by checkout."
              : "Users will see online checkout in test mode: nothing is charged, so only test cards and test UPI work."
        }
        confirmLabel={g.enabled ? "Turn off" : "Turn on"}
        destructive={g.enabled}
        onConfirm={toggle}
      />
      <ConfirmDialog
        open={liveOpen}
        onOpenChange={setLiveOpen}
        title={`Switch ${label} to live mode?`}
        description="Real payments will be charged. Make sure the key ID and secrets are your live keys."
        confirmLabel="Switch to live"
        destructive
        onConfirm={() => save(true)}
      />
    </section>
  );
}

function SecretField({
  label,
  hint,
  value,
  onChange,
  isSet,
  show,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  isSet: boolean;
  show: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? "••••••••" : ""}
        autoComplete="new-password"
        spellCheck={false}
        className="font-mono"
      />
    </Field>
  );
}
