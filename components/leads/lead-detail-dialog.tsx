"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { JobLead, LeadStatus, Resume } from "@/lib/types";
import { getContactsForLead, getLeadDetail } from "@/lib/mock-data";
import { LeadDetailContent } from "@/components/leads/lead-detail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "View details" as a modal over the leads list. Pulls the same mock data the
 * `/leads/[id]` page uses (Phase 3 swaps these getters for Server Actions).
 * Status is controlled by the list so a change here reflects live in the grid.
 */
export function LeadDetailDialog({
  lead,
  resumes,
  status,
  onStatusChange,
  resumeId,
  open,
  onOpenChange,
}: {
  lead: JobLead | null;
  resumes: Resume[];
  status?: LeadStatus;
  onStatusChange?: (status: LeadStatus) => void;
  resumeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {lead && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="sr-only">{lead.title}</DialogTitle>
            </DialogHeader>
            <LeadDetailContent
              lead={lead}
              detail={getLeadDetail(lead.id)}
              contacts={getContactsForLead(lead.id)}
              resumes={resumes}
              status={status}
              onStatusChange={onStatusChange}
              resumeId={resumeId}
            />
            <Link
              href={`/leads/${lead.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open full page
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
