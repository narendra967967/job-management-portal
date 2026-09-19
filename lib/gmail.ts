import "server-only";

// Gmail read-only client. Uses the per-user Google refresh token captured when
// the user connected Google in Settings (stored in the `account` row), exchanges
// it for an access token, and calls the Gmail REST API (users.messages).
//
// READ-ONLY by design — only list/get are used; the scope is gmail.readonly.
// No googleapis SDK (TRD §2 named it, but raw REST keeps deps light and the
// surface tiny); token refresh is explicit against Google's token endpoint.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account as accountT } from "@/db/schema";

export const GOOGLE_NOT_CONNECTED = "GOOGLE_NOT_CONNECTED";

/** Fresh access token for the user's linked Google account (refreshes each call;
 *  fine for a low-frequency sync). Throws GOOGLE_NOT_CONNECTED if not linked. */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const [acct] = await db
    .select({ refreshToken: accountT.refreshToken })
    .from(accountT)
    .where(and(eq(accountT.userId, userId), eq(accountT.providerId, "google")));

  if (!acct?.refreshToken) throw new Error(GOOGLE_NOT_CONNECTED);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: acct.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("No access_token from Google.");
  return data.access_token as string;
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Message ids matching `query` (paginated, capped for a Hobby-safe run). */
export async function listMessageIds(
  accessToken: string,
  query: string,
  max = 100,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${GMAIL}/messages`);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(Math.min(50, max - ids.length)));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Gmail list failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    for (const m of data.messages ?? []) ids.push(m.id);
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  internalDate: number; // epoch ms
  html: string;
}

/** Fetch one message (full) and extract its HTML body + key headers. */
export async function getMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail get failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const header = (n: string) =>
    headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

  return {
    id,
    subject: header("subject"),
    from: header("from"),
    internalDate: Number(data.internalDate ?? 0),
    html: extractHtml(data.payload) || extractPlain(data.payload),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Quoted-printable → text (UTF-8 aware): drop soft breaks, decode =XX bytes. */
function decodeQuotedPrintable(s: string): string {
  const noSoftBreaks = s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < noSoftBreaks.length; i++) {
    const c = noSoftBreaks[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(noSoftBreaks.substr(i + 1, 2))) {
      bytes.push(parseInt(noSoftBreaks.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(noSoftBreaks.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** base64url-decode a part body, then transfer-decode by its CTE header. */
function decodePart(part: any): string {
  if (!part?.body?.data) return "";
  const text = Buffer.from(
    part.body.data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
  const cte = (
    (part.headers ?? []).find(
      (h: { name: string }) => h.name.toLowerCase() === "content-transfer-encoding",
    )?.value ?? ""
  ).toLowerCase();
  return cte === "quoted-printable" ? decodeQuotedPrintable(text) : text;
}

function extractHtml(part: any): string {
  if (!part) return "";
  if (part.mimeType === "text/html" && part.body?.data) return decodePart(part);
  for (const p of part.parts ?? []) {
    const html = extractHtml(p);
    if (html) return html;
  }
  return "";
}

function extractPlain(part: any): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodePart(part);
  for (const p of part.parts ?? []) {
    const t = extractPlain(p);
    if (t) return t;
  }
  return "";
}
/* eslint-enable @typescript-eslint/no-explicit-any */
