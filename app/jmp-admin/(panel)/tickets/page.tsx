// Admin → Tickets. Support messages users send from the app (e.g. the deactivated
// account "write to admin" flow). Server-gated; mutations go through Server Actions.

import { requireAdmin } from "@/lib/current-user";
import { listTickets } from "@/lib/tickets";
import { TicketsClient } from "@/components/admin/tickets/tickets-client";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const tickets = await listTickets();
  return <TicketsClient initial={tickets} />;
}
