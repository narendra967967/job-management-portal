import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { InterviewChat } from "@/components/mock-interviews/interview-chat";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { getSession } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "AI interview" };
export const dynamic = "force-dynamic";

// The live interview. A booking that hasn't started goes through its briefing
// first (D13e), which is where it starts.
export default async function AiInterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await candidateAiOpen())) return <AiComingSoon />;
  const { id } = await params;
  const session = await getSession(await getCurrentUserId(), id);
  if (session === "not_started") redirect(`/mock-interviews/ai/prepare/${id}`);
  if (!session) notFound();
  // Keyed on status and messages, so a refresh after ending shows the server's copy.
  return <InterviewChat key={`${session.status}-${session.messages.length}`} session={session} />;
}
