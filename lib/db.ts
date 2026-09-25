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

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type DB = NodePgDatabase<typeof schema>;

// Lazily created so that merely *importing* this module never opens a connection
// or throws — `next build` (which runs with no DATABASE_URL, e.g. inside the
// Docker build) can trace the module graph safely. The pool is created on the
// first actual query at runtime, when DATABASE_URL is present.
let instance: DB | undefined;

function getDb(): DB {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Set it in the environment (see .env.local.example).",
      );
    }
    instance = drizzle(new Pool({ connectionString }), { schema });
  }
  return instance;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
