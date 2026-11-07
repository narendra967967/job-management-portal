// Orders & Payments (Sales & Revenue): plan purchases and their payment status.
// Admin-gated. PHASE 1: the client shows sample data.

import { requireAdmin } from "@/lib/current-user";
import { OrdersClient } from "@/components/admin/orders/orders-client";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  return <OrdersClient />;
}
