import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { ComingSoon } from "@/components/mock-interviews/coming-soon";

export const metadata: Metadata = { title: "Performance" };

export default function PerformancePage() {
  return (
    <ComingSoon title="Performance" icon={TrendingUp}>
      Your scores from every mock interview in one place, so you can see which skills are getting stronger and which
      still need work.
    </ComingSoon>
  );
}
