import { redirect } from "next/navigation";

// Old address for "your plan has ended". Expired users now get limited mode
// with the Upgrade Plan page, so this only forwards old links and bookmarks.
export default function RenewPage() {
  redirect("/upgrade");
}
