// Drizzle client.
//
// LOCAL-FIRST (current): uses node-postgres (`pg`) against a standard Postgres
// server — the local Docker container in docker-compose.yml. `DATABASE_URL` is
// read from .env.local (a secret file, never committed) and never reaches the
// client; this module is server-only.
//
// DEVIATION FROM TRD §2: the TRD specced Neon's serverless HTTP driver, which
// cannot reach a local Postgres. We switched to `pg` for the local environment.
// Going online later is a one-file change here (point `pg` at a hosted Postgres,
// or swap in drizzle-orm/neon-http for an edge deploy).

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.",
  );
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
