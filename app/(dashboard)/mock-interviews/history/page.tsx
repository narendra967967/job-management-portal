import type { Metadata } from "next";
import { History } from "lucide-react";
import { ComingSoon } from "@/components/mock-interviews/coming-soon";

export const metadata: Metadata = { title: "Interview history" };

export default function InterviewHistoryPage() {
  return (
    <ComingSoon title="Interview history" icon={History}>
      Every mock interview you finish, with the AI interviewer or with a person, will be listed here with its report.
    </ComingSoon>
  );
}
