// Plan accent → badge classes. Keys mirror the admin plan accents (plans.accent,
// chosen when a plan is created). Kept here — NOT under lib/admin — so the user app
// can render the plan badge without importing the admin module. Classes are literal
// strings so Tailwind includes them; each has a light + dark variant.

export const PLAN_ACCENT_BADGE: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
  violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  teal: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
};

/** Badge classes for a plan accent key; falls back to indigo for unknown/empty. */
export function planBadgeClass(accent: string | null | undefined): string {
  return (accent && PLAN_ACCENT_BADGE[accent]) || PLAN_ACCENT_BADGE.indigo;
}
