import type { Metadata } from "next";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { NewInterviewForm } from "@/components/mock-interviews/new-interview-form";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { SAMPLE_ALLOWANCES } from "@/lib/mock-interviews/sample-data";

export const metadata: Metadata = { title: "New AI interview" };

export default async function NewAiInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ allowance?: string; lead?: string; edit?: string }>;
}) {
  if (!SHOW_SAMPLE_SCREENS) return <AiComingSoon />;
  const sp = await searchParams;
  const allowanceKey = sp.allowance && sp.allowance in SAMPLE_ALLOWANCES ? sp.allowance : "plan";
  return <NewInterviewForm allowance={SAMPLE_ALLOWANCES[allowanceKey]} allowanceKey={allowanceKey} leadId={sp.lead} editId={sp.edit} />;
}
