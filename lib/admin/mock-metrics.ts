// Mock metrics for the admin dashboard charts (UI-first). Plan/status mixes are
// derived from MOCK_USERS so the numbers stay consistent with the Users screen;
// the time series are static placeholders until real DB aggregates are wired in.

import { MOCK_USERS, PLAN_LABELS, type AdminPlan } from "@/lib/admin/mock-users";
import type { Point } from "@/components/admin/ui/charts";

// New users added per month (last 6 months).
export const NEW_USERS_OVER_TIME: Point[] = [
  { label: "Apr", value: 1 },
  { label: "May", value: 2 },
  { label: "Jun", value: 1 },
  { label: "Jul", value: 1 },
  { label: "Aug", value: 3 },
  { label: "Sep", value: 6 },
];

// AI calls per week (last 8 weeks).
export const AI_CALLS_OVER_TIME: Point[] = [
  { label: "Jul 27", value: 8 },
  { label: "Aug 3", value: 12 },
  { label: "Aug 10", value: 9 },
  { label: "Aug 17", value: 17 },
  { label: "Aug 24", value: 14 },
  { label: "Aug 31", value: 21 },
  { label: "Sep 7", value: 19 },
  { label: "Sep 14", value: 26 },
];

// Distribution of users across subscription plans (derived).
export const PLAN_MIX: Point[] = (
  Object.keys(PLAN_LABELS) as AdminPlan[]
)
  .map((plan) => ({
    label: PLAN_LABELS[plan],
    value: MOCK_USERS.filter((u) => u.plan === plan).length,
  }))
  .filter((p) => p.value > 0);

// Active vs inactive users (derived).
export const STATUS_MIX: Point[] = [
  {
    label: "Active",
    value: MOCK_USERS.filter((u) => u.status === "active").length,
  },
  {
    label: "Inactive",
    value: MOCK_USERS.filter((u) => u.status === "inactive").length,
  },
];
