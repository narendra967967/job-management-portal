"use client";

// Settings → Email forwarding (user side). The user forwards job-alert emails
// from Gmail to a private Jobtiva address; this card shows the address, walks
// through Gmail's one-time setup, shows Gmail's confirmation (link or code) when it
// arrives, and reports whether alerts are coming in. Spec: docs/email-forwarding.md
// (U1–U5, U8). While setup is under way it polls for progress, so Gmail's code
// shows up within seconds without a reload.
//
// Layout: the three setup steps are an accordion with the full instructions —
// the current step opens by itself, finished ones turn green. Short side notes
// sit behind InfoTips.

import { useEffect, useState } from "react";
import { Check, ChevronRight, Copy, ExternalLink, Mail, MailCheck, RotateCcw, ShieldCheck, Briefcase } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import {
  FORWARDING_STAGE_LABELS,
  GMAIL_FILTER_FROM,
  forwardingStage,
  timeAgo,
  type ForwardingStage,
} from "@/lib/email-intake-model";
import { setForwardingState, useIntake } from "@/lib/mock-store";
import {
  confirmMyForwardingAction,
  getMyForwardingAction,
  resetMyForwardingAction,
} from "@/actions/email-intake";

const STAGE_PILL: Record<ForwardingStage, string> = {
  not_started: "bg-muted text-muted-foreground",
  code_received: "bg-status-shortlisted text-status-shortlisted-foreground",
  waiting_first_alert: "bg-status-shortlisted text-status-shortlisted-foreground",
  working: "bg-status-applied text-status-applied-foreground",
};

/** Poll cadence by stage: fast while Gmail's code is expected, slower while
 *  waiting for the first alert, none once it works. */
const POLL_MS: Record<ForwardingStage, number | null> = {
  not_started: 5_000,
  code_received: 5_000,
  waiting_first_alert: 20_000,
  working: null,
};
const POLL_FOR_MS = 15 * 60_000; // per visit; reopening the tab starts again

/** The setup step the user is on (1–3), or 4 once everything is done. */
const CURRENT_STEP: Record<ForwardingStage, number> = {
  not_started: 1,
  code_received: 2,
  waiting_first_alert: 3,
  working: 4,
};

export function EmailForwardingCard() {
  const { forwardingEnabled, forwarding: fwd } = useIntake();
  const stage = forwardingStage(fwd);
  const current = CURRENT_STEP[stage];
  const mounted = useMounted(); // relative times use the clock → client-only
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  // Accordion: one step open at a time — the current one, until the user picks another.
  const [openStep, setOpenStep] = useState<number | null>(current <= 3 ? current : null);
  useEffect(() => {
    setOpenStep(current <= 3 ? current : null);
  }, [current]);
  const stepProps = (n: number) => ({
    n,
    current,
    open: openStep === n,
    onToggle: () => setOpenStep((o) => (o === n ? null : n)),
  });

  const pollMs = forwardingEnabled ? POLL_MS[stage] : null;
  useEffect(() => {
    if (!pollMs) return;
    let stopped = false;
    const until = Date.now() + POLL_FOR_MS;
    const timer = setInterval(async () => {
      if (Date.now() > until) return clearInterval(timer); // idle tab: stop asking
      if (document.hidden) return;
      try {
        const next = await getMyForwardingAction();
        if (!stopped) setForwardingState(next);
      } catch {
        // Transient — the next tick retries.
      }
    }, pollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  async function markVerified() {
    setBusy(true);
    try {
      setForwardingState(await confirmMyForwardingAction());
      toast.success("Gmail forwarding confirmed", "Now create the filter in step 3.");
    } catch {
      toast.error("Couldn't save that", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetAddress() {
    const ok = await confirm({
      title: "Reset your forwarding address?",
      description:
        "Your current address stops working immediately. You'll need to add the new address in Gmail and update your filter.",
      confirmLabel: "Reset address",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      setForwardingState(await resetMyForwardingAction());
      toast.success("New address created", "Add it in Gmail and update your filter.");
    } catch {
      toast.error("Couldn't reset your address", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!forwardingEnabled) {
    return (
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-sm font-medium">Email forwarding</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Turned off by the administrator. You can still add leads by hand or with Add with AI.
        </p>
      </section>
    );
  }

  // Full instructions in an accordion (one step open at a time): the current
  // step opens by itself, finished steps turn green.
  const steps = (
    <div className="space-y-2">
      <Step {...stepProps(1)} title="Add your address in Gmail">
        In Gmail, open <b>Settings</b> (gear icon) → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b>{" "}
        → <b>Add a forwarding address</b>, paste your address and click <b>Next</b> → <b>Proceed</b>.
      </Step>
      <Step {...stepProps(2)} title="Confirm it">
        Gmail sends a confirmation to your Jobtiva address — a <b>Confirm forwarding</b> button appears{" "}
        <b>at the top of this card</b> within a few seconds. Click it to approve. Leave the forwarding option
        itself on <b>Disable forwarding</b>; the filter below forwards only job alerts.
      </Step>
      <Step {...stepProps(3)} title="Create a filter for job alerts">
        In Gmail&rsquo;s search bar, click <b>Show search options</b>. In <b>From</b>, paste:
        <span className="mt-2 flex items-stretch gap-2">
          <code className="min-w-0 flex-1 rounded-lg bg-muted/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed break-all text-foreground">
            {GMAIL_FILTER_FROM}
          </code>
          <CopyButton value={GMAIL_FILTER_FROM} label="Copy" iconOnly />
        </span>
        <span className="mt-2 block">
          Click <b>Create filter</b>, tick <b>Forward it to</b>, choose your Jobtiva address, then{" "}
          <b>Create filter</b>. Gmail keeps the original email in your inbox.
        </span>
      </Step>
    </div>
  );

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Email forwarding</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Your LinkedIn job alerts, straight into Leads.</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", STAGE_PILL[stage])}>
          {FORWARDING_STAGE_LABELS[stage]}
        </span>
      </div>

      {/* U1 — the address */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          Your address
          <InfoTip label="About your address">
            Private to you. Anything an allowed job site sends here becomes a lead in your account.
          </InfoTip>
        </div>
        <div className="mt-1.5 flex items-stretch gap-2">
          <code className="flex min-w-0 flex-1 items-center truncate rounded-lg bg-muted/60 px-3 py-2.5 font-mono text-[13px] sm:text-sm">
            {fwd.address}
          </code>
          <CopyButton value={fwd.address} label="Copy address" />
        </div>
      </div>

      {/* U4 — status */}
      {stage === "working" && fwd.lastReceivedAt && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-status-applied/50 px-3 py-2.5 text-xs text-status-applied-foreground">
          <MailCheck className="size-4 shrink-0" aria-hidden />
          Job alerts are arriving{mounted ? ` · last one ${timeAgo(fwd.lastReceivedAt)}` : ""}
        </p>
      )}
      {stage === "waiting_first_alert" && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          <MailCheck className="size-4 shrink-0" aria-hidden />
          Gmail is connected. Your next LinkedIn alert lands in Leads.
        </p>
      )}

      {/* U3 — Gmail's confirmation: a link (current Gmail) or a code (older format) */}
      {stage === "code_received" && (
        <div className="mt-4 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Approve forwarding</p>
            <InfoTip label="Who asked">Only approve if it&rsquo;s your own Gmail account.</InfoTip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {fwd.gmailConfirmFrom ? (
              <>
                From <span className="font-medium text-foreground">{fwd.gmailConfirmFrom}</span>
              </>
            ) : (
              "From Gmail"
            )}
            {mounted && fwd.gmailCodeAt ? ` · ${timeAgo(fwd.gmailCodeAt)}` : ""}
          </p>
          {fwd.gmailCode && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-semibold tracking-widest">{fwd.gmailCode}</span>
              <CopyButton value={fwd.gmailCode} label="Copy code" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {fwd.gmailConfirmUrl && (
              <a
                href={fwd.gmailConfirmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "min-h-10 gap-1.5")}
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Confirm forwarding
              </a>
            )}
            {fwd.gmailConfirmText && (
              <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)} className="min-h-10 gap-1.5">
                <Mail className="size-3.5" aria-hidden />
                View email
              </Button>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-primary/10 pt-3">
            <Button variant="ghost" size="sm" onClick={markVerified} disabled={busy} className="-ml-2 min-h-10 gap-1.5">
              <Check className="size-3.5" aria-hidden />
              I&rsquo;ve confirmed it
            </Button>
            <InfoTip label="When to click this">
              {fwd.gmailConfirmUrl || fwd.gmailConfirmText
                ? "Click once Google's page says the request is confirmed."
                : "Paste the code into Gmail and click Verify, then come back here."}
            </InfoTip>
          </div>
        </div>
      )}

      {/* U2 — setup guide */}
      <p className="mt-5 mb-2 text-xs font-medium text-muted-foreground">Set up in Gmail · once, about 2 minutes</p>
      {steps}

      {/* U8 + privacy + U5 — one quiet row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-xs">
        <InfoTip
          trigger={
            <>
              <ShieldCheck className="size-3.5" aria-hidden /> Private by design
            </>
          }
        >
          Jobtiva never accesses your mailbox. It only sees what you forward, accepts it only from allowed job
          sites, and keeps just the job details.
        </InfoTip>
        <InfoTip
          trigger={
            <>
              <Briefcase className="size-3.5" aria-hidden /> Work or school account?
            </>
          }
        >
          Some organisations block automatic forwarding. Forward an alert by hand to your address, or use Add
          with AI on the Leads page.
        </InfoTip>
        <span className="ml-auto inline-flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={resetAddress} disabled={busy} className="min-h-10 gap-1.5 text-muted-foreground">
            <RotateCcw className="size-3.5" aria-hidden />
            Reset address
          </Button>
          <InfoTip label="About resetting">
            Use this if your address was shared by mistake. The old one stops working immediately.
          </InfoTip>
        </span>
      </div>

      {dialog}
      {/* Always mounted; open toggles (see the admin senders dialog). */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gmail&rsquo;s confirmation email</DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            Click the link that confirms the request, not the one that cancels it.
          </p>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
            <LinkifiedGoogleText text={fwd.gmailConfirmText ?? ""} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Plain text with only https Google links made clickable (new tab, no referrer). */
function LinkifiedGoogleText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"')]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        let ok = false;
        try {
          const u = new URL(part);
          ok = u.protocol === "https:" && (u.hostname === "google.com" || u.hostname.endsWith(".google.com"));
        } catch {
          ok = false;
        }
        return ok ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline break-all">
            {part}
          </a>
        ) : (
          <span key={i} className="break-all">
            {part}
          </span>
        );
      })}
    </>
  );
}

/** One accordion step, opened/closed by the parent (one open at a time).
 *  Done = green with a tick. */
function Step({
  n,
  current,
  open,
  onToggle,
  title,
  children,
}: {
  n: number;
  current: number;
  open: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const done = n < current;
  const active = n === current;
  const panelId = `fwd-step-${n}`;

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        done && "border-status-applied-foreground/25 bg-status-applied/30",
        active && "border-primary/30 bg-primary/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            done && "bg-status-applied-foreground text-white",
            active && "bg-primary text-primary-foreground",
            !done && !active && "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {done ? <Check className="size-3.5" /> : n}
        </span>
        <span className={cn("min-w-0 flex-1 text-sm font-medium", !done && !active && "text-muted-foreground")}>
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </span>
        {done && <span className="text-[11px] font-medium text-status-applied-foreground">Done</span>}
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={panelId}
          className="px-3 pb-3 pl-12 text-xs leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CopyButton({ value, label, iconOnly = false }: { value: string; label: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy", "Select the text and copy it manually.");
    }
  }
  const icon = copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn("min-h-10 shrink-0 gap-1.5", iconOnly ? "w-10 px-0" : "w-10 px-0 sm:w-auto sm:px-3")}
    >
      {icon}
      {/* Phones: icon only, so the address keeps the room. */}
      {!iconOnly && <span className="hidden sm:inline">{copied ? "Copied" : label}</span>}
    </Button>
  );
}
