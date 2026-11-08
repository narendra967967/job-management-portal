"use client";

// Admin → Settings → Email delivery: which service sends every email the app
// sends (SMTP or Amazon SES), the SMTP card (unchanged) and the Amazon SES card.
// Both setups are kept, so switching back and forth loses nothing.
// Secrets are write-only: saved encrypted, never sent back to the browser.

import { useId, useState } from "react";
import { CheckCircle2, ChevronDown, Eye, EyeOff, PlugZap, Send } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Field } from "@/components/admin/settings/form-bits";
import {
  PROVIDER_LABELS,
  SES_REGION_SUGGESTIONS,
  accessKeyIdError,
  emailError,
  regionError,
  secretKeyError,
  sesMissing,
  smtpReady,
  type EmailProvider,
  type SesAccountInfo,
  type SesSettings,
} from "@/lib/email-delivery-model";
import { saveSes, sendSesTest, setProvider, testSes, useEmailDelivery } from "@/lib/email-delivery-mock";
import { useMounted } from "@/lib/use-mounted";
import { cn, formatDateTime } from "@/lib/utils";

interface SmtpSummary {
  enabled: boolean;
  host: string;
  fromEmail: string;
}

/** PHASE 1: the Amazon SES parts don't change how email is sent yet. */
function SampleBanner() {
  return (
    <p className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      Sample data while this is being built. Choosing Amazon SES here doesn&apos;t change how email is sent yet.
    </p>
  );
}

export function EmailDeliverySection({ smtp, children }: { smtp: SmtpSummary; children: React.ReactNode }) {
  const delivery = useEmailDelivery();
  if (!delivery) return null;
  return (
    <div className="space-y-4">
      <SampleBanner />
      {/* A fresh card when readiness changes, so an old "not set up" message goes. */}
      <ProviderCard
        key={`${delivery.provider}|${sesMissing(delivery.ses).length}|${smtpReady(smtp)}`}
        provider={delivery.provider}
        smtp={smtp}
        ses={delivery.ses}
      />
      <DeliveryAccordion
        title="SMTP"
        badge={<ServiceBadge inUse={delivery.provider === "smtp"} ready={smtpReady(smtp)} />}
        defaultOpen={delivery.provider === "smtp"}
      >
        {children}
      </DeliveryAccordion>
      <DeliveryAccordion
        title="Amazon SES"
        badge={<ServiceBadge inUse={delivery.provider === "ses"} ready={sesMissing(delivery.ses).length === 0} />}
        defaultOpen={delivery.provider === "ses"}
        info={
          <InfoTip label="Setting up Amazon SES">
            In the AWS console: verify your domain in SES (it gives you DNS records to add), request production access
            so you can email anyone, then create an IAM user that is only allowed to send email and make an access key
            for it.
          </InfoTip>
        }
      >
        {/* Remount when the stored values change, so the form starts from them. */}
        <SesCard key={`${delivery.ses.region}|${delivery.ses.accessKeyId}|${delivery.ses.fromEmail}`} ses={delivery.ses} />
      </DeliveryAccordion>
    </div>
  );
}

/* ---------------- accordion ---------------- */

function ServiceBadge({ inUse, ready }: { inUse: boolean; ready: boolean }) {
  if (inUse) return <Badge variant="success">In use</Badge>;
  return <Badge variant={ready ? "neutral" : "warning"}>{ready ? "Ready" : "Not set up"}</Badge>;
}

/**
 * One service's settings, folded away when not needed. The content stays
 * mounted while closed, so anything typed survives folding.
 */
export function DeliveryAccordion({
  title,
  badge,
  info,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  info?: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center gap-1 px-4 md:px-5">
        <h2 className="min-w-0 flex-1 text-sm font-medium">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-14 w-full items-center gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
            <span>{title}</span>
            {badge}
          </button>
        </h2>
        {info}
      </div>
      <div id={id} hidden={!open} className="border-t px-4 py-4 md:px-5 md:pb-5">
        {children}
      </div>
    </section>
  );
}

/* ---------------- which service sends ---------------- */

function ProviderCard({ provider, smtp, ses }: { provider: EmailProvider; smtp: SmtpSummary; ses: SesSettings }) {
  const [choosing, setChoosing] = useState<EmailProvider | null>(null);
  const [error, setError] = useState("");
  const missing = sesMissing(ses);
  const ready: Record<EmailProvider, boolean> = { smtp: smtpReady(smtp), ses: missing.length === 0 };

  function choose(p: EmailProvider) {
    if (p === provider) return;
    if (p === "ses" && !ready.ses) return setError(`Save the Amazon SES details first. Still needed: ${missing.join(", ")}.`);
    if (p === "smtp" && !ready.smtp) return setError("Turn on SMTP and save its server and from email first.");
    setError("");
    setChoosing(p);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-1 text-sm font-medium">
        Send emails with
        <InfoTip label="About the email service">
          Every email the app sends goes through the service chosen here: sign-in emails, codes, receipts, reminders and
          broadcasts. The other one&apos;s details are kept, so you can switch back at any time.
        </InfoTip>
      </h2>
      <div className="mt-3 grid gap-2 lg:grid-cols-2" role="radiogroup" aria-label="Email service">
        {(["smtp", "ses"] as EmailProvider[]).map((p) => {
          const active = p === provider;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(p)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  active ? "border-primary" : "border-muted-foreground/40",
                )}
                aria-hidden
              >
                {active && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{PROVIDER_LABELS[p]}</span>
              {active ? (
                <Badge variant="success">In use</Badge>
              ) : (
                <Badge variant={ready[p] ? "neutral" : "warning"}>{ready[p] ? "Ready" : "Not set up"}</Badge>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <ConfirmDialog
        open={!!choosing}
        onOpenChange={(o) => !o && setChoosing(null)}
        title={`Send every email through ${choosing ? PROVIDER_LABELS[choosing] : ""}?`}
        description={
          choosing === "ses"
            ? "It takes over right away for every email the app sends. Send yourself a test from the Amazon SES card first, and check the account isn't still in the SES sandbox."
            : "It takes over right away for every email the app sends. Send yourself a test from the SMTP card first."
        }
        confirmLabel={`Use ${choosing ? PROVIDER_LABELS[choosing] : ""}`}
        onConfirm={async () => {
          if (!choosing) return;
          const res = await setProvider(choosing);
          if (!res.ok) setError(res.error);
        }}
      />
    </section>
  );
}

/* ---------------- Amazon SES ---------------- */

function SesCard({ ses }: { ses: SesSettings }) {
  const mounted = useMounted();
  const [region, setRegion] = useState(ses.region);
  const [accessKeyId, setAccessKeyId] = useState(ses.accessKeyId);
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [fromName, setFromName] = useState(ses.fromName);
  const [fromEmail, setFromEmail] = useState(ses.fromEmail);
  const [replyTo, setReplyTo] = useState(ses.replyTo);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const errors = {
    region: regionError(region),
    accessKeyId: accessKeyIdError(accessKeyId),
    secret: secretKeyError(secret),
    fromEmail: emailError(fromEmail),
    replyTo: emailError(replyTo),
  };
  const dirty =
    region !== ses.region ||
    accessKeyId !== ses.accessKeyId ||
    !!secret ||
    fromName !== ses.fromName ||
    fromEmail !== ses.fromEmail ||
    replyTo !== ses.replyTo;

  async function save() {
    const first = Object.values(errors).find(Boolean);
    if (first) return setError(first);
    if (!region.trim() || !accessKeyId.trim() || !fromEmail.trim()) return setError("Region, access key ID and from email are needed.");
    if (!ses.hasSecret && !secret.trim()) return setError("Add the secret access key.");
    if (!secret && ses.accessKeyId && accessKeyId.trim() !== ses.accessKeyId) {
      return setError("A new access key ID needs its secret access key too.");
    }
    setError("");
    setSaving(true);
    const res = await saveSes({ region, accessKeyId, secretAccessKey: secret, fromName, fromEmail, replyTo });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function testConnection() {
    if (dirty) return setError("Save your changes first. Test connection uses the saved details.");
    if (sesMissing(ses).length) return setError(`Save the details first. Still needed: ${sesMissing(ses).join(", ")}.`);
    setError("");
    setTesting(true);
    const res = await testSes();
    setTesting(false);
    if (!res.ok) setError(res.error);
  }

  async function sendTest() {
    setTestMsg(null);
    if (emailError(testTo) || !testTo.trim()) return setTestMsg({ ok: false, text: "Enter the address to send the test to." });
    if (sesMissing(ses).length) return setTestMsg({ ok: false, text: "Save the Amazon SES details first." });
    setTestBusy(true);
    const res = await sendSesTest(testTo.trim());
    setTestBusy(false);
    setTestMsg(res.ok ? { ok: true, text: `Test email sent to ${res.to} through Amazon SES.` } : { ok: false, text: res.error });
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Region" hint="Where your domain is verified in SES, e.g. ap-south-1">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value.trim().toLowerCase())}
            list="ses-regions"
            placeholder="ap-south-1"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!errors.region}
            className="font-mono"
          />
          <datalist id="ses-regions">
            {SES_REGION_SUGGESTIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </datalist>
          {errors.region && <span className="block text-[11px] text-destructive">{errors.region}</span>}
        </Field>
        <Field label="Access key ID" hint="From the IAM user's Security credentials tab">
          <Input
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value.trim())}
            placeholder="AKIA…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!errors.accessKeyId}
            className="font-mono"
          />
          {errors.accessKeyId && <span className="block text-[11px] text-destructive">{errors.accessKeyId}</span>}
        </Field>
        <Field
          label="Secret access key"
          hint={ses.hasSecret ? "Saved · type to replace" : "Shown once when you create the key; stored encrypted"}
          className="sm:col-span-2"
        >
          <Input
            type={show ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={ses.hasSecret ? "••••••••" : ""}
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={!!errors.secret}
            className="font-mono"
          />
          {errors.secret && <span className="block text-[11px] text-destructive">{errors.secret}</span>}
        </Field>
      </div>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
        {show ? "Hide what I'm typing" : "Show what I'm typing"}
      </button>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="From name" hint="Sender name recipients see">
          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Jobtiva" />
        </Field>
        <Field label="From email" hint="Must be on a domain or address verified in SES">
          <Input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value.trim())}
            placeholder="noreply@example.com"
            aria-invalid={!!errors.fromEmail}
          />
          {errors.fromEmail && <span className="block text-[11px] text-destructive">{errors.fromEmail}</span>}
        </Field>
        <Field label="Reply-to (optional)" hint="Where replies go, if different from the From address" className="sm:col-span-2">
          <Input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value.trim())}
            placeholder="support@example.com"
            aria-invalid={!!errors.replyTo}
          />
          {errors.replyTo && <span className="block text-[11px] text-destructive">{errors.replyTo}</span>}
        </Field>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-xs text-status-applied-foreground">Saved</span>}
        <Button variant="outline" className="min-h-9" onClick={testConnection} disabled={testing}>
          <PlugZap className="size-4" aria-hidden />
          {testing ? "Testing…" : "Test connection"}
        </Button>
        {mounted && ses.lastTestAt && (
          <span className={ses.lastTestOk ? "text-xs text-status-applied-foreground" : "text-xs text-destructive"}>
            {ses.lastTestOk ? "Connected" : "Couldn't connect"} · {formatDateTime(ses.lastTestAt)}
          </span>
        )}
      </div>

      {ses.lastTestOk && ses.account && <AccountPanel account={ses.account} />}

      <div className="mt-5 border-t pt-4">
        <h3 className="flex items-center gap-1 text-sm font-medium">
          Send a test email
          <InfoTip label="About the SES test email">
            Goes through Amazon SES with the saved details, even while SMTP is in use, so you can try SES before
            switching to it. While the account is in the sandbox, the address must be verified in SES too.
          </InfoTip>
        </h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="sm:flex-1"
            aria-label="Send the test to"
          />
          <Button variant="outline" onClick={sendTest} disabled={testBusy}>
            <Send /> {testBusy ? "Sending…" : "Send test"}
          </Button>
        </div>
        {testMsg && (
          <p className={cn("mt-2 text-xs", testMsg.ok ? "text-status-applied-foreground" : "text-destructive")}>{testMsg.text}</p>
        )}
      </div>
    </div>
  );
}

function AccountPanel({ account: a }: { account: SesAccountInfo }) {
  const rows: [string, React.ReactNode, boolean][] = [
    ["Sending", a.sendingEnabled ? "Allowed" : "Paused by AWS", a.sendingEnabled],
    [
      "Account",
      a.productionAccess ? "Production access" : "Sandbox: only verified addresses receive email",
      a.productionAccess,
    ],
    [
      "Daily limit",
      `${a.max24HourSend.toLocaleString("en-US")} emails (${a.sentLast24Hours.toLocaleString("en-US")} sent in the last 24 hours)`,
      true,
    ],
    ["Send rate", `${a.maxSendRate.toLocaleString("en-US")} ${a.maxSendRate === 1 ? "email" : "emails"} a second`, true],
  ];
  return (
    <dl className="mt-4 divide-y rounded-xl border text-xs">
      {rows.map(([k, v, good]) => (
        <div key={k} className="flex items-start gap-3 px-3 py-2.5">
          <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
          <dd className={cn("flex min-w-0 flex-1 items-start gap-1.5", !good && "text-status-shortlisted-foreground")}>
            {good && k !== "Daily limit" && k !== "Send rate" && (
              <CheckCircle2 className="mt-px size-3.5 shrink-0 text-status-applied-foreground" aria-hidden />
            )}
            <span>{v}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
