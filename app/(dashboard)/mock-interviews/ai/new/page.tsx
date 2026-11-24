import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { NewInterviewForm } from "@/components/mock-interviews/new-interview-form";
import { getCurrentUserId } from "@/lib/current-user";
import { aiInterviewsOpen, getModuleSettings } from "@/lib/mock-interviews/config";
import { getAllowance, getBookingSetup } from "@/lib/mock-interviews/data";

export const metadata: Metadata = { title: "New AI interview" };
export const dynamic = "force-dynamic";

export default async function NewAiInterviewPage({ searchParams }: { searchParams: Promise<{ lead?: string; edit?: string }> }) {
  const settings = await getModuleSettings();
  if (!aiInterviewsOpen(settings)) return <AiComingSoon />;
  const [userId, sp] = await Promise.all([getCurrentUserId(), searchParams]);
  const [allowance, editing] = await Promise.all([getAllowance(userId), sp.edit ? getBookingSetup(userId, sp.edit) : null]);
  // Only a booking that hasn't started can be edited (D13c).
  if (sp.edit && !editing) notFound();
  return (
    <NewInterviewForm
      allowance={allowance}
      options={{
        categories: settings.categories,
        categoryIcons: settings.categoryIcons,
        durations: settings.durations,
        minutesPerQuestion: settings.minutesPerQuestion,
        wrapUpMinutes: settings.wrapUpMinutes,
        pricing: settings.pricing,
      }}
      leadId={sp.lead}
      editing={editing ?? undefined}
    />
  );
}
