"use client";

import { usePathname } from "next/navigation";

// Hides its children on the AI interview screen, where the floating help bubble
// would cover the answer box (Help & support stays in the menu).
export function HideDuringInterview({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/mock-interviews/ai/session/") ? null : <>{children}</>;
}
