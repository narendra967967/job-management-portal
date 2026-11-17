import type { Metadata } from "next";
import { HistoryComingSoon } from "@/components/mock-interviews/coming-soon";
import { HistoryTable } from "@/components/mock-interviews/history-table";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { listInterviews } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "Interview history" };
export const dynamic = "force-dynamic";

export default async function InterviewHistoryPage() {
  if (!(await candidateAiOpen())) return <HistoryComingSoon />;
  return <HistoryTable interviews={await listInterviews(await getCurrentUserId())} />;
}
