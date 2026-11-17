import type { Metadata } from "next";
import { HumanComingSoon } from "@/components/mock-interviews/coming-soon";

export const metadata: Metadata = { title: "Human interviews" };

// Human interviews arrive in Release 2 (docs/interview-prep/roadmap.md).
export default function HumanInterviewsPage() {
  return <HumanComingSoon />;
}
