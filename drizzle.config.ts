import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Schema-as-code is the migration source (TRD §2). `generate` diffs db/schema.ts
// into SQL under db/migrations (no DB connection needed); `migrate`/`push` and
// `studio` use DATABASE_URL from .env.local.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
