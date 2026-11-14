/**
 * The reason a database call failed, for one server-log line. Drizzle wraps the
 * driver's error in one whose message is the whole SQL query and its values;
 * the driver's own message (the cause) says what actually went wrong.
 */
export function dbErrorReason(e: unknown): string {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause : e;
  return cleanErrorMessage(cause).slice(0, 200);
}

/** Error text kept for admins: one line, at most 500 characters, AWS access keys masked. */
export function cleanErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{12,}\b/g, "[access key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
