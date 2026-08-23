import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/leads/lead-detail";
import { getLead, getLeadDetail, mockResumes } from "@/lib/mock-data";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) notFound();

  return (
    <LeadDetail
      lead={lead}
      detail={getLeadDetail(id)}
      resumes={mockResumes}
    />
  );
}
