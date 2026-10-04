import { redirect } from "next/navigation";
import { getSessionUser, accessState } from "@/lib/current-user";
import { guardMaintenance } from "@/lib/maintenance";
import { RenewNotice } from "@/components/auth/account-blocked";

export default async function RenewPage() {
  await guardMaintenance();
  const u = await getSessionUser();
  if (!u) redirect("/");
  const state = accessState(u);
  if (state === "ok") redirect("/leads");
  if (state === "deactivated") redirect("/deactivated");
  return <RenewNotice name={u.name} />;
}
