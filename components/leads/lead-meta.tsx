"use client";

// Small pieces shared by the list card, the board card and the lead detail:
//  - LeadCardMenu: the card's "⋯" menu (Top Choice toggle + open the posting)
//  - SourceChip:   where the job came from + whether it was added by the system
//  - TopChoiceStar / TOP_CHOICE_CARD: the Top Choice marker + golden glow
//  - TopChoiceToggle: the star beside the title on an opened job
//  - AutoActionNote: why the system moved this lead, with Undo
//  - STALE_CARD / StaleChip: the red border and chip as a lead nears stale

import { useState } from "react";
import { Bot, ExternalLink, Hourglass, Lock, MoreHorizontal, PenLine, Star, Wallet } from "lucide-react";
import {
  currentAutoAction,
  LEAD_ORIGIN_LABELS,
  LEAD_SOURCE_LABELS,
  type JobLead,
  type StaleLevel,
  type StaleWarning,
} from "@/lib/types";
import { setLeadTopChoice, undoAutoAction, useAutoActions, useFeatures } from "@/lib/mock-store";
import { SalaryInsightDialog } from "@/components/leads/salary-insight";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Card classes for a Top Choice lead: golden border + soft glow (see globals.css). */
export const TOP_CHOICE_CARD = "top-choice-glow border-top-choice/70";

/** Card border as a lead nears stale, light to strong orange (amber is taken by
 *  Shortlisted, Due and Top Choice; red means errors). Replaces the Top Choice
 *  glow while it shows (the star stays). */
export const STALE_CARD: Record<StaleLevel, string> = {
  1: "border-orange-400/45",
  2: "border-orange-500/70",
  3: "border-orange-500 ring-1 ring-orange-500/40",
  4: "border-orange-600 ring-2 ring-orange-500/60",
};

/** "Stale in 3 days" from the 70% step; earlier steps are border only, with
 *  the same words for screen readers. */
export function StaleChip({ warning, className }: { warning: StaleWarning; className?: string }) {
  const text = warning.daysLeft <= 1 ? "Stale tomorrow" : `Stale in ${warning.daysLeft} days`;
  if (warning.level < 3) return <span className="sr-only">{text}</span>;
  return (
    <span
      title={`No activity for ${warning.quietDays} days. Any update keeps it on your board.`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300",
        className,
      )}
    >
      <Hourglass className="size-3" aria-hidden />
      {text}
    </span>
  );
}

/** Asked before a card's discard icon cancels follow-ups, which Undo can't restore. */
export const discardWithFollowUpsConfirm = (title: string) => ({
  title: "Discard this lead?",
  description: `"${title}" moves to Archive and its pending follow-ups are canceled. You can reopen it later.`,
  confirmLabel: "Discard",
  destructive: true,
});

/** "Open on LinkedIn Jobs" / "Open job posting" — names the platform when known. */
export function openPostingLabel(lead: Pick<JobLead, "source">): string {
  return lead.source === "other"
    ? "Open job posting"
    : `Open on ${LEAD_SOURCE_LABELS[lead.source]}`;
}

/** The "⋯" menu on a lead card. Stops clicks/drags from reaching the card. */
export function LeadCardMenu({
  lead,
  className,
}: {
  lead: JobLead;
  className?: string;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const { salaryInsight: hasSalary } = useFeatures();
  const [salaryOpen, setSalaryOpen] = useState(false);
  return (
    // Events from the portalled menu still bubble through the React tree, so
    // this wrapper keeps them from opening the card (click) or dragging it.
    <span onClick={stop} onPointerDown={stop} onKeyDown={stop} className="inline-flex">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More actions for ${lead.title}`}
          title="More actions"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-9",
            className,
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{lead.title}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <TopChoiceMenuItem lead={lead} />
          <DropdownMenuItem onClick={() => setSalaryOpen(true)}>
            <Wallet className="size-4" aria-hidden />
            Salary insight
            {!hasSalary && <Lock className="ml-auto size-3.5 opacity-60" aria-label="Not on your plan" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => window.open(lead.canonicalJobUrl, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" aria-hidden />
            {openPostingLabel(lead)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {salaryOpen && <SalaryInsightDialog lead={lead} onClose={() => setSalaryOpen(false)} />}
    </span>
  );
}

/** Menu item that toggles Top Choice. */
export function TopChoiceMenuItem({ lead }: { lead: JobLead }) {
  return (
    <DropdownMenuItem onClick={() => setLeadTopChoice(lead.id, !lead.topChoice)}>
      <Star
        className={cn("size-4", lead.topChoice && "fill-top-choice text-top-choice")}
        aria-hidden
      />
      {lead.topChoice ? "Remove Top Choice" : "Mark as Top Choice"}
    </DropdownMenuItem>
  );
}

/** Star button that toggles Top Choice from an opened job's header. */
export function TopChoiceToggle({
  leadId,
  topChoice,
  className,
}: {
  leadId: string;
  topChoice: boolean;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const label = topChoice ? "Remove Top Choice" : "Mark as Top Choice";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={topChoice}
      title={label}
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        await setLeadTopChoice(leadId, !topChoice);
        setSaving(false);
      }}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:size-9",
        className,
      )}
    >
      <Star className={cn("size-5", topChoice && "fill-top-choice text-top-choice")} aria-hidden />
    </button>
  );
}

/** Why the system moved this lead, while that still explains its status. */
export function AutoActionNote({
  lead,
  className,
}: {
  lead: Pick<JobLead, "id" | "status">;
  className?: string;
}) {
  const action = currentAutoAction(useAutoActions(), lead, Date.now());
  const [undoing, setUndoing] = useState(false);
  if (!action) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-ai-muted/60 px-2 py-1 text-[11px] leading-snug text-foreground",
        className,
      )}
    >
      <Bot className="size-3 shrink-0 text-ai" aria-hidden />
      <p className="min-w-0 flex-1">{action.reason}</p>
      {/* Stops the tap from opening the card or starting a drag. */}
      <button
        type="button"
        aria-label={`Undo: ${action.reason}`}
        disabled={undoing}
        onPointerDown={stop}
        onKeyDown={stop}
        onClick={async (e) => {
          e.stopPropagation();
          setUndoing(true);
          await undoAutoAction(action.id, action.fromStatus);
          setUndoing(false);
        }}
        className="-my-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 lg:min-h-7"
      >
        Undo
      </button>
    </div>
  );
}

/** Gold star shown on Top Choice cards. */
export function TopChoiceStar({ className }: { className?: string }) {
  return (
    <span
      title="Top Choice"
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-top-choice/15 px-1.5 py-0.5 text-[11px] font-semibold text-top-choice-foreground",
        className,
      )}
    >
      <Star className="size-3 fill-top-choice text-top-choice" aria-hidden />
      Top Choice
    </span>
  );
}

/** "LinkedIn Jobs · System" — platform + how the lead was added. */
export function SourceChip({
  lead,
  className,
}: {
  lead: Pick<JobLead, "source" | "origin">;
  className?: string;
}) {
  const OriginIcon = lead.origin === "system" ? Bot : PenLine;
  return (
    <span
      title={`${LEAD_SOURCE_LABELS[lead.source]} · ${LEAD_ORIGIN_LABELS[lead.origin]}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <OriginIcon className="size-3" aria-hidden />
      {LEAD_SOURCE_LABELS[lead.source]}
      <span aria-hidden>·</span>
      {lead.origin === "system" ? "System" : "Manual"}
    </span>
  );
}
