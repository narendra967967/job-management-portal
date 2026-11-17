import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { InterviewBriefing } from "@/components/mock-interviews/interview-briefing";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { SAMPLE_BOOKINGS } from "@/lib/mock-interviews/sample-data";

export const metadata: Metadata = { title: "Get ready" };

// The briefing before an AI interview starts or resumes (spec D13e).
export default async function PrepareInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!SHOW_SAMPLE_SCREENS) return <AiComingSoon />;
  const { id } = await params;
  const booking = SAMPLE_BOOKINGS.find((b) => b.id === id);
  // Only bookings that can start or resume have a briefing.
  if (!booking || !["ready", "in_progress", "interrupted"].includes(booking.status)) notFound();
  return <InterviewBriefing booking={booking} />;
}
