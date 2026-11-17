import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryComingSoon } from "@/components/mock-interviews/coming-soon";
import { ReportView } from "@/components/mock-interviews/report-view";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { sampleInterview } from "@/lib/mock-interviews/sample-data";

export const metadata: Metadata = { title: "Interview report" };

export default async function InterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!SHOW_SAMPLE_SCREENS) return <HistoryComingSoon />;
  const interview = sampleInterview((await params).id);
  if (!interview || interview.status === "interrupted" || interview.status === "in_progress") notFound();
  return <ReportView interview={interview} />;
}
