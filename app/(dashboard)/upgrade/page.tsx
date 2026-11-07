// Upgrade Plan (user side). The one open menu in limited mode (plan expired):
// every paid plan, bought online when a payment gateway is on, or requested
// through support when none is. Also reachable while a plan is active.

import type { Metadata } from "next";
import { UpgradeClient } from "@/components/billing/upgrade-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Upgrade plan" };

export default function UpgradePage() {
  return <UpgradeClient />;
}
