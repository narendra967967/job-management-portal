import type { Metadata } from "next";
import { AiComingSoon } from "@/components/mock-interviews/coming-soon";
import { AiHome } from "@/components/mock-interviews/ai-home";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";
import { SAMPLE_ALLOWANCES } from "@/lib/mock-interviews/sample-data";

export const metadata: Metadata = { title: "AI mock interviews" };

export default async function AiMockInterviewsPage({ searchParams }: { searchParams: Promise<{ allowance?: string }> }) {
  if (!SHOW_SAMPLE_SCREENS) return <AiComingSoon />;
  const key = (await searchParams).allowance ?? "plan";
  const allowanceKey = key in SAMPLE_ALLOWANCES ? key : "plan";
  return <AiHome allowance={SAMPLE_ALLOWANCES[allowanceKey]} allowanceKey={allowanceKey} />;
}
