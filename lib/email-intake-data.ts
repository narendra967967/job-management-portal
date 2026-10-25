import "server-only";

// Email intake — server data layer (config, addresses, senders, log, health).
// Spec: docs/email-forwarding.md. Callers enforce auth (actions / routes).

import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, ilike, isNotNull, lt, or, sql, count, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailIntakeConfig as configT,
  inboundAddresses as addressesT,
  inboundEmailLog as logT,
  inboundSenders as sendersT,
} from "@/db/schema";
import { user as userT } from "@/db/auth-schema";
import type {
  EmailIntakeConfig,
  ForwardingHealth,
  InboundLogEntry,
  InboundSender,
  InboundStatus,
  MyForwarding,
  UserForwardingStatus,
} from "@/lib/email-intake-model";
import { siteLabel } from "@/lib/email-intake-model";
import { isUniqueViolation } from "@/lib/db-errors";

/** Domain users forward to in this environment (e.g. in.jobtiva.in). */
export function receivingDomain(): string {
  return (process.env.INBOUND_DOMAIN || "in.localhost").trim().toLowerCase();
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/* ---------------- config ---------------- */

export async function getIntakeConfig(): Promise<EmailIntakeConfig> {
  let [row] = await db.select().from(configT).where(eq(configT.id, "app"));
  if (!row) {
    // The migration seeds it; recreate defensively if someone deleted it.
    [row] = await db.insert(configT).values({ id: "app" }).onConflictDoNothing().returning();
    if (!row) [row] = await db.select().from(configT).where(eq(configT.id, "app"));
  }
  return {
    forwardingEnabled: row.forwardingEnabled,
    gmailOAuthEnabled: row.gmailOAuthEnabled,
    maxBytes: row.maxBytes,
    aiMaxJobs: row.aiMaxJobs,
    receivingDomain: receivingDomain(),
    gmailToggledAt: iso(row.gmailToggledAt),
    gmailToggledBy: row.gmailToggledBy,
  };
}

/** Cheap check used by every Connect Gmail entry point. A missing row means
 *  the default (on); if the database can't be read, it fails CLOSED — Gmail
 *  copy stays hidden and no sync starts until the switch can be confirmed. */
export async function isGmailOAuthEnabled(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ on: configT.gmailOAuthEnabled })
      .from(configT)
      .where(eq(configT.id, "app"));
    return row ? row.on : true;
  } catch {
    return false;
  }
}

/* ---------------- addresses ---------------- */

const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l lookalikes

/** 12 random characters (~60 bits) — unguessable, easy to read aloud. */
export function newToken(): string {
  const bytes = randomBytes(12);
  let t = "";
  for (const b of bytes) t += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return t;
}

function toMyForwarding(row: typeof addressesT.$inferSelect): MyForwarding {
  return {
    address: `${row.token}@${receivingDomain()}`,
    gmailCode: row.gmailCode,
    gmailConfirmUrl: row.gmailConfirmUrl,
    gmailConfirmFrom: row.gmailConfirmFrom,
    gmailConfirmText: row.gmailConfirmText,
    gmailCodeAt: iso(row.gmailCodeAt),
    confirmedAt: iso(row.confirmedAt),
    firstReceivedAt: iso(row.firstReceivedAt),
    lastReceivedAt: iso(row.lastReceivedAt),
  };
}

/** The user's address, created on first use. */
export async function getOrCreateForwarding(userId: string): Promise<MyForwarding> {
  const [existing] = await db.select().from(addressesT).where(eq(addressesT.userId, userId));
  if (existing) return toMyForwarding(existing);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .insert(addressesT)
      .values({ userId, token: newToken() })
      .onConflictDoNothing()
      .returning();
    if (row) return toMyForwarding(row);
    // Either a concurrent create for this user, or a (vanishingly rare) token clash.
    const [again] = await db.select().from(addressesT).where(eq(addressesT.userId, userId));
    if (again) return toMyForwarding(again);
  }
  throw new Error("Couldn't create a forwarding address.");
}

/** New token; the old address stops working immediately. Progress resets. */
export async function resetForwarding(userId: string): Promise<MyForwarding> {
  await getOrCreateForwarding(userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db
        .update(addressesT)
        .set({
          token: newToken(),
          gmailCode: null,
          gmailConfirmUrl: null,
          gmailConfirmFrom: null,
          gmailConfirmText: null,
          gmailCodeAt: null,
          confirmedAt: null,
          firstReceivedAt: null,
          lastReceivedAt: null,
          createdAt: new Date(),
        })
        .where(eq(addressesT.userId, userId))
        .returning();
      return toMyForwarding(row);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // retry only on token clash
    }
  }
  throw new Error("Couldn't reset the forwarding address.");
}

export async function markForwardingConfirmed(userId: string): Promise<void> {
  await db
    .update(addressesT)
    .set({ confirmedAt: new Date(), gmailConfirmText: null })
    .where(and(eq(addressesT.userId, userId), sql`${addressesT.confirmedAt} is null`));
}

/** Resolve a recipient token to its user (null = unknown address). */
export async function userIdForToken(token: string): Promise<string | null> {
  const t = token.trim().toLowerCase();
  if (!/^[a-z0-9]{6,40}$/.test(t)) return null;
  const [row] = await db
    .select({ userId: addressesT.userId })
    .from(addressesT)
    .where(eq(addressesT.token, t));
  return row?.userId ?? null;
}

/* ---------------- senders ---------------- */

/** The job sites forwarding accepts right now, for public copy:
 *  "LinkedIn, Naukri and TimesJobs" (from the enabled allowed senders). */
export async function supportedSitesText(): Promise<string> {
  const senders = await loadSenders();
  const names = [...new Set(senders.filter((s) => s.enabled).map((s) => siteLabel(s.signingDomain)))];
  if (!names.length) return "your job sites";
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export async function loadSenders(): Promise<InboundSender[]> {
  const rows = await db.select().from(sendersT).orderBy(sendersT.createdAt, sendersT.match);
  return rows.map((r) => ({
    id: r.id,
    match: r.match,
    signingDomain: r.signingDomain,
    parser: r.parser,
    enabled: r.enabled,
  }));
}

/* ---------------- log + health (admin) ---------------- */

export interface InboundLogQuery {
  /** Inclusive window on received time (already converted to instants). */
  since: Date;
  until: Date;
  status?: InboundStatus;
  /** Only this user's rows (user-side Email log). */
  userId?: string;
  /** Part of the user's email address. */
  userEmail?: string;
  /** Free text over user, sender, site and reason. */
  q?: string;
  page: number;
  size: number;
}

const escapeLike = (v: string) => `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** One page of the log, newest first, filtered in the database, with the
 *  total number of matching rows for pagination. */
export async function listInboundLog(opts: InboundLogQuery): Promise<{ rows: InboundLogEntry[]; total: number }> {
  const where: SQL[] = [gte(logT.receivedAt, opts.since), lt(logT.receivedAt, opts.until)];
  if (opts.status) where.push(eq(logT.status, opts.status));
  if (opts.userId) where.push(eq(logT.userId, opts.userId));
  const email = opts.userEmail?.trim().slice(0, 254);
  if (email) where.push(ilike(userT.email, escapeLike(email)));
  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    const like = escapeLike(q);
    where.push(
      or(
        ilike(userT.name, like),
        ilike(userT.email, like),
        ilike(logT.fromAddress, like),
        ilike(logT.fromDomain, like),
        ilike(logT.site, like),
        ilike(logT.reason, like),
      )!,
    );
  }
  const filter = and(...where);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ l: logT, name: userT.name, email: userT.email })
      .from(logT)
      .leftJoin(userT, eq(userT.id, logT.userId))
      .where(filter)
      .orderBy(desc(logT.receivedAt))
      .limit(opts.size)
      .offset((opts.page - 1) * opts.size),
    db.select({ total: count() }).from(logT).leftJoin(userT, eq(userT.id, logT.userId)).where(filter),
  ]);
  return {
    total: Number(total),
    rows: rows.map(({ l, name, email }) => ({
      id: l.id,
      receivedAt: l.receivedAt.toISOString(),
      user: l.userId && email ? { name: name ?? email, email } : null,
      fromAddress: l.fromAddress,
      fromDomain: l.fromDomain,
      site: l.site,
      signingDomain: l.signingDomain,
      status: l.status,
      reason: l.reason,
      sizeBytes: l.sizeBytes,
      leadsCreated: l.leadsCreated,
    })),
  };
}

export async function forwardingHealth(): Promise<ForwardingHealth> {
  const now = Date.now();
  const day = new Date(now - 24 * 3600_000);
  const week = new Date(now - 7 * 24 * 3600_000);

  const tally = async (since: Date) => {
    const rows = await db
      .select({ status: logT.status, n: count() })
      .from(logT)
      .where(gte(logT.receivedAt, since))
      .groupBy(logT.status);
    const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
    const received = rows.reduce((a, r) => a + Number(r.n), 0);
    return { received, accepted: by.accepted ?? 0, rejected: by.rejected ?? 0 };
  };

  const [last24h, last7d, top, last, setUp, total] = await Promise.all([
    tally(day),
    tally(week),
    db
      .select({ reason: logT.reason, n: count() })
      .from(logT)
      .where(and(gte(logT.receivedAt, week), eq(logT.status, "rejected")))
      .groupBy(logT.reason)
      .orderBy(desc(count()))
      .limit(5),
    db.select({ at: logT.receivedAt }).from(logT).orderBy(desc(logT.receivedAt)).limit(1),
    db
      .select({ n: count() })
      .from(addressesT)
      .innerJoin(userT, eq(userT.id, addressesT.userId))
      .where(and(isNotNull(addressesT.firstReceivedAt), eq(userT.role, "user"))),
    db.select({ n: count() }).from(userT).where(eq(userT.role, "user")),
  ]);

  return {
    last24h,
    last7d,
    topRejections: top.map((t) => ({ reason: t.reason, count: Number(t.n) })),
    lastReceivedAt: last[0]?.at.toISOString() ?? null,
    usersSetUp: Number(setUp[0]?.n ?? 0),
    usersTotal: Number(total[0]?.n ?? 0),
  };
}

export async function userForwardingStatuses(): Promise<Record<string, UserForwardingStatus>> {
  const rows = await db.select().from(addressesT);
  return Object.fromEntries(
    rows.map((r) => [
      r.userId,
      {
        addressCreatedAt: iso(r.createdAt),
        gmailCodeAt: iso(r.gmailCodeAt),
        confirmedAt: iso(r.confirmedAt),
        firstReceivedAt: iso(r.firstReceivedAt),
        lastReceivedAt: iso(r.lastReceivedAt),
      },
    ]),
  );
}

