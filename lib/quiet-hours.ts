import "server-only";

// Global quiet-hours window (admin Settings → Cron). While active, background
// (cron) syncs are paused. The cron itself still fires every ~15 min, so the
// pause is enforced here by skipping work — not by controlling the scheduler.
// Manual "Sync now" is user-initiated and intentionally NOT gated by this.

import { db } from "@/lib/db";
import { cronConfig } from "@/db/schema";

/**
 * True when "now" falls inside the configured quiet-hours window on an applicable
 * day. Overnight windows (from > to) span midnight. Empty day list = every day.
 * Day-of-week uses the window's timezone; for overnight windows the applicable
 * day is approximated as the current day (good enough for pausing background work).
 */
export async function isWithinQuietHours(now: Date = new Date()): Promise<boolean> {
  const [c] = await db.select().from(cronConfig).limit(1);
  if (!c?.quietEnabled) return false;

  const tz = c.quietTz || "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const cur = hh * 60 + mm;

  const toMin = (hm: string, fallback: number) => {
    const [h, m] = hm.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : fallback;
  };
  const from = toMin(c.quietFrom || "22:00", 22 * 60);
  const to = toMin(c.quietTo || "07:00", 7 * 60);

  const inWindow = from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  if (!inWindow) return false;

  const days = c.quietDays ?? [];
  if (days.length > 0 && !days.includes(weekday)) return false; // empty = every day
  return true;
}
