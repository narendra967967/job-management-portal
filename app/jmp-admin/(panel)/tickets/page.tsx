// Admin → Tickets. Support messages users send from the app (e.g. the deactivated
// account "write to admin" flow). Server-gated; mutations go through Server Actions.

import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/current-user";
import { listTickets } from "@/lib/tickets";
import { db } from "@/lib/db";
import { plans, user } from "@/db/schema";
import { TicketsClient } from "@/components/admin/tickets/tickets-client";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const [tickets, priority] = await Promise.all([
    listTickets(),
    // Users whose plan includes priority support — their tickets get a badge.
    // user.plan_id is text and plans.id is uuid, so cast for the join.
    db.select({ id: user.id }).from(user).innerJoin(plans, sql`${plans.id}::text = ${user.planId}`).where(eq(plans.prioritySupport, true)),
  ]);
  return <TicketsClient initial={tickets} priorityUserIds={priority.map((p) => p.id)} />;
}
