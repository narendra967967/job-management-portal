import { redirect } from "next/navigation";
import { getSessionUser, accessState } from "@/lib/current-user";
import { DeactivatedNotice } from "@/components/auth/account-blocked";

export default async function DeactivatedPage() {
  const u = await getSessionUser();
  if (!u) redirect("/");
  const state = accessState(u);
  if (state === "ok") redirect("/leads");
  if (state === "expired") redirect("/renew");
  return <DeactivatedNotice name={u.name} />;
}
