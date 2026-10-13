// Applies pending Drizzle migrations (db/migrations) to DATABASE_URL.
//
// Runs INSIDE the app image at deploy time (deploy/vps/deploy.sh), so the VPS needs
// no repo checkout and no `npm ci`. Uses drizzle-orm's migrator, which records
// progress in the same drizzle.__drizzle_migrations table as `drizzle-kit migrate`,
// so databases migrated either way stay compatible.

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
