"use client";

// Admin → Settings → Email intake (A1, A2, A6): forwarding on/off and size
// limit, the Connect Gmail switch (confirmed both ways), and the allowed
// senders list. Spec: docs/email-forwarding.md. PHASE 2: sample data only
// (lib/email-intake-mock.ts) — nothing is saved to the server yet.

import { useState } from "react";
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
  MOCK_GMAIL_CONNECTED_USERS,
  resetMockIntake,
  updateMockConfig,
  updateMockIntake,
  useMockIntake,
} from "@/lib/email-intake-mock";
import { useMounted } from "@/lib/use-mounted";
import { formatDateTime } from "@/lib/utils";

export function EmailIntakeCard() {
  const { config, senders } = useMockIntake();
  const mounted = useMounted();

  // A1 — forwarding settings (local draft, saved explicitly)
  const [forwarding, setForwarding] = useState(config.forwardingEnabled);
  const [maxMb, setMaxMb] = useState(String(config.maxBytes / (1024 * 1024)));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function saveForwarding() {
    const mb = Number(maxMb);
    const bytes = Math.round(mb * 1024 * 1024);
    if (!Number.isFinite(mb) || bytes < MAX_BYTES_MIN || bytes > MAX_BYTES_MAX) {
      setError(`Max email size must be between ${formatBytes(MAX_BYTES_MIN)} and ${formatBytes(MAX_BYTES_MAX)}.`);
      return;
    }
    setError("");
    updateMockConfig({ forwardingEnabled: forwarding, maxBytes: bytes });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  // A6 — Connect Gmail switch
  const [gmailDialog, setGmailDialog] = useState(false);
  const [gmailFlash, setGmailFlash] = useState("");
  function applyGmailSwitch() {
    const turningOff = config.gmailOAuthEnabled;
    updateMockConfig({
      gmailOAuthEnabled: !turningOff,
      gmailToggledAt: new Date().toISOString(),
      gmailToggledBy: "You",
    });
    setGmailFlash(
      turningOff
        ? `Connect Gmail turned off — ${MOCK_GMAIL_CONNECTED_USERS} connections revoked and removed.`
        : "Connect Gmail turned on — users can connect Gmail again.",
    );
    setTimeout(() => setGmailFlash(""), 4000);
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Email intake</h2>
        <button
          type="button"
          onClick={resetMockIntake}
          className="min-h-8 rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 text-[11px] font-medium text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          Sample data · reset
        </button>
      </div>

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
      <SaveRow busy={false} saved={saved} error={error} onSave={saveForwarding} />

      {/* A6 */}
      <SubHead>Connect Gmail</SubHead>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={config.gmailOAuthEnabled ? "success" : "neutral"}>
          {config.gmailOAuthEnabled ? "Active" : "Inactive"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {config.gmailOAuthEnabled
            ? `${MOCK_GMAIL_CONNECTED_USERS} users connected`
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
      <ConfirmDialog
        open={gmailDialog}
        onOpenChange={setGmailDialog}
        title={config.gmailOAuthEnabled ? "Turn off Connect Gmail?" : "Turn on Connect Gmail?"}
        description={
          config.gmailOAuthEnabled
            ? `This immediately disconnects ${MOCK_GMAIL_CONNECTED_USERS} users and revokes Jobtiva's access to their Gmail. The Gmail connection and Sync schedule options disappear for everyone. Existing leads stay. If you turn it back on, each user must reconnect.`
            : "Users will see the Gmail connection and Sync schedule options again. Google still limits unverified apps to 100 users in total and shows them an 'unverified app' warning."
        }
        confirmLabel={config.gmailOAuthEnabled ? "Turn off" : "Turn on"}
        destructive={config.gmailOAuthEnabled}
        onConfirm={applyGmailSwitch}
      />

      {/* A2 */}
      <SubHead>Allowed senders</SubHead>
      <SendersTable senders={senders} />
    </section>
  );
}

/* ---------------- A2: allowed senders ---------------- */

function SendersTable({ senders }: { senders: InboundSender[] }) {
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
  const enabledCount = senders.filter((s) => s.enabled).length;

  function save(next: InboundSender[]) {
    if (!next.some((s) => s.enabled)) {
      setError("Keep at least one sender enabled, or turn email forwarding off instead.");
      return false;
    }
    setError("");
    updateMockIntake({ senders: next });
    return true;
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
                    onChange={(e) => save(senders.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))}
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
                  onChange={(e) => save(senders.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)))}
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
            onSave={(s) => {
              const next = target === "new" ? [...senders, s] : senders.map((x) => (x.id === s.id ? s : x));
              if (save(next)) setFormOpen(false);
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
        onConfirm={() => {
          const d = deleting;
          setDeleting(null);
          if (d) save(senders.filter((x) => x.id !== d.id));
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
  onSave: (s: InboundSender) => void;
}) {
  const [match, setMatch] = useState(initial?.match ?? "");
  const [signingDomain, setSigningDomain] = useState(initial?.signingDomain ?? "");
  const [parser, setParser] = useState<InboundParser>(initial?.parser ?? "none");
  const [errors, setErrors] = useState<{ match?: string; signingDomain?: string }>({});

  function submit() {
    const m = match.trim().toLowerCase();
    const d = signingDomain.trim().toLowerCase();
    const next: typeof errors = {};
    const md = senderMatchDomain(m);
    if (!md) next.match = "Enter an email address or *@domain (e.g. *@naukri.com).";
    if (!isValidDomain(d)) next.signingDomain = "Enter a domain like linkedin.com.";
    else if (md && !domainWithin(md, d)) next.signingDomain = `The sender's domain (${md}) must be ${d} or one of its subdomains.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({ id: initial?.id ?? `s-${Date.now()}`, match: m, signingDomain: d, parser, enabled: initial?.enabled ?? true });
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{initial ? "Save sender" : "Add sender"}</Button>
        </DialogFooter>
    </>
  );
}
