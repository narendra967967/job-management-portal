import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { InterviewChat, type ChatState } from "@/components/mock-interviews/interview-chat";
import { getCurrentUserId } from "@/lib/current-user";
import { candidateAiOpen } from "@/lib/mock-interviews/config";
import { getSession } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "AI interview" };
export const dynamic = "force-dynamic";

const STATES: ChatState[] = ["live", "wrapup", "ended"];

export default async function AiInterviewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  if (!(await candidateAiOpen())) return <AiComingSoon />;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await getSession(await getCurrentUserId(), id);
  if (!session) notFound();
  const state = STATES.includes(sp.state as ChatState) ? (sp.state as ChatState) : "live";
  return <InterviewChat session={session} state={state} />;
}
