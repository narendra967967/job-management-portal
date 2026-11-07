"use client";

// Renders its children only outside limited mode (plan ended), so the server
// layout can hide the working tools (search, add lead, notes, …) without
// becoming a client component.

import { useLimitedMode } from "@/lib/access-mode";

export function NotLimited({ children }: { children: React.ReactNode }) {
  return useLimitedMode() ? null : <>{children}</>;
}
