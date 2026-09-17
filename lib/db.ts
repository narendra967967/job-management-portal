// Drizzle client over Neon's serverless HTTP driver. One connection function,
// reused across Server Actions (Phase 3). No pooling to manage — Neon's driver
// is built for serverless invocations.
//
// `DATABASE_URL` is the Neon pooled connection string (TRD §10), injected by
// the Neon–Vercel integration in prod and read from .env.local in dev. It is a
// secret and never reaches the client — this module is server-only.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.",
  );
}

export const db = drizzle(neon(connectionString), { schema });
