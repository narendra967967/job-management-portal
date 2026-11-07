"use client";

// Admin → Settings → Email intake, as two boxes: Connect Gmail (A6, the
// switch, confirmed both ways) and Email forwarding (A1 on/off + size limit,
// with A2 the allowed senders it accepts). Spec: docs/email-forwarding.md.
// Values come from the server page; every change goes through
// actions/admin-email-intake.ts, then refreshes.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Badge } from "@/components/admin/ui/badge";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/admin/ui/dropdown-menu";
import {
  BulkBar,
  RowActions as RowMenu,
  RowCheckbox,
  SelectAllCheckbox,
  TableBox,
  TablePagination,
  tableSelectCls,
  usePagination,
  useRowSelection,
} from "@/components/admin/ui/data-table";
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
  AI_MAX_JOBS_MAX,
  AI_MAX_JOBS_MIN,
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
import { toast } from "@/components/admin/ui/toast";
import { formatDateTime } from "@/lib/utils";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function EmailIntakeCard({ initial }: { initial: AdminSettings["intake"] }) {
  const { config, senders, gmailConnectedUsers } = initial;
  const router = useRouter();
  const mounted = useMounted();

  // A1 — forwarding settings (local draft, saved explicitly)
  const [forwarding, setForwarding] = useState(config.forwardingEnabled);
  const [maxMb, setMaxMb] = useState(String(config.maxBytes / (1024 * 1024)));
  const [aiMax, setAiMax] = useState(String(config.aiMaxJobs));
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
    const jobs = Number(aiMax);
    if (!Number.isInteger(jobs) || jobs < AI_MAX_JOBS_MIN || jobs > AI_MAX_JOBS_MAX) {
      setError(`Max jobs per email must be a whole number from ${AI_MAX_JOBS_MIN} to ${AI_MAX_JOBS_MAX}.`);
      return;
    }
    setError("");
    setBusy(true);
    const res = await updateIntakeSettingsAction({ forwardingEnabled: forwarding, maxBytes: bytes, aiMaxJobs: jobs });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  // A6 — Connect Gmail switch
  const [gmailDialog, setGmailDialog] = useState(false);
  const [gmailError, setGmailError] = useState("");
  async function applyGmailSwitch() {
    const turningOff = config.gmailOAuthEnabled;
    setGmailError("");
    const res = await setGmailOAuthEnabledAction({ enabled: !turningOff });
    if (!res.ok) return setGmailError(res.error);
    toast.success(
      turningOff
        ? `Connect Gmail turned off — ${plural(res.disconnected, "connection")} revoked and removed.`
        : "Connect Gmail turned on — users can connect Gmail again.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* A6 — Connect Gmail */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-sm font-medium">Connect Gmail</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
      </section>

      {/* A1 + A2 — Email forwarding and the senders it accepts */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-sm font-medium">Email forwarding</h2>
        <div className="mt-3">
          <Toggle
            checked={forwarding}
            onChange={setForwarding}
            label="Accept forwarded job alerts"
            hint="Off: incoming mail is refused with a temporary error, so senders retry later"
          />
        </div>
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
          <Field label="Max jobs per email (AI reader)" hint="Used when a site has no built-in reader · allowed 1–100">
            <Input
              type="number"
              min={AI_MAX_JOBS_MIN}
              max={AI_MAX_JOBS_MAX}
              step={1}
              value={aiMax}
              onChange={(e) => {
                setAiMax(e.target.value);
                if (error) setError("");
              }}
              className="w-32"
            />
          </Field>
        </div>
        <SaveRow busy={busy} saved={saved} error={error} onSave={saveForwarding} />

        <SubHead>Allowed senders</SubHead>
        <SendersTable senders={senders} onChanged={() => router.refresh()} />
      </section>
    </div>
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
  const [deleting, setDeleting] = useState<InboundSender[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [fEnabled, setFEnabled] = useState<"all" | "enabled" | "disabled">("all");
  const [fReader, setFReader] = useState<"all" | InboundParser>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return senders.filter(
      (s) =>
        (fEnabled === "all" || s.enabled === (fEnabled === "enabled")) &&
        (fReader === "all" || s.parser === fReader) &&
        (!q || s.match.includes(q) || s.signingDomain.includes(q)),
    );
  }, [senders, query, fEnabled, fReader]);
  const selection = useRowSelection(filtered.map((s) => s.id));
  const paging = usePagination(filtered, `${query}|${fEnabled}|${fReader}`);
  const chosen = filtered.filter((s) => selection.isSelected(s.id));
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

  /** One change per sender; stops reporting after the first refusal. */
  async function runEach(list: InboundSender[], fn: (s: InboundSender) => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    setError("");
    let firstError = "";
    for (const s of list) {
      const res = await fn(s);
      if (!res.ok) firstError ||= res.error ?? "Couldn't save.";
    }
    setPending(false);
    if (firstError) setError(firstError);
    selection.clear();
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sender or domain"
            aria-label="Search senders"
            className="h-9 pl-8"
          />
        </div>
        <select className={tableSelectCls} value={fEnabled} onChange={(e) => setFEnabled(e.target.value as typeof fEnabled)} aria-label="Filter status">
          <option value="all">All statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select className={tableSelectCls} value={fReader} onChange={(e) => setFReader(e.target.value as typeof fReader)} aria-label="Filter reader">
          <option value="all">All readers</option>
          {(Object.keys(PARSER_LABELS) as InboundParser[]).map((p) => (
            <option key={p} value={p}>
              {PARSER_LABELS[p]}
            </option>
          ))}
        </select>
        <Button variant="outline" className="ml-auto min-h-9" onClick={() => openForm("new")}>
          <Plus className="size-4" aria-hidden />
          Add sender
        </Button>
      </div>

      <BulkBar selection={selection}>
        <Button variant="outline" size="sm" disabled={pending || !chosen.some((s) => !s.enabled)} onClick={() => runEach(chosen.filter((s) => !s.enabled), (s) => setSenderEnabledAction(s.id, true))}>
          <Power className="size-4" /> Enable
        </Button>
        <Button variant="outline" size="sm" disabled={pending || !chosen.some((s) => s.enabled)} onClick={() => runEach(chosen.filter((s) => s.enabled), (s) => setSenderEnabledAction(s.id, false))}>
          <Power className="size-4" /> Disable
        </Button>
        <Button variant="destructive" size="sm" disabled={pending} onClick={() => setDeleting(chosen)}>
          <Trash2 className="size-4" /> Remove
        </Button>
      </BulkBar>

      <TableBox minWidth={720}>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5">
              <SelectAllCheckbox selection={selection} />
            </th>
            <th className="px-3 py-2.5 font-medium">Sender</th>
            <th className="px-3 py-2.5 font-medium">Signed by</th>
            <th className="px-3 py-2.5 font-medium">Reader</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="w-20 px-3 py-2.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paging.paged.map((s) => (
            <tr key={s.id} className={selection.isSelected(s.id) ? "bg-primary/5" : "hover:bg-muted/40"}>
              <td className="px-3 py-3">
                <RowCheckbox selection={selection} id={s.id} label={s.match} />
              </td>
              <td className="px-3 py-2.5 font-mono text-[12px] break-all">{s.match}</td>
              <td className="px-3 py-2.5 font-mono text-[12px]">{s.signingDomain}</td>
              <td className="px-3 py-2.5 text-xs">
                {s.parser === "none" ? <Badge variant="warning">No reader yet</Badge> : PARSER_LABELS[s.parser]}
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={s.enabled ? "success" : "neutral"}>{s.enabled ? "Enabled" : "Disabled"}</Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <RowMenu label={s.match}>
                  <DropdownMenuItem onClick={() => openForm(s)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const err = await run(() => setSenderEnabledAction(s.id, !s.enabled));
                      if (err) setError(err);
                    }}
                  >
                    <Power /> {s.enabled ? "Disable" : "Enable"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={() => setDeleting([s])}>
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                </RowMenu>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {senders.length === 0 ? "No senders yet." : "No senders match these filters."}
              </td>
            </tr>
          )}
        </tbody>
      </TableBox>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-muted-foreground">{enabledCount} enabled</span>
      </div>
      <TablePagination paging={paging} />

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
        title={deleting?.length === 1 ? `Remove ${deleting[0].match}?` : `Remove ${deleting?.length ?? 0} senders?`}
        description="Emails from these senders will be rejected from now on. Leads already created stay."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          const list = deleting ?? [];
          setDeleting(null);
          if (list.length) await runEach(list, (d) => deleteSenderAction(d.id));
        }}
      />
    </div>
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
