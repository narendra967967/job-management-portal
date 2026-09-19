// Password hashing for credential login (email + password). Pure node:crypto
// scrypt so it can be used both by Better Auth (runtime) and the seed/admin
// bootstrap script — no "server-only", no path aliases, so tsx can import it.
//
// Format: "<saltHex>:<keyHex>".

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  stored: string,
  password: string,
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const key = Buffer.from(keyHex, "hex");
  const derived = (await scryptAsync(password, salt, key.length)) as Buffer;
  return key.length === derived.length && timingSafeEqual(key, derived);
}
