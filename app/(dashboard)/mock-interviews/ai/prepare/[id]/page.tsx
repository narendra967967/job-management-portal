import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { InterviewBriefing } from "@/components/mock-interviews/interview-briefing";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { getBriefing } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "Get ready" };
export const dynamic = "force-dynamic";

// The briefing before an AI interview starts or resumes (spec D13e). Only
// bookings that can start or resume have one.
export default async function PrepareInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await candidateAiOpen())) return <AiComingSoon />;
  const briefing = await getBriefing(await getCurrentUserId(), (await params).id);
  if (!briefing) notFound();
  return <InterviewBriefing data={briefing} />;
}
