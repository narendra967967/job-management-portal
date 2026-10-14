"use client";

// Small pieces shared by the list card, the board card and the lead detail:
//  - LeadCardMenu: the card's "⋯" menu (Top Choice toggle + open the posting)
//  - SourceChip:   where the job came from + whether it was added by the system
//  - TopChoiceStar / TOP_CHOICE_CARD: the Top Choice marker + golden glow

import { useState } from "react";
import { Bot, ExternalLink, Lock, MoreHorizontal, PenLine, Star, Wallet } from "lucide-react";
import {
  LEAD_ORIGIN_LABELS,
  LEAD_SOURCE_LABELS,
  type JobLead,
} from "@/lib/types";
import { setLeadTopChoice, useFeatures } from "@/lib/mock-store";
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
            {!hasSalary && <Lock className="ml-auto size-3.5 opacity-60" aria-label="Premium" />}
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

/** Menu item that toggles Top Choice (also used in the detail page's menu). */
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
