import "server-only";

// Read side of the admin Users screen — assembled from the real DB. Mutations
// live in actions/admin-users.ts.

import { ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, plans, jobLeads, session } from "@/db/schema";

export type AdminUserStatus = "active" | "inactive";
export type AdminUserRole = "user" | "admin";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  planId: string | null;
  planName: string | null;
  /** ISO date or null. */
  expiresAt: string | null;
  /** ISO datetime. */
  createdAt: string;
  /** Relative string, e.g. "2h ago" or "—". */
  lastActive: string;
  leads: number;
}

export interface PlanOption {
  id: string;
  name: string;
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
    .select({ id: plans.id, name: plans.name })
    .from(plans)
    .orderBy(plans.monthlyPrice);
  return rows;
}

/** All users for the admin grid, optionally excluding one id (the logged-in admin,
 *  so they can't accidentally deactivate/delete themselves). */
export async function listAdminUsers(excludeId?: string): Promise<AdminUserRow[]> {
  const [users, planRows, leadCounts, lastSessions] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        planId: user.planId,
        planExpiresAt: user.planExpiresAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(excludeId ? ne(user.id, excludeId) : undefined)
      .orderBy(user.createdAt),
    db.select({ id: plans.id, name: plans.name }).from(plans),
    db
      .select({ userId: jobLeads.userId, n: sql<number>`count(*)::int` })
      .from(jobLeads)
      .groupBy(jobLeads.userId),
    db
      .select({ userId: session.userId, last: sql<Date>`max(${session.updatedAt})` })
      .from(session)
      .groupBy(session.userId),
  ]);

  const planName = new Map(planRows.map((p) => [p.id, p.name]));
  const leadsByUser = new Map(leadCounts.map((r) => [r.userId, r.n]));
  const lastByUser = new Map(lastSessions.map((r) => [r.userId, r.last ? new Date(r.last) : null]));

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile ?? "",
    role: (u.role as AdminUserRole) ?? "user",
    status: (u.status as AdminUserStatus) ?? "active",
    planId: u.planId,
    planName: u.planId ? (planName.get(u.planId) ?? null) : null,
    expiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 10) : null,
    createdAt: new Date(u.createdAt).toISOString(),
    lastActive: relativeTime(lastByUser.get(u.id) ?? null),
    leads: leadsByUser.get(u.id) ?? 0,
  }));
}
