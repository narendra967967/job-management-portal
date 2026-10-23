import "server-only";

import { timingSafeEqual } from "node:crypto";

/** Bearer INBOUND_SECRET check for the internal mail endpoints (constant-time). */
export function isInboundAuthorized(header: string | null): boolean {
  const secret = process.env.INBOUND_SECRET;
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}
