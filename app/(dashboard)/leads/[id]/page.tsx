"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LeadDetail } from "@/components/leads/lead-detail";
import { useLead, useLeadDetail, useResumes } from "@/lib/mock-store";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const lead = useLead(id);
  const detail = useLeadDetail(id);
  const resumes = useResumes();

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Lead not found.</p>
        <Link href="/leads" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to leads
        </Link>
      </div>
    );
  }

  return <LeadDetail lead={lead} detail={detail} resumes={resumes} />;
}
