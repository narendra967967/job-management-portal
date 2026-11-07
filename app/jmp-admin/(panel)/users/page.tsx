import { requireAdmin } from "@/lib/current-user";
import { listAdminUsers, listPlanOptions } from "@/lib/admin/users-data";
import { UsersClient } from "@/components/admin/users/users-client";

// Admin → Users. Loads real users + plans server-side (admin-gated) and hands
// them to the client grid; all mutations go through Server Actions.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const adminId = await requireAdmin();
  // ?q= opens the list already searched (e.g. "View user" from an order).
  const q = ((await searchParams).q ?? "").slice(0, 200);
  // Hide the logged-in admin from their own list — no self delete/deactivate.
  const [users, plans] = await Promise.all([listAdminUsers(adminId), listPlanOptions()]);
  return <UsersClient initialUsers={users} plans={plans} initialQuery={q} />;
}
