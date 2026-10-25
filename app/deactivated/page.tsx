import { redirect } from "next/navigation";
import { getSessionUser, accessState } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";
import { DeactivatedNotice } from "@/components/auth/account-blocked";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account deactivated", robots: { index: false, follow: false } };

export default async function DeactivatedPage() {
  await guardMaintenance();
  const u = await getSessionUser();
  if (!u) redirect("/login");
  const state = accessState(u);
  if (state === "ok") redirect("/leads");
  if (state === "expired") redirect("/renew");
  return <DeactivatedNotice name={u.name} />;
}
