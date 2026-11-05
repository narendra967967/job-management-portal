import "server-only";

// Broadcast reads for the admin screens, and who a broadcast would reach.

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastRecipients, broadcasts, user } from "@/db/schema";
import type { Broadcast, BroadcastAudience, BroadcastCategory } from "@/lib/broadcasts-model";

type Row = typeof broadcasts.$inferSelect & { createdByName: string | null };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toBroadcast(r: Row): Broadcast {
  return {
    id: r.id,
    title: r.title,
    contentHtml: r.contentHtml,
    category: r.category,
    channel: r.channel,
    status: r.status,
    scheduledFor: iso(r.scheduledFor),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdByName ?? "A former admin",
    startedAt: iso(r.startedAt),
    finishedAt: iso(r.finishedAt),
    canceledAt: iso(r.canceledAt),
    delivery: r.startedAt
      ? {
          inApp: r.inAppCount,
          emailTotal: r.emailTotal,
          emailSent: r.emailSent,
          emailFailed: r.emailFailed,
          emailSkipped: 0,
          skipReason: null,
        }
      : null,
  };
}

const select = () =>
  db
    .select({ b: broadcasts, createdByName: user.name })
    .from(broadcasts)
    .leftJoin(user, eq(user.id, broadcasts.createdBy));

export async function loadBroadcasts(): Promise<Broadcast[]> {
  const rows = await select().orderBy(desc(broadcasts.updatedAt));
  return rows.map((r) => toBroadcast({ ...r.b, createdByName: r.createdByName }));
}

/** One broadcast, with its skipped emails counted from the queue. */
export async function loadBroadcast(id: string): Promise<Broadcast | null> {
  const [r] = await select().where(eq(broadcasts.id, id));
  if (!r) return null;
  const b = toBroadcast({ ...r.b, createdByName: r.createdByName });
  if (b.delivery && b.delivery.emailTotal > 0) {
    const skipped = await db
      .select({ reason: broadcastRecipients.lastError, n: sql<number>`count(*)::int` })
      .from(broadcastRecipients)
      .where(and(eq(broadcastRecipients.broadcastId, id), eq(broadcastRecipients.status, "skipped")))
      .groupBy(broadcastRecipients.lastError)
      .orderBy(sql`count(*) desc`);
    b.delivery.emailSkipped = skipped.reduce((a, s) => a + s.n, 0);
    b.delivery.skipReason = skipped[0]?.reason ?? null;
  }
  return b;
}

/**
 * Who each category reaches right now. Everyone with a user account that isn't
 * deactivated, on any plan; email only where the address is confirmed;
 * Promotional leaves out anyone who opted out.
 */
export async function loadAudiences(): Promise<Record<BroadcastCategory, BroadcastAudience>> {
  const r = await db.execute(sql`
    select
      count(*)::int as all_users,
      count(*) filter (where u.email_verified)::int as verified,
      count(*) filter (where u.plan_expires_at < now())::int as expired,
      count(*) filter (where not u.email_verified)::int as unverified,
      count(*) filter (where coalesce(s.promo_opt_out, false))::int as opted_out,
      count(*) filter (where not coalesce(s.promo_opt_out, false))::int as p_all,
      count(*) filter (where not coalesce(s.promo_opt_out, false) and u.email_verified)::int as p_verified,
      count(*) filter (where not coalesce(s.promo_opt_out, false) and u.plan_expires_at < now())::int as p_expired,
      count(*) filter (where not coalesce(s.promo_opt_out, false) and not u.email_verified)::int as p_unverified
    from "user" u
    left join user_settings s on s.user_id = u.id
    where u.role = 'user' and u.status <> 'inactive'
  `);
  const c = (r as unknown as { rows: Record<string, number>[] }).rows[0] ?? {};
  const n = (k: string) => Number(c[k] ?? 0);
  return {
    important: { inApp: n("all_users"), email: n("verified"), expired: n("expired"), unverified: n("unverified"), optedOut: 0 },
    promotional: {
      inApp: n("p_all"),
      email: n("p_verified"),
      expired: n("p_expired"),
      unverified: n("p_unverified"),
      optedOut: n("opted_out"),
    },
  };
}
