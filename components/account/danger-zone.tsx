"use client";

// Settings → Account → Danger zone.
//  - "Reset leads": modal 1 explains what the reset is for and exactly what
//    goes / stays (live counts + CSV backup); modal 2 asks for RESET and an
//    emailed code, then runs the reset (actions/account-reset.ts).
//  - "Delete account": a request (support ticket) confirmed by an emailed code;
//    the admin deletes the account. Cancellable until then
//    (actions/account-deletion.ts).

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, Loader2, MailCheck, RotateCcw, Trash2, TriangleAlert, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  cancelDeletionRequestAction,
  getDeletionRequestAction,
  requestDeletionAction,
  sendDeletionCodeAction,
  type DeletionRequestState,
} from "@/actions/account-deletion";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/lib/mock-store";
import {
  exportLeadsCsvAction,
  getResetSummaryAction,
  resetLeadsAction,
  sendResetCodeAction,
  type ResetSummary,
} from "@/actions/account-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DangerZoneCard() {
  const [explainOpen, setExplainOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-destructive/30 bg-card p-4 md:p-5">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <TriangleAlert className="size-4" aria-hidden />
        Danger zone
      </h2>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-white/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Reset leads</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently delete all your leads and start a fresh job search.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setExplainOpen(true)} className="shrink-0">
          <RotateCcw className="size-4" aria-hidden />
          Reset leads…
        </Button>
      </div>

      <DeleteAccountRow />

      <ResetExplainDialog
        open={explainOpen}
        onOpenChange={setExplainOpen}
        onContinue={() => {
          setExplainOpen(false);
          setConfirmOpen(true);
        }}
      />
      <ResetConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} />
    </section>
  );
}

/* ---------------- modal 1: what it is, when to use it ---------------- */

function ResetExplainDialog({
  open,
  onOpenChange,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onContinue: () => void;
}) {
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSummary(null);
    getResetSummaryAction()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [open]);

  async function download() {
    setDownloading(true);
    try {
      const { filename, csv } = await exportLeadsCsvAction();
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed", "Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const n = (v: number | undefined) => (summary ? String(v) : "…");
  const goes = [
    `${n(summary?.leads)} leads — with their job descriptions, AI summaries, salary insights and fit scores`,
    `${n(summary?.contacts)} contacts`,
    `${n(summary?.outreach)} outreach drafts and messages`,
    `${n(summary?.reminders)} reminders and ${n(summary?.tasks)} to-dos`,
    "Auto-cleanup history and lead notifications",
  ];
  const stays = [
    "Your account, login and plan",
    "Profile and career profile",
    "Résumés and their ATS scores",
    "Settings, AI key and prompts",
    "Email forwarding and Gmail connection",
    "Personal notes and support tickets",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset all your leads?</DialogTitle>
          <DialogDescription>
            This deletes every lead and everything attached to it — for good. It&apos;s a clean slate
            for a new job search. It can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium">When it makes sense</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>You&apos;re starting a new job search after a break or a new job.</li>
              <li>You&apos;re switching to a different role or career track.</li>
              <li>Your board is full of old leads you&apos;ll never act on.</li>
            </ul>
            <h3 className="mt-3 font-medium">When it doesn&apos;t</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>To tidy up a few leads — archive or delete those instead.</li>
              <li>If you may need the history later — download a backup first.</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3">
              <h3 className="text-xs font-semibold text-destructive">Deleted for good</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {goes.map((g) => (
                  <li key={g} className="flex gap-1.5">
                    <XCircle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-white/50 p-3">
              <h3 className="text-xs font-semibold text-status-applied-foreground">Stays as it is</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {stays.map((s) => (
                  <li key={s} className="flex gap-1.5">
                    <CheckCircle2 className="mt-px size-3.5 shrink-0 text-status-applied-foreground" aria-hidden />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Job alerts you&apos;ve already received won&apos;t come back. New alerts keep arriving as fresh leads.
          </p>

          <Button variant="outline" onClick={download} disabled={downloading || summary?.leads === 0} className="w-full bg-white/50 sm:w-auto">
            {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Download my leads (CSV)
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onContinue} disabled={summary?.leads === 0}>
            {summary?.leads === 0 ? "No leads to reset" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- modal 2: RESET + emailed code ---------------- */

function ResetConfirmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { email } = useProfile();
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setSent(false);
    setCode("");
    setError("");
    setCooldown(0);
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError("");
    const res = await sendResetCodeAction(typed).catch(() => ({ ok: false as const, error: "Couldn't send the code. Try again." }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
    setCode("");
    setCooldown(60);
  }

  async function reset() {
    setBusy(true);
    setError("");
    const res = await resetLeadsAction(code).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    toast.success("Your leads have been reset", `${res.deleted} ${res.deleted === 1 ? "lead" : "leads"} deleted.`);
    // Full reload so every screen starts from the empty workspace.
    setTimeout(() => window.location.assign("/leads"), 900);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm reset</DialogTitle>
          <DialogDescription>
            {sent ? (
              <>
                We emailed a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
              </>
            ) : (
              "Type RESET, then we'll email you a code to confirm it's really you."
            )}
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Type RESET to confirm</span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-11 sm:h-9"
              placeholder="RESET"
            />
          </label>
        ) : (
          <div className="space-y-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Code from the email</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-11 text-center text-lg tracking-[0.4em] tabular-nums sm:h-10"
                placeholder="••••••"
                aria-describedby="reset-code-help"
              />
            </label>
            <p id="reset-code-help" className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MailCheck className="size-3.5" aria-hidden />
                Check spam if it hasn&apos;t arrived.
              </span>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown > 0 || busy}
                className="inline-flex min-h-11 items-center font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline sm:min-h-0"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {!sent ? (
            <Button variant="destructive" onClick={sendCode} disabled={typed !== "RESET" || busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Send code
            </Button>
          ) : (
            <Button variant="destructive" onClick={reset} disabled={code.length !== 6 || busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? "Resetting…" : "Reset my leads"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- delete account (request) ---------------- */

function DeleteAccountRow() {
  const [state, setState] = useState<DeletionRequestState | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const load = () =>
    getDeletionRequestAction()
      .then(setState)
      .catch(() => setState(null));
  useEffect(() => {
    void load();
  }, []);

  async function cancel() {
    const ok = await confirm({
      title: "Cancel your deletion request?",
      description: "Your account stays as it is. You can ask again any time.",
      confirmLabel: "Cancel request",
    });
    if (!ok) return;
    setBusy(true);
    const res = await cancelDeletionRequestAction().catch(() => ({ ok: false as const, error: "Something went wrong." }));
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't cancel", res.error);
    toast.success("Deletion request cancelled");
    void load();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border bg-white/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">Delete account</p>
        {state ? (
          <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Clock className="mt-px size-3.5 shrink-0 text-status-shortlisted-foreground" aria-hidden />
            <span>
              Deletion requested on {formatDateTime(state.requestedAt)} ({state.ref}). We&apos;ll email you when it&apos;s done.
            </span>
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Ask us to permanently delete your account and all its data.</p>
        )}
      </div>
      {state === undefined ? (
        <div className="h-11 w-40 animate-pulse rounded-lg bg-muted/40 sm:h-8" aria-hidden />
      ) : state ? (
        <Button variant="outline" onClick={cancel} disabled={busy} className="shrink-0 bg-white/50">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Cancel request
        </Button>
      ) : (
        <Button variant="destructive" onClick={() => setOpen(true)} className="shrink-0">
          <Trash2 className="size-4" aria-hidden />
          Request deletion…
        </Button>
      )}
      <DeleteAccountDialog
        open={open}
        onOpenChange={setOpen}
        onDone={() => {
          setOpen(false);
          void load();
        }}
      />
      {dialog}
    </div>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { email } = useProfile();
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setUnderstood(false);
    setSent(false);
    setCode("");
    setError("");
    setCooldown(0);
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError("");
    const res = await sendDeletionCodeAction().catch(() => ({ ok: false as const, error: "Couldn't send the code. Try again." }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSent(true);
    setCode("");
    setCooldown(60);
  }

  async function submit() {
    setBusy(true);
    setError("");
    const res = await requestDeletionAction(code, reason).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success("Deletion request sent", "We'll email you when your account has been deleted.");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request account deletion?</DialogTitle>
          <DialogDescription>
            We&apos;ll permanently delete your account and everything in it. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <div className="space-y-4 text-sm">
            <ul className="space-y-1.5 text-xs">
              {[
                "All leads, contacts, outreach, reminders and to-dos",
                "Résumés, profile and career profile",
                "Settings, AI key, email forwarding address and Gmail connection",
                "Your login — you won't be able to sign in again",
              ].map((g) => (
                <li key={g} className="flex gap-1.5">
                  <XCircle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
            <div className="rounded-xl border bg-white/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Before you go</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                <li>Only want a clean start? Use Reset leads instead — your account stays.</li>
                <li>Want to keep your leads? Download them first from Reset leads.</li>
                <li>Your request goes to our team; you can keep using your account and cancel until it&apos;s done.</li>
              </ul>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Why are you leaving? (optional)</span>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 1000))} rows={3} placeholder="Anything we could do better?" />
            </label>
            <label className="flex min-h-11 items-start gap-2.5 text-sm sm:min-h-0">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-destructive"
              />
              I understand my account and all its data will be deleted for good.
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We emailed a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
            </p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Code from the email</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-11 text-center text-lg tracking-[0.4em] tabular-nums sm:h-10"
                placeholder="••••••"
              />
            </label>
            <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MailCheck className="size-3.5" aria-hidden />
                Check spam if it hasn&apos;t arrived.
              </span>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown > 0 || busy}
                className="inline-flex min-h-11 items-center font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline sm:min-h-0"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {!sent ? (
            <Button variant="destructive" onClick={sendCode} disabled={!understood || busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Send code
            </Button>
          ) : (
            <Button variant="destructive" onClick={submit} disabled={code.length !== 6 || busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? "Sending…" : "Send deletion request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
