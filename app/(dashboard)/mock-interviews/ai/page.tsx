import type { Metadata } from "next";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { AiHome } from "@/components/mock-interviews/ai-home";
import { getCurrentUserId } from "@/lib/current-user";
import { aiInterviewsOpen, getModuleSettings } from "@/lib/mock-interviews/config";
import { getAllowance, getReadiness, listBookings } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "AI mock interviews" };
export const dynamic = "force-dynamic";

export default async function AiMockInterviewsPage({ searchParams }: { searchParams: Promise<{ booked?: string }> }) {
  const settings = await getModuleSettings();
  if (!aiInterviewsOpen(settings)) return <AiComingSoon />;
  const userId = await getCurrentUserId();
  const [allowance, bookings, readiness, sp] = await Promise.all([getAllowance(userId), listBookings(userId), getReadiness(userId), searchParams]);
  return <AiHome allowance={allowance} bookings={bookings} pricing={settings.pricing} bookedId={sp.booked} readiness={readiness} />;
}
