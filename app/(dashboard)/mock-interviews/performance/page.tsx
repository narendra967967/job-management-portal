import type { Metadata } from "next";
import { PerformanceComingSoon } from "@/components/mock-interviews/coming-soon";
import { PerformanceView } from "@/components/mock-interviews/performance-view";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { listInterviews } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "Performance" };
export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  if (!(await candidateAiOpen())) return <PerformanceComingSoon />;
  return <PerformanceView interviews={await listInterviews(await getCurrentUserId())} />;
}
