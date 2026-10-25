// Postgres error helpers. Drizzle wraps driver errors (DrizzleQueryError) and
// keeps the original pg error on `.cause`, so `e.code` alone misses them —
// always look through the cause chain.

interface PgErrorish {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

/** The underlying Postgres error fields, wherever they sit in the cause chain. */
export function pgErrorOf(e: unknown): { code?: string; constraint?: string } {
  let cur: unknown = e;
  for (let depth = 0; cur && typeof cur === "object" && depth < 5; depth++) {
    const c = cur as PgErrorish;
    if (typeof c.code === "string" && /^[0-9A-Z]{5}$/.test(c.code)) {
      return { code: c.code, constraint: c.constraint };
    }
    cur = c.cause;
  }
  return {};
}

/** True for a unique-constraint violation (optionally on one named constraint). */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const pg = pgErrorOf(e);
  return pg.code === "23505" && (!constraint || pg.constraint === constraint);
}
