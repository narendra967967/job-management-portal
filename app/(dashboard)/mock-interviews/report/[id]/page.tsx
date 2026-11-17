import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryComingSoon } from "@/components/mock-interviews/coming-soon";
import { ReportView } from "@/components/mock-interviews/report-view";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { getReport } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "Interview report" };
export const dynamic = "force-dynamic";

export default async function InterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await candidateAiOpen())) return <HistoryComingSoon />;
  const report = await getReport(await getCurrentUserId(), (await params).id);
  if (!report) notFound();
  return <ReportView report={report} />;
}
