// The scheduled jobs: what the server crontab calls (deploy/vps/crontab.txt,
// through cron-run.sh). The keys match cron-run.sh's route names. Shared by the
// cron routes (lib/job-runs.ts) and the dashboard's System block.

export const JOBS = [
  { key: "ai", label: "AI alert reader", every: "Every 5 minutes", lateAfterMin: 30 },
  { key: "broadcasts", label: "Broadcast sender", every: "Every 5 minutes", lateAfterMin: 30 },
  { key: "interviews", label: "Mock interview upkeep", every: "Every 5 minutes", lateAfterMin: 30 },
  { key: "sync", label: "Gmail sync", every: "Every 15 minutes", lateAfterMin: 60 },
  { key: "reminders", label: "Renewal reminders", every: "Daily", lateAfterMin: 26 * 60 },
  { key: "purge", label: "Daily cleanup", every: "Daily", lateAfterMin: 26 * 60 },
] as const;

export type JobKey = (typeof JOBS)[number]["key"];

/** A job that should have run again by now (the crontab missing or the app down at the time). */
export function isLate(lastRunAt: string | Date | null, lateAfterMin: number, now = Date.now()): boolean {
  if (!lastRunAt) return false;
  return now - new Date(lastRunAt).getTime() > lateAfterMin * 60_000;
}
