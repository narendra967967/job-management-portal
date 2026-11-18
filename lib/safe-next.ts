// Where to send someone after they sign in, from a ?next= link (for example an
// invoice they tried to open while signed out). Only a path on this site is
// accepted: anything that could point elsewhere ("//evil.com", "/\evil.com",
// "https://…") or back to a sign-in page is ignored, so the link can't be used
// to bounce people to another website.

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\s\\]/.test(raw)) return null;
  if (/^\/(login|signup|jmp-admin)(\/|\?|$)/.test(raw)) return null;
  return raw;
}
