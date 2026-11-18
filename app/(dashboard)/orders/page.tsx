// Orders & payments (docs/invoices/spec.md, section 7): every payment the
// signed-in user has made or tried, plans and AI mock interviews alike, with
// its invoice. Its own page in the sidebar (owner, November 18, 2026), and open
// in limited mode: people need their invoices, and to renew, after a plan ends.
// The (dashboard) layout enforces the session.

import type { Metadata } from "next";
import { PaymentsTab } from "@/components/billing/payments-tab";

export const metadata: Metadata = { title: "Orders & payments" };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold">Orders &amp; payments</h1>
      <PaymentsTab />
    </div>
  );
}
