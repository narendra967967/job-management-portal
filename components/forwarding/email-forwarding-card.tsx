"use client";

// Settings → Email forwarding (user side). The user forwards job-alert emails
// from Gmail to a private Jobtiva address; this card shows the address, walks
// through Gmail's one-time setup, shows Gmail's confirmation code when it
// arrives, and reports whether alerts are coming in. Spec: docs/email-forwarding.md
// (U1–U5, U8). PHASE 2: driven by sample data (lib/email-intake-mock.ts).

import { useState } from "react";
import { Check, Copy, MailCheck, RotateCcw, ShieldCheck, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import {
  FORWARDING_STAGE_LABELS,
  GMAIL_FILTER_FROM,
  forwardingStage,
  timeAgo,
  type ForwardingStage,
} from "@/lib/email-intake-model";
import {
  mockMyForwarding,
  newMockToken,
  updateMockIntake,
  useMockIntake,
} from "@/lib/email-intake-mock";

const STAGE_PILL: Record<ForwardingStage, string> = {
  not_started: "bg-muted text-muted-foreground",
  code_received: "bg-status-shortlisted text-status-shortlisted-foreground",
  waiting_first_alert: "bg-status-shortlisted text-status-shortlisted-foreground",
  working: "bg-status-applied text-status-applied-foreground",
};

export function EmailForwardingCard() {
  const mock = useMockIntake();
  const fwd = mockMyForwarding(mock);
  const stage = forwardingStage(fwd);
  const mounted = useMounted(); // relative times use the clock → client-only
  const { confirm, dialog } = useConfirm();

  async function resetAddress() {
    const ok = await confirm({
      title: "Reset your forwarding address?",
      description:
        "Your current address stops working immediately. You'll need to add the new address in Gmail and update your filter.",
      confirmLabel: "Reset address",
      destructive: true,
    });
    if (!ok) return;
    updateMockIntake({ addressToken: newMockToken(), previewStage: "not_started" });
    toast.success("New address created", "Add it in Gmail and update your filter.");
  }

  if (!mock.config.forwardingEnabled) {
    return (
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h2 className="text-sm font-medium">Email forwarding</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Email forwarding is turned off by the administrator. You can still add leads by hand or with
          Add with AI.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <SampleDataBar stage={mock.previewStage} />

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Email forwarding</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Forward your LinkedIn job alerts to your private Jobtiva address and they become leads
            automatically.
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium", STAGE_PILL[stage])}>
          {FORWARDING_STAGE_LABELS[stage]}
        </span>
      </div>

      {/* U1 — the address */}
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Your forwarding address</p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-sm">
            {fwd.address}
          </code>
          <CopyButton value={fwd.address} label="Copy address" />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Private to you — anything sent here from an allowed job site becomes a lead in your account.
        </p>
      </div>

      {/* U4 — status line */}
      {stage === "working" && fwd.lastReceivedAt && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-applied-foreground/20 bg-status-applied/40 p-3">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-status-applied-foreground" aria-hidden />
          <p className="text-xs text-status-applied-foreground">
            Working — job alerts are arriving{mounted ? `. Last one ${timeAgo(fwd.lastReceivedAt)}.` : "."}
          </p>
        </div>
      )}
      {stage === "waiting_first_alert" && (
        <p className="mt-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          Gmail is set up. The next LinkedIn job alert you receive will appear in Leads within seconds —
          make sure step 3 (the filter) is done.
        </p>
      )}

      {/* U3 — Gmail's confirmation code */}
      {stage === "code_received" && fwd.gmailCode && (
        <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium text-primary">Gmail confirmation code</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-semibold tracking-widest">{fwd.gmailCode}</span>
            <CopyButton value={fwd.gmailCode} label="Copy code" />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Received{mounted && fwd.gmailCodeAt ? ` ${timeAgo(fwd.gmailCodeAt)}` : ""}. Paste it into
            Gmail (step 2 below) and click Verify.
          </p>
        </div>
      )}

      {/* U2 — setup guide */}
      <h3 className="mt-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Set up in Gmail (2 minutes, once)
      </h3>
      <ol className="mt-3 space-y-3">
        <Step n={1} done={stage !== "not_started"} title="Add your address in Gmail">
          In Gmail, open <b>Settings</b> (gear icon) → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b>{" "}
          → <b>Add a forwarding address</b>, paste your address and click <b>Next</b> → <b>Proceed</b>.
        </Step>
        <Step
          n={2}
          done={stage === "waiting_first_alert" || stage === "working"}
          title="Confirm the code"
        >
          Gmail sends a confirmation code to your Jobtiva address — it appears{" "}
          <b>at the top of this card</b> within a few seconds. Paste it into Gmail and click{" "}
          <b>Verify</b>. Leave the forwarding option itself on <b>Disable forwarding</b>; the filter below
          forwards only job alerts.
        </Step>
        <Step n={3} done={stage === "working"} title="Create a filter for job alerts">
          In Gmail&rsquo;s search bar, click <b>Show search options</b>. In <b>From</b>, paste:
          <span className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-lg border bg-muted/40 px-2.5 py-2 font-mono text-[12px] break-all">
              {GMAIL_FILTER_FROM}
            </code>
            <CopyButton value={GMAIL_FILTER_FROM} label="Copy" />
          </span>
          <span className="mt-2 block">
            Click <b>Create filter</b>, tick <b>Forward it to</b>, choose your Jobtiva address, then{" "}
            <b>Create filter</b>. Gmail keeps the original email in your inbox.
          </span>
        </Step>
      </ol>

      {/* U8 — accounts that can't auto-forward */}
      <details className="mt-5 rounded-lg border p-3 text-xs">
        <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 font-medium">
          <Briefcase className="size-4 text-muted-foreground" aria-hidden />
          Using a work or school Google account?
        </summary>
        <p className="mt-2 text-muted-foreground">
          Some organisations block automatic forwarding. If Gmail won&rsquo;t let you add the address,
          forward a job alert to it by hand (open the email → Forward → your Jobtiva address), or use{" "}
          <b>Add with AI</b> on the Leads page.
        </p>
      </details>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-ai/30 bg-ai-muted/40 p-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden />
        <p className="text-xs text-ai">
          Jobtiva never accesses your mailbox. It only sees the emails you forward, accepts them only
          from allowed job sites, and keeps just the job details.
        </p>
      </div>

      {/* U5 — reset */}
      <div className="mt-5 border-t pt-4">
        <Button variant="outline" size="sm" onClick={resetAddress} className="min-h-10 gap-1.5">
          <RotateCcw className="size-3.5" aria-hidden />
          Reset my address
        </Button>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Use this if your address was shared by mistake. The old one stops working immediately.
        </p>
      </div>
      {dialog}
    </section>
  );
}

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          done ? "bg-status-applied text-status-applied-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 text-xs leading-relaxed text-muted-foreground">
        <p className="text-sm font-medium text-foreground">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </li>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
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
  return (
    <Button variant="outline" size="sm" onClick={copy} className="min-h-10 shrink-0 gap-1.5">
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** PHASE 2 ONLY: lets reviewers step through the states. Removed in Phase 4. */
function SampleDataBar({ stage }: { stage: ForwardingStage }) {
  const stages: ForwardingStage[] = ["not_started", "code_received", "waiting_first_alert", "working"];
  return (
    <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-medium">Preview with sample data — pick a state to see it:</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {stages.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => updateMockIntake({ previewStage: s })}
            className={cn(
              "min-h-8 rounded-md border px-2 py-1 font-medium",
              s === stage ? "border-amber-600 bg-amber-200/70 dark:bg-amber-800/60" : "border-amber-300 bg-white/60 dark:bg-transparent",
            )}
          >
            {FORWARDING_STAGE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
