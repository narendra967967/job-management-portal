/** Error text kept for admins: one line, at most 500 characters, AWS access keys masked. */
export function cleanErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg
    .replace(/\b(AKIA|ASIA)[A-Z0-9]{12,}\b/g, "[access key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
