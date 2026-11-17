import type { Metadata } from "next";
import { PerformanceComingSoon } from "@/components/mock-interviews/coming-soon";
import { PerformanceView } from "@/components/mock-interviews/performance-view";
import { SHOW_SAMPLE_SCREENS } from "@/lib/mock-interviews/preview";

export const metadata: Metadata = { title: "Performance" };

export default function PerformancePage() {
  return SHOW_SAMPLE_SCREENS ? <PerformanceView /> : <PerformanceComingSoon />;
}
