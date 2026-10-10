import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/current-user";
import { getUserTicket } from "@/lib/tickets";
import { TicketConversation } from "@/components/support/ticket-conversation";

// One of the user's own support tickets, as a conversation. The (dashboard) layout
// already enforces the session; getUserTicket additionally scopes to this user, so a
// user can never open someone else's ticket.
export default async function UserTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSessionUser();
  if (!u) notFound();
  const ticket = await getUserTicket(u.id, id);
  if (!ticket) notFound();
  return <TicketConversation ticket={ticket} />;
}
