import { redirect } from "next/navigation";
import { MOCK_INTERVIEWS_HOME } from "@/lib/nav-area";

// The Mock interviews main menu opens on AI mock interviews.
export default function MockInterviewsPage() {
  redirect(MOCK_INTERVIEWS_HOME);
}
