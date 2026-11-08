"use client";

// Limited mode: the user's plan has expired. They can still sign in, but every
// menu is locked except Upgrade Plan, Help & support and Account (spec: memory
// payments-plan). The server enforces it (dashboard layout redirects + feature
// actions refuse); this context only drives the UI. The layout sets it from
// the real plan expiry, and a payment refreshes the layout.

import { createContext, useContext } from "react";

const LimitedModeContext = createContext(false);

export function LimitedModeProvider({ limited, children }: { limited: boolean; children: React.ReactNode }) {
  return <LimitedModeContext.Provider value={limited}>{children}</LimitedModeContext.Provider>;
}

export function useLimitedMode(): boolean {
  return useContext(LimitedModeContext);
}
