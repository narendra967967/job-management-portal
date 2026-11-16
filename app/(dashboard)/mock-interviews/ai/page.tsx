import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { ComingSoon } from "@/components/mock-interviews/coming-soon";

export const metadata: Metadata = { title: "AI mock interviews" };

export default function AiMockInterviewsPage() {
  return (
    <ComingSoon title="AI mock interviews" icon={Bot}>
      Pick the role you&apos;re going for, add your resume and the job description, and practice with an interviewer that
      asks the questions that role gets, with follow-ups when an answer is thin. You finish with a scored report
      showing what went well and what to work on.
    </ComingSoon>
  );
}
