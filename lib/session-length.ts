import "server-only";

// Resolves the configured login/session length (admin Settings → Security) into
// seconds. Read ONCE at auth-module init and used for BOTH the DB session expiry
// and the browser cookie max-age, so the two always match. Because it's read at
// startup, changing the setting takes effect on new logins after a server
// restart. A short timeout + fallback keeps the build/boot resilient when the DB
// isn't reachable yet.

import { db } from "@/lib/db";
import { securityConfig } from "@/db/schema";

const DEFAULT_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MIN_SECONDS = 5 * 60; // floor: 5 minutes

export async function getSessionLengthSeconds(): Promise<number> {
  try {
    const query = db
      .select({ value: securityConfig.sessionValue, unit: securityConfig.sessionUnit })
      .from(securityConfig)
      .limit(1);
    const rows = await Promise.race([
      query,
      new Promise<Awaited<typeof query>>((resolve) => setTimeout(() => resolve([]), 3000)),
    ]);
    const s = rows[0];
    if (!s) return DEFAULT_SECONDS;
    const value = s.value ?? 7;
    const seconds = s.unit === "hours" ? value * 3600 : value * 86400;
    return Math.max(MIN_SECONDS, seconds);
  } catch {
    return DEFAULT_SECONDS;
  }
}
