// Add a single login user to the database — non-destructive (unlike the seed).
// Admin-provisioned accounts are the only way in (self sign-up is disabled), so
// this is how new users are created until the admin dashboard exists.
//
// Usage (values via env so the password isn't a literal in the file):
//   ADD_USER_EMAIL="jane@example.com" ADD_USER_PASSWORD="a-strong-pass" \
//   ADD_USER_NAME="Jane Doe" npm run db:add-user
//
// Creates: user row + Better Auth "credential" account (scrypt-hashed password)
// + default user_settings + gmail_config. Refuses if the email already exists.

import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { hashPassword } from "../lib/password";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const email = (process.env.ADD_USER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADD_USER_PASSWORD ?? "";
  const name = (process.env.ADD_USER_NAME ?? "").trim() || email.split("@")[0];
  const mobile = (process.env.ADD_USER_MOBILE ?? "").trim();
  const id = (process.env.ADD_USER_ID ?? "").trim() || randomUUID();

  if (!email || !email.includes("@")) {
    throw new Error("ADD_USER_EMAIL is required and must be a valid email.");
  }
  if (password.length < 8) {
    throw new Error("ADD_USER_PASSWORD must be at least 8 characters.");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const existing = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email));
  if (existing.length) {
    console.error(
      `\n⛔ A user with email ${email} already exists (id ${existing[0].id}). Aborting.\n`,
    );
    await pool.end();
    process.exit(1);
  }

  console.log(`Creating user ${email} (id ${id})…`);
  await db.insert(schema.user).values({
    id,
    name,
    email,
    emailVerified: true,
    ...(mobile ? { mobile } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Per-user defaults (mirrors provisionUserDefaults, inlined to keep this
  // script free of client-side imports).
  await db.insert(schema.userSettings).values({ userId: id }).onConflictDoNothing();
  await db
    .insert(schema.gmailConfig)
    .values({ userId: id, senders: ["jobalerts-noreply@linkedin.com"] })
    .onConflictDoNothing();

  console.log(
    `✅ Created ${email}. They can sign in with this email + the given password.`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
