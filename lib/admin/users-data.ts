import "server-only";

// Read side of the admin Users screen — assembled from the real DB. Mutations
// live in actions/admin-users.ts.

import { isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, plans, jobLeads, resumes, userSettings } from "@/db/schema";
import { userForwardingStatuses } from "@/lib/email-intake-data";
import type { UserForwardingStatus } from "@/lib/email-intake-model";

export type AdminUserStatus = "active" | "inactive";
export type AdminUserRole = "user" | "admin";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  /** Email confirmed: by its link, or by setting a password from an emailed one. */
  emailVerified: boolean;
  planId: string | null;
  planName: string | null;
  /** Plan accent colour key (plans.accent), for the badge. */
  planAccent: string | null;
  /** ISO date or null. */
  expiresAt: string | null;
  /** ISO datetime. */
  createdAt: string;
  /** Relative last-login string, e.g. "2h ago" or "—". */
  lastLogin: string;
  /** ISO datetime of the last sign-in, for date filters. */
  lastLoginAt: string | null;
  /** On a plan marked free (or no plan at all). */
  planFree: boolean;
  /** Has saved their own AI key (needed for every AI feature). */
  hasAiKey: boolean;
  hasResume: boolean;
  leads: number;
  /** Email forwarding progress; null until the user first opens the app. */
  forwarding: UserForwardingStatus | null;
}

export interface PlanOption {
  id: string;
  name: string;
  free: boolean;
}

function relativeTime(dt: Date | null): string {
  if (!dt) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Plans to choose from in the add/edit dialog + plan filter. */
export async function listPlanOptions(): Promise<PlanOption[]> {
  const rows = await db
    .select({ id: plans.id, name: plans.name, free: plans.isFree })
    .from(plans)
    .orderBy(plans.monthlyPrice);
  return rows;
}

/** All users for the admin grid, optionally excluding one id (the logged-in admin,
 *  so they can't accidentally deactivate/delete themselves). */
export async function listAdminUsers(excludeId?: string): Promise<AdminUserRow[]> {
  const [users, planRows, leadCounts, forwarding, aiKeys, resumeOwners] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        planId: user.planId,
        planExpiresAt: user.planExpiresAt,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      })
      .from(user)
      .where(excludeId ? ne(user.id, excludeId) : undefined)
      .orderBy(user.createdAt),
    db.select({ id: plans.id, name: plans.name, accent: plans.accent, free: plans.isFree }).from(plans),
    db
      .select({ userId: jobLeads.userId, n: sql<number>`count(*)::int` })
      .from(jobLeads)
      .groupBy(jobLeads.userId),
    userForwardingStatuses(),
    db.select({ userId: userSettings.userId }).from(userSettings).where(isNotNull(userSettings.aiKeyCiphertext)),
    db.selectDistinct({ userId: resumes.userId }).from(resumes),
  ]);
  const withAiKey = new Set(aiKeys.map((r) => r.userId));
  const withResume = new Set(resumeOwners.map((r) => r.userId));

  const planById = new Map(planRows.map((p) => [p.id, p]));
  const leadsByUser = new Map(leadCounts.map((r) => [r.userId, r.n]));

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile ?? "",
    role: (u.role as AdminUserRole) ?? "user",
    status: (u.status as AdminUserStatus) ?? "active",
    emailVerified: u.emailVerified,
    planId: u.planId,
    planName: u.planId ? (planById.get(u.planId)?.name ?? null) : null,
    planAccent: u.planId ? (planById.get(u.planId)?.accent ?? null) : null,
    expiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 10) : null,
    createdAt: new Date(u.createdAt).toISOString(),
    lastLogin: relativeTime(u.lastLoginAt ? new Date(u.lastLoginAt) : null),
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    planFree: u.planId ? (planById.get(u.planId)?.free ?? false) : true,
    hasAiKey: withAiKey.has(u.id),
    hasResume: withResume.has(u.id),
    leads: leadsByUser.get(u.id) ?? 0,
    forwarding: forwarding[u.id] ?? null,
  }));
}
