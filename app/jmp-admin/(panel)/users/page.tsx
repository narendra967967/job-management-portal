import { requireAdmin } from "@/lib/current-user";
import { listAdminUsers, listPlanOptions } from "@/lib/admin/users-data";
import { UsersClient } from "@/components/admin/users/users-client";

// Admin → Users. Loads real users + plans server-side (admin-gated) and hands
// them to the client grid; all mutations go through Server Actions.
export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, plans] = await Promise.all([listAdminUsers(), listPlanOptions()]);
  return <UsersClient initialUsers={users} plans={plans} />;
}
