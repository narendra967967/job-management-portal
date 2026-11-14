// Email delivery checks (SMTP or Amazon SES), run before a deploy (Amazon SES
// phase 4). Run from the repo root against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/email-delivery-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the signed-out HTTP checks.
// Amazon SES is never contacted: the script starts its own stand-in for the SES
// API and points the SDK at it. It saves made-up SES details (assembled at run
// time, so secret scanners don't mistake them for keys) for a moment and puts
// back exactly what was in email_delivery before. Nothing is ever delivered.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Run this against a local stack, not production.");
  process.exit(1);
}

const APP = process.env.APP_URL ?? "";
// Made-up credentials, built from pieces so no key-shaped text sits in the repo
// (GitHub secret scanning flagged an earlier literal test value as a leaked key).
const FAKE_ID_BODY = "TESTONLYNOTAKEY0"; // 16 characters
const fakeKeyId = (prefix: string) => [prefix.slice(0, 2), prefix.slice(2), FAKE_ID_BODY].join("");
const EXAMPLE_KEY_ID = fakeKeyId("AKIA");
const SECRET_MARKER = "NotARealSecret";
const EXAMPLE_SECRET = `TestOnly${SECRET_MARKER}`.padEnd(40, "0");
let failures = 0;

function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? `  (${detail})` : ""}`);
}

// Windows checkouts get CRLF line endings; the patterns below expect \n.
const read = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

/* ---------------- a stand-in for the SES v2 API ---------------- */

type Seen = { method: string; url: string; auth: string; body: string };
const seen: Seen[] = [];
let mode: "ok" | "reject" | "badkey" | "denied" = "ok";
const fake = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    seen.push({ method: req.method ?? "", url: req.url ?? "", auth: String(req.headers.authorization ?? ""), body });
    const fail = (status: number, type: string, message: string) => {
      res.writeHead(status, { "content-type": "application/json", "x-amzn-errortype": type });
      res.end(JSON.stringify({ message }));
    };
    if (mode === "badkey") return fail(403, "UnrecognizedClientException", "The security token included in the request is invalid.");
    if (mode === "denied") return fail(403, "AccessDeniedException", "not authorized to perform ses:GetAccount");
    if (req.method === "GET" && req.url?.startsWith("/v2/email/account")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ProductionAccessEnabled: true, SendingEnabled: true, SendQuota: { Max24HourSend: 50000, MaxSendRate: 14, SentLast24Hours: 12 } }));
    }
    if (req.method === "POST" && req.url?.startsWith("/v2/email/outbound-emails")) {
      if (mode === "reject") return fail(400, "MessageRejected", "Email address is not verified.");
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ MessageId: "check-message-id" }));
    }
    fail(404, "NotFoundException", `no route ${req.url}`);
  });
});
await new Promise<void>((r) => fake.listen(0, "127.0.0.1", () => r()));
process.env.SES_ENDPOINT = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;

// Imported after SES_ENDPOINT is set, because lib/ses.ts reads it at load.
const model = await import("../../lib/email-delivery-model.ts");
const { encryptSecret, decryptSecret } = await import("../../lib/crypto.ts");
const { getEmailDelivery, getEmailProvider, getSesCredentials, providersReady } = await import("../../lib/email-delivery.ts");
const { isMailConfigured, sendMail, sendMailWith } = await import("../../lib/mailer.ts");
const { getSesAccount, sesErrorMessage } = await import("../../lib/ses.ts");

/* ---------------- D1 input checks (the same schema the server uses) ---------------- */

const good = {
  region: "ap-south-1",
  accessKeyId: EXAMPLE_KEY_ID,
  secretAccessKey: EXAMPLE_SECRET,
  fromName: "Jobtiva",
  fromEmail: "noreply@example.com",
  replyTo: "",
};
const accepts = (patch: object) => model.sesInputSchema.safeParse({ ...good, ...patch }).success;
check("D1", "complete SES details are accepted", accepts({}));
check("D1", "an empty secret is accepted (keeps the saved one)", accepts({ secretAccessKey: "" }));
check("D1", "a made-up region is refused", !accepts({ region: "mumbai" }));
check("D1", "a temporary ASIA key is refused", !accepts({ accessKeyId: fakeKeyId("ASIA") }));
check("D1", "a short key ID is refused", !accepts({ accessKeyId: "AKIA123" }));
check("D1", "a secret of the wrong length is refused", !accepts({ secretAccessKey: "short" }));
check("D1", "a bad from email is refused", !accepts({ fromEmail: "not-an-email" }));
check("D1", "a bad reply-to is refused", !accepts({ replyTo: "nope" }));
check("D1", "a missing region is refused", !accepts({ region: "" }));
check("D1", "an over-long from name is refused", !accepts({ fromName: "x".repeat(101) }));
check(
  "D1",
  "missing pieces are named",
  model.sesMissing({ region: "", accessKeyId: "", hasSecret: false, fromEmail: "" }).join(",") === "region,access key ID,secret access key,from email",
);
check("D1", "SMTP counts as ready only when on, with a host and from email", model.smtpReady({ enabled: true, host: "h", fromEmail: "a@b.c" }) && !model.smtpReady({ enabled: false, host: "h", fromEmail: "a@b.c" }));

/* ---------------- D2 who can change it ---------------- */

{
  const src = read("actions/admin-email-delivery.ts");
  const fns = [...src.matchAll(/export async function (\w+)\([^]*?\{\n([^]*?)\n\}/g)];
  check(
    "D2",
    "every Email delivery action checks for an admin first",
    fns.length === 4 && fns.every((m) => /^\s*(const adminId = )?await requireAdmin\(\);/.test(m[2])),
    fns.map((m) => m[1]).join(", "),
  );
  check("D2", "saving validates with the shared schema", src.includes("sesInputSchema.safeParse(input)"));
  check("D2", "switching re-checks readiness on the server", /setEmailProviderAction[^]*?providersReady\(\)/.test(src));
  check("D2", "the SES test email goes through SES", /sendSesTestAction[^]*?via: "ses"/.test(src));
  check("D2", "the SMTP test email goes through SMTP", /via: "smtp"/.test(read("actions/admin-settings.ts")));
  check("D2", "the stand-in endpoint is ignored in production", /NODE_ENV !== "production" \? process\.env\.SES_ENDPOINT/.test(read("lib/ses.ts")));
  check("D2", "SesSettings (what the screen gets) has no secret field", !/secretAccessKey|Ciphertext/.test(read("lib/email-delivery-model.ts").split("export interface SesSettings")[1].split("}")[0]));
}

/* ---------------- D3–D5 with the database ---------------- */

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const before = (await db.query("select * from email_delivery")).rows as Record<string, unknown>[];
const providerBefore = await getEmailProvider();
// The sent-email log: only the rows this script makes (to these addresses,
// since it started) are removed at the end, so real sends meanwhile stay.
const logStart = (await db.query("select now() as t")).rows[0].t as Date;
const logCountBefore = Number((await db.query("select count(*) from sent_email_log where sent_at < $1", [logStart])).rows[0].count);
const firstUser = (await db.query(`select lower(email) as email from "user" order by created_at limit 1`)).rows[0]?.email as string | undefined;
const logAddresses = ["someone@example.com", "x@example.com", "gone-broadcast@example.com", "broken-log@example.com", ...(firstUser ? [firstUser] : [])];

async function restore() {
  await db.query("delete from email_delivery");
  for (const row of before) {
    const cols = Object.keys(row);
    await db.query(
      `insert into email_delivery (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      cols.map((c) => (c === "ses_account" && row[c] ? JSON.stringify(row[c]) : row[c])),
    );
  }
}

try {
  await db.query("delete from email_delivery");
  check("D3", "with no row, SMTP is the service", (await getEmailProvider()) === "smtp");
  check("D3", "with no row, SES isn't ready", (await providersReady()).ses === false && (await getSesCredentials()) === null);

  const ciphertext = encryptSecret(EXAMPLE_SECRET);
  await db.query(
    `insert into email_delivery (id, provider, ses_region, ses_access_key_id, ses_secret_ciphertext, ses_from_name, ses_from_email, ses_reply_to)
     values ('app', 'ses', 'ap-south-1', $1, $2, 'Jobtiva', 'noreply@example.com', 'support@example.com')`,
    [EXAMPLE_KEY_ID, ciphertext],
  );
  check("D3", "the secret is stored encrypted", !ciphertext.includes(SECRET_MARKER) && decryptSecret(ciphertext) === EXAMPLE_SECRET);
  const screen = JSON.stringify(await getEmailDelivery());
  check("D3", "the admin screen never gets the secret", !screen.includes(SECRET_MARKER) && !screen.includes(ciphertext.slice(0, 16)));
  check("D3", "the screen is told a secret is saved", (await getEmailDelivery()).ses.hasSecret);
  check("D3", "the mailer follows the choice", (await getEmailProvider()) === "ses" && (await isMailConfigured()));

  // D4 sending through SES (the stand-in)
  mode = "ok";
  seen.length = 0;
  await sendMail({
    to: "someone@example.com",
    subject: "Delivery check",
    html: "<p>Hi</p>",
    text: "Hi",
    headers: { "List-Unsubscribe": "<https://example.com/u>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tag: { kind: "template", label: "Delivery check", templateKey: "verify_email" },
  });
  const sent = seen.find((r) => r.url.startsWith("/v2/email/outbound-emails"));
  check("D4", "the email went to SES", !!sent);
  const raw = sent ? Buffer.from(JSON.parse(sent.body).Content.Raw.Data, "base64").toString("utf8") : "";
  check("D4", "the request is signed for SES in the saved region", new RegExp(`Credential=${EXAMPLE_KEY_ID}/\\d{8}/ap-south-1/ses/aws4_request`).test(sent?.auth ?? ""));
  check("D4", "the secret never leaves the server", seen.every((r) => !JSON.stringify(r).includes(SECRET_MARKER)));
  check("D4", "From carries the name", /^From: Jobtiva <noreply@example\.com>/m.test(raw));
  check("D4", "Reply-To is sent", /^Reply-To: support@example\.com/m.test(raw));
  check("D4", "unsubscribe headers survive", /^List-Unsubscribe: <https:\/\/example\.com\/u>/m.test(raw) && /^List-Unsubscribe-Post:/m.test(raw));
  const account = await getSesAccount((await getSesCredentials())!);
  check("D4", "Test connection reads the account", account.productionAccess && account.max24HourSend === 50000 && account.maxSendRate === 14 && account.sentLast24Hours === 12);

  // D5 failures
  const errorOf = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      return "";
    } catch (e) {
      return sesErrorMessage(e, "ap-south-1");
    }
  };
  mode = "reject";
  check("D5", "a sandbox rejection is explained", /sandbox/.test(await errorOf(() => sendMailWith("ses", { to: "x@example.com", subject: "s", html: "h", tag: { kind: "test", label: "Reject check" } }))));
  mode = "badkey";
  check("D5", "an unknown key is explained", /doesn't recognize/.test(await errorOf(async () => getSesAccount((await getSesCredentials())!))));
  mode = "denied";
  check("D5", "a missing IAM permission names what's needed", /ses:GetAccount/.test(await errorOf(async () => getSesAccount((await getSesCredentials())!))));
  mode = "ok";
  await db.query("update email_delivery set ses_secret_ciphertext = null where id = 'app'");
  let thrown = "";
  try {
    await sendMail({ to: "x@example.com", subject: "s", html: "h", tag: { kind: "test", label: "Not set up check" } });
  } catch (e) {
    thrown = (e as Error).message;
  }
  check("D5", "SES chosen but incomplete fails instead of falling back to SMTP", thrown === "SMTP_NOT_CONFIGURED", thrown);
  check("D5", "and the switch would refuse SES now", (await providersReady()).ses === false);

  // D7 the sent-email log (dashboard phase 4). Rows are written in the
  // background, so wait for them.
  const logRows = async (to: string) =>
    (await db.query("select * from sent_email_log where to_address = $1 and sent_at >= $2 order by sent_at", [to, logStart])).rows as Record<string, unknown>[];
  const waitRows = async (to: string, n: number) => {
    for (let i = 0; i < 40; i++) {
      const r = await logRows(to);
      if (r.length >= n) return r;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    return logRows(to);
  };
  const [okRow] = await waitRows("someone@example.com", 1);
  check("D7", "a sent email is recorded", okRow?.status === "sent" && okRow.channel === "Amazon SES" && okRow.kind === "template");
  check("D7", "with which email it was", okRow?.label === "Delivery check" && okRow.template_key === "verify_email" && okRow.subject === "Delivery check");
  check("D7", "and the channel's message id", typeof okRow?.message_id === "string" && okRow.message_id.includes("check-message-id"), String(okRow?.message_id));
  check("D7", "the email's content isn't stored", !JSON.stringify(okRow ?? {}).includes("<p>Hi</p>") && !("html" in (okRow ?? {})));
  const xRows = await waitRows("x@example.com", 1);
  const failRow = xRows.find((r) => r.label === "Reject check");
  check("D7", "a failed email is recorded with the channel's reason", failRow?.status === "failed" && /not verified/.test(String(failRow?.error)));
  check("D7", "the error holds no key or secret", !!failRow && !String(failRow.error).includes(FAKE_ID_BODY) && !String(failRow.error).includes(SECRET_MARKER));
  check("D7", "\"email isn't set up\" isn't recorded (nothing reached a channel)", !xRows.some((r) => r.label === "Not set up check"));

  // Put the secret back for the rest.
  await db.query("update email_delivery set ses_secret_ciphertext = $1 where id = 'app'", [ciphertext]);
  const [someone] = (await db.query(`select id, email from "user" order by created_at limit 1`)).rows as { id: string; email: string }[];
  if (someone) {
    await sendMailWith("ses", { to: someone.email.toUpperCase(), subject: "s", html: "h", tag: { kind: "test", label: "Account link check" } });
    const [linked] = await waitRows(someone.email.toUpperCase(), 1);
    check("D7", "the row is linked to the account the address belongs to", linked?.user_id === someone.id);
  }
  await sendMailWith("ses", {
    to: "gone-broadcast@example.com",
    subject: "s",
    html: "h",
    tag: { kind: "broadcast", label: "Deleted broadcast check", broadcastId: "00000000-0000-4000-8000-000000000000" },
  });
  const [gone] = await waitRows("gone-broadcast@example.com", 1);
  check("D7", "a broadcast deleted meanwhile still gets its row", gone?.kind === "broadcast" && gone.broadcast_id === null);
  let brokenThrew = false;
  try {
    // A tag the log can't store: the insert fails, the send must not.
    await sendMailWith("ses", { to: "broken-log@example.com", subject: "s", html: "h", tag: { kind: "test" } as never });
  } catch {
    brokenThrew = true;
  }
  check("D7", "a failure to record never fails the send", !brokenThrew);
  const mailerSrc = read("lib/mailer.ts");
  check("D7", "the mailer never waits for the log", mailerSrc.includes("logSentEmail(") && !/await\s+logSentEmail/.test(mailerSrc));
  check("D7", "every send has to say which email it is", /tag: SentEmailTag;/.test(read("lib/email.ts")) && /tag: SentEmailTag;/.test(mailerSrc));
  check("D7", "Data retention trims the log", /sentEmailLogDays/.test(read("lib/retention-model.ts")) && /delete\(sentEmailLog\)/.test(read("lib/retention.ts")));
} finally {
  await restore();
  await new Promise((ok) => setTimeout(ok, 300)); // let any last background insert land
  await db.query("delete from sent_email_log where sent_at >= $1 and lower(to_address) = any($2::text[])", [logStart, logAddresses]);
  await new Promise<void>((r) => fake.close(() => r()));
}
const after = (await db.query("select * from email_delivery")).rows;
check("D3", "email_delivery is back exactly as it was", JSON.stringify(after) === JSON.stringify(before));
check("D3", "the service in use is unchanged", (await getEmailProvider()) === providerBefore, providerBefore);
const logLeft = (await db.query("select count(*) from sent_email_log where lower(to_address) = any($1::text[]) and sent_at >= $2", [logAddresses, logStart])).rows[0].count;
const logOlder = Number((await db.query("select count(*) from sent_email_log where sent_at < $1", [logStart])).rows[0].count);
check("D7", "the check's log rows are gone and older rows untouched", Number(logLeft) === 0 && logOlder === logCountBefore);
await db.end();

/* ---------------- D6 signed out (HTTP) ---------------- */

if (!APP) {
  console.log("SKIP  D6 signed-out route checks (set APP_URL)");
} else {
  const res = await fetch(`${APP}/jmp-admin/settings?section=email`, { redirect: "manual" });
  const to = res.headers.get("location") ?? "";
  check("D6", "Settings sends a signed-out visitor to the admin sign-in", res.status >= 300 && res.status < 400 && to.includes("/jmp-admin/login"), `${res.status} ${to}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
