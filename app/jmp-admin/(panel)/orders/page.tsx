// Orders & Payments (Sales & Revenue): plan purchases and their payment status.
// Admin-gated; the client loads orders for the chosen dates.

import { requireAdmin } from "@/lib/current-user";
import { OrdersClient } from "@/components/admin/orders/orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  return <OrdersClient />;
}
