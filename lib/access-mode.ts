"use client";

// Limited mode: the user's plan has expired. They can still sign in, but every
// menu is locked except Upgrade Plan, Help & support and Account (spec: memory
// payments-plan). The server enforces it; this hook only drives the UI.
//
// PHASE 1: driven by the sample-data preview switch. Phase 3 reads the real
// expiry from the workspace instead; nothing else needs to change.

import { useMockPayments } from "@/lib/payments-mock";

export function useLimitedMode(): boolean {
  return useMockPayments().previewLimited;
}
