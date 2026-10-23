"use client";

// Admin → Settings → Email intake (A1, A2, A6): forwarding on/off and size
// limit, the Connect Gmail switch (confirmed both ways), and the allowed
// senders list. Spec: docs/email-forwarding.md. Values come from the server
// page; every change goes through actions/admin-email-intake.ts, then refreshes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Field, SubHead, Toggle, SaveRow, selectCls } from "@/components/admin/settings/form-bits";
import {
  MAX_BYTES_MAX,
  MAX_BYTES_MIN,
  PARSER_LABELS,
  domainWithin,
  formatBytes,
  isValidDomain,
  senderMatchDomain,
  type InboundParser,
  type InboundSender,
} from "@/lib/email-intake-model";
import {
  createSenderAction,
  deleteSenderAction,
  setGmailOAuthEnabledAction,
  setSenderEnabledAction,
  updateIntakeSettingsAction,
  updateSenderAction,
} from "@/actions/admin-email-intake";
import type { AdminSettings } from "@/lib/admin/settings-data";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function EmailIntakeCard({ initial }: { initial: AdminSettings["intake"] }) {
  const { config, senders, gmailConnectedUsers } = initial;
  const router = useRouter();
  const mounted = useMounted();

  // A1 — forwarding settings (local draft, saved explicitly)
  const [forwarding, setForwarding] = useState(config.forwardingEnabled);
  const [maxMb, setMaxMb] = useState(String(config.maxBytes / (1024 * 1024)));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveForwarding() {
    const mb = Number(maxMb);
    const bytes = Math.round(mb * 1024 * 1024);
    if (!Number.isFinite(mb) || bytes < MAX_BYTES_MIN || bytes > MAX_BYTES_MAX) {
      setError(`Max email size must be between ${formatBytes(MAX_BYTES_MIN)} and ${formatBytes(MAX_BYTES_MAX)}.`);
      return;
    }
    setError("");
    setBusy(true);
    const res = await updateIntakeSettingsAction({ forwardingEnabled: forwarding, maxBytes: bytes });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  // A6 — Connect Gmail switch
  const [gmailDialog, setGmailDialog] = useState(false);
  const [gmailFlash, setGmailFlash] = useState("");
  const [gmailError, setGmailError] = useState("");
  async function applyGmailSwitch() {
    const turningOff = config.gmailOAuthEnabled;
    setGmailError("");
    const res = await setGmailOAuthEnabledAction({ enabled: !turningOff });
    if (!res.ok) return setGmailError(res.error);
    setGmailFlash(
      turningOff
        ? `Connect Gmail turned off — ${plural(res.disconnected, "connection")} revoked and removed.`
        : "Connect Gmail turned on — users can connect Gmail again.",
    );
    setTimeout(() => setGmailFlash(""), 4000);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-medium">Email intake</h2>

      {/* A1 */}
      <SubHead>Email forwarding</SubHead>
      <Toggle
        checked={forwarding}
        onChange={setForwarding}
        label="Accept forwarded job alerts"
        hint="Off: incoming mail is refused with a temporary error, so senders retry later"
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Receiving domain" hint="Set per environment on the server">
          <Input value={config.receivingDomain} readOnly className="bg-muted/40 text-muted-foreground" />
        </Field>
        <Field label="Max email size (MB)" hint="LinkedIn alerts are about 0.1 MB · allowed 0.25–10">
          <Input
            type="number"
            min={0.25}
            max={10}
            step={0.25}
            value={maxMb}
            onChange={(e) => {
              setMaxMb(e.target.value);
              if (error) setError("");
            }}
            className="w-32"
          />
        </Field>
      </div>
      <SaveRow busy={busy} saved={saved} error={error} onSave={saveForwarding} />

      {/* A6 */}
      <SubHead>Connect Gmail</SubHead>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={config.gmailOAuthEnabled ? "success" : "neutral"}>
          {config.gmailOAuthEnabled ? "Active" : "Inactive"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {config.gmailOAuthEnabled
            ? `${plural(gmailConnectedUsers, "user")} connected`
            : "Hidden from users · no syncs"}
          {mounted && config.gmailToggledAt
            ? ` · changed by ${config.gmailToggledBy ?? "admin"}, ${formatDateTime(config.gmailToggledAt)}`
            : ""}
        </span>
        <Button
          variant={config.gmailOAuthEnabled ? "destructive" : "default"}
          className="ml-auto min-h-9"
          onClick={() => setGmailDialog(true)}
        >
          {config.gmailOAuthEnabled ? "Turn off" : "Turn on"}
        </Button>
      </div>
      {gmailFlash && (
        <p role="status" className="mt-3 rounded-lg bg-status-applied px-3 py-2 text-xs text-status-applied-foreground">
          {gmailFlash}
        </p>
      )}
      {gmailError && <p className="mt-3 text-xs text-destructive">{gmailError}</p>}
      <ConfirmDialog
        open={gmailDialog}
        onOpenChange={setGmailDialog}
        title={config.gmailOAuthEnabled ? "Turn off Connect Gmail?" : "Turn on Connect Gmail?"}
        description={
          config.gmailOAuthEnabled
            ? `This immediately disconnects ${plural(gmailConnectedUsers, "user")} and revokes Jobtiva's access to their Gmail. The Gmail connection and Sync schedule options disappear for everyone. Existing leads stay. If you turn it back on, each user must reconnect.`
            : "Users will see the Gmail connection and Sync schedule options again. Google still limits unverified apps to 100 users in total and shows them an 'unverified app' warning."
        }
        confirmLabel={config.gmailOAuthEnabled ? "Turn off" : "Turn on"}
        destructive={config.gmailOAuthEnabled}
        onConfirm={applyGmailSwitch}
      />

      {/* A2 */}
      <SubHead>Allowed senders</SubHead>
      <SendersTable senders={senders} onChanged={() => router.refresh()} />
    </section>
  );
}

/* ---------------- A2: allowed senders ---------------- */

function SendersTable({ senders, onChanged }: { senders: InboundSender[]; onChanged: () => void }) {
  // The form target stays set while the dialog animates closed (only `formOpen`
  // flips), so the dialog never renders empty; `formKey` resets the form per open.
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<InboundSender | "new">("new");
  const [formKey, setFormKey] = useState(0);
  function openForm(t: InboundSender | "new") {
    setTarget(t);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }
  const [deleting, setDeleting] = useState<InboundSender | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const enabledCount = senders.filter((s) => s.enabled).length;

  /** Runs one change; the server keeps at least one sender enabled. */
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>): Promise<string | null> {
    setPending(true);
    setError("");
    const res = await fn();
    setPending(false);
    if (!res.ok) return res.error ?? "Couldn't save.";
    onChanged();
    return null;
  }
  async function setEnabled(s: InboundSender, enabled: boolean) {
    const err = await run(() => setSenderEnabledAction(s.id, enabled));
    if (err) setError(err);
  }

  return (
    <div>
      {/* Wide screens: table; phone/tablet/laptop (next to the admin sidebar): stacked rows */}
      <div className="hidden overflow-hidden rounded-lg border xl:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Sender</th>
              <th className="px-3 py-2 font-medium">Signed by</th>
              <th className="px-3 py-2 font-medium">Reader</th>
              <th className="px-3 py-2 font-medium">Enabled</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {senders.map((s) => (
              <tr key={s.id} className={s.enabled ? "" : "opacity-60"}>
                <td className="px-3 py-2 font-mono text-[12px] break-all">{s.match}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{s.signingDomain}</td>
                <td className="px-3 py-2 text-xs">
                  {s.parser === "none" ? <Badge variant="warning">No reader yet</Badge> : PARSER_LABELS[s.parser]}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Enable ${s.match}`}
                    checked={s.enabled}
                    disabled={pending}
                    onChange={(e) => setEnabled(s, e.target.checked)}
                    className="size-4 cursor-pointer accent-primary"
                  />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <RowActions onEdit={() => openForm(s)} onDelete={() => setDeleting(s)} label={s.match} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 xl:hidden">
        {senders.map((s) => (
          <li key={s.id} className={`rounded-lg border p-3 ${s.enabled ? "" : "opacity-60"}`}>
            <p className="font-mono text-[12px] break-all">{s.match}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Signed by <span className="font-mono">{s.signingDomain}</span> ·{" "}
              {s.parser === "none" ? "No reader yet" : PARSER_LABELS[s.parser]}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <label className="flex min-h-10 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  disabled={pending}
                    onChange={(e) => setEnabled(s, e.target.checked)}
                  className="size-4 accent-primary"
                />
                Enabled
              </label>
              <RowActions onEdit={() => openForm(s)} onDelete={() => setDeleting(s)} label={s.match} />
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <Button variant="outline" className="min-h-9" onClick={() => openForm("new")}>
          <Plus className="size-4" aria-hidden />
          Add sender
        </Button>
        <span className="text-[11px] text-muted-foreground">{enabledCount} enabled</span>
      </div>

      {/* Always mounted (open toggles) — mounting it inside the opening click
          would count that click as an outside press and close it at once. */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <SenderForm
            key={formKey}
            initial={target === "new" ? null : target}
            onClose={() => setFormOpen(false)}
            onSave={async (s) => {
              const input = { match: s.match, signingDomain: s.signingDomain, parser: s.parser, enabled: s.enabled };
              const err = await run(() =>
                target === "new" ? createSenderAction(input) : updateSenderAction(target.id, input),
              );
              if (!err) setFormOpen(false);
              return err;
            }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.match ?? ""}?`}
        description="Emails from this sender will be rejected from now on. Leads already created stay."
        confirmLabel="Remove sender"
        destructive
        onConfirm={async () => {
          const d = deleting;
          setDeleting(null);
          if (!d) return;
          const err = await run(() => deleteSenderAction(d.id));
          if (err) setError(err);
        }}
      />
    </div>
  );
}

function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <span className="inline-flex gap-1">
      <Button variant="ghost" size="icon" aria-label={`Edit ${label}`} title="Edit" onClick={onEdit}>
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${label}`}
        title="Remove"
        onClick={onDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </span>
  );
}

function SenderForm({
  initial,
  onClose,
  onSave,
}: {
  initial: InboundSender | null;
  onClose: () => void;
  /** Resolves to an error message, or null when saved. */
  onSave: (s: InboundSender) => Promise<string | null>;
}) {
  const [match, setMatch] = useState(initial?.match ?? "");
  const [signingDomain, setSigningDomain] = useState(initial?.signingDomain ?? "");
  const [parser, setParser] = useState<InboundParser>(initial?.parser ?? "none");
  const [errors, setErrors] = useState<{ match?: string; signingDomain?: string }>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const m = match.trim().toLowerCase();
    const d = signingDomain.trim().toLowerCase();
    const next: typeof errors = {};
    const md = senderMatchDomain(m);
    if (!md) next.match = "Enter an email address or *@domain (e.g. *@naukri.com).";
    if (!isValidDomain(d)) next.signingDomain = "Enter a domain like linkedin.com.";
    else if (md && !domainWithin(md, d)) next.signingDomain = `The sender's domain (${md}) must be ${d} or one of its subdomains.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    const err = await onSave({ id: initial?.id ?? "", match: m, signingDomain: d, parser, enabled: initial?.enabled ?? true });
    setSaving(false);
    setServerError(err ?? "");
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit sender" : "Add sender"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Sender" hint="Exact address, or *@domain for every address on a domain">
            <Input
              value={match}
              onChange={(e) => {
                setMatch(e.target.value);
                if (errors.match) setErrors({ ...errors, match: undefined });
              }}
              placeholder="jobalerts@naukri.com"
              aria-invalid={!!errors.match}
            />
            {errors.match && <span className="block text-[11px] text-destructive">{errors.match}</span>}
          </Field>
          <Field label="Signed by (DKIM domain)" hint="The domain that digitally signs this sender's emails">
            <Input
              value={signingDomain}
              onChange={(e) => {
                setSigningDomain(e.target.value);
                if (errors.signingDomain) setErrors({ ...errors, signingDomain: undefined });
              }}
              placeholder="naukri.com"
              aria-invalid={!!errors.signingDomain}
            />
            {errors.signingDomain && <span className="block text-[11px] text-destructive">{errors.signingDomain}</span>}
          </Field>
          <Field label="Reader" hint="Without a reader, emails are accepted but logged as Unsupported format">
            <select className={selectCls} value={parser} onChange={(e) => setParser(e.target.value as InboundParser)}>
              {(Object.keys(PARSER_LABELS) as InboundParser[]).map((p) => (
                <option key={p} value={p}>
                  {PARSER_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {initial ? "Save sender" : "Add sender"}
          </Button>
        </DialogFooter>
    </>
  );
}
