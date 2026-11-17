import type { Metadata } from "next";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { InterviewChat, type ChatState } from "@/components/mock-interviews/interview-chat";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";

export const metadata: Metadata = { title: "AI interview" };

const STATES: ChatState[] = ["live", "wrapup", "ended"];

export default async function AiInterviewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  if (!SHOW_SAMPLE_SCREENS) return <AiComingSoon />;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const state = STATES.includes(sp.state as ChatState) ? (sp.state as ChatState) : "live";
  return <InterviewChat sessionId={id} state={state} />;
}
