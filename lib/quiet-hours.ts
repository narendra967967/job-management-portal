import "server-only";

// Global quiet-hours window (admin Settings → Cron). While active, background
// (cron) syncs are paused. The cron itself still fires every ~15 min, so the
// pause is enforced here by skipping work — not by controlling the scheduler.
// Manual "Sync now" is user-initiated and intentionally NOT gated by this.

import { db } from "@/lib/db";
import { cronConfig } from "@/db/schema";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * True when "now" falls inside the configured quiet-hours window on an applicable
 * day. Overnight windows (from > to) span midnight and are anchored to their
 * START day: e.g. a 22:00–07:00 window selected on Sat covers Sat 22:00 through
 * Sun 07:00 as one block (the after-midnight hours count as the START day, so
 * ticking Sunday is not required). Same-day windows use the current day.
 * Empty day list = every day. Day-of-week uses the window's timezone.
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

  const overnight = from > to;
  const inWindow = overnight ? cur >= from || cur < to : cur >= from && cur < to;
  if (!inWindow) return false;

  const days = c.quietDays ?? [];
  if (days.length === 0) return true; // empty = every day

  // Anchor to the window's START day: for an overnight window, the after-midnight
  // portion (cur < to) belongs to the previous calendar day.
  const idx = WEEKDAYS.indexOf(weekday);
  const startDay = !overnight || cur >= from ? weekday : WEEKDAYS[(idx + 6) % 7];
  return days.includes(startDay);
}
