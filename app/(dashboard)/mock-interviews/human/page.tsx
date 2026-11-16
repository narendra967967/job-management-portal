import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { ComingSoon } from "@/components/mock-interviews/coming-soon";

export const metadata: Metadata = { title: "Human interviews" };

export default function HumanInterviewsPage() {
  return (
    <ComingSoon title="Human interviews" icon={UserRound}>
      Book a mock interview with someone who has done the job you want. Choose an interviewer by role, experience and
      price, meet on a video call, and get the same kind of scored report afterwards.
    </ComingSoon>
  );
}
