import type { Metadata } from "next";
import { HistoryComingSoon } from "@/components/mock-interviews/coming-soon";
import { HistoryTable } from "@/components/mock-interviews/history-table";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";

export const metadata: Metadata = { title: "Interview history" };

export default function InterviewHistoryPage() {
  return SHOW_SAMPLE_SCREENS ? <HistoryTable /> : <HistoryComingSoon />;
}
