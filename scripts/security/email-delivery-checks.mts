// Email delivery checks (SMTP or Amazon SES), run before a deploy (Amazon SES
// phase 4). Run from the repo root against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/email-delivery-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the signed-out HTTP checks.
// Amazon SES is never contacted: the script starts its own stand-in for the SES
// API and points the SDK at it. It saves test SES details (AWS's published
// example key, not a real credential) for a moment and puts back exactly what
// was in email_delivery before. Nothing is ever delivered.
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
const EXAMPLE_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const EXAMPLE_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
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
check("D1", "a temporary ASIA key is refused", !accepts({ accessKeyId: "ASIAIOSFODNN7EXAMPLE" }));
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
  check("D3", "the secret is stored encrypted", !ciphertext.includes("EXAMPLEKEY") && decryptSecret(ciphertext) === EXAMPLE_SECRET);
  const screen = JSON.stringify(await getEmailDelivery());
  check("D3", "the admin screen never gets the secret", !screen.includes("EXAMPLEKEY") && !screen.includes(ciphertext.slice(0, 16)));
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
  });
  const sent = seen.find((r) => r.url.startsWith("/v2/email/outbound-emails"));
  check("D4", "the email went to SES", !!sent);
  const raw = sent ? Buffer.from(JSON.parse(sent.body).Content.Raw.Data, "base64").toString("utf8") : "";
  check("D4", "the request is signed for SES in the saved region", /Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/ap-south-1\/ses\/aws4_request/.test(sent?.auth ?? ""));
  check("D4", "the secret never leaves the server", seen.every((r) => !JSON.stringify(r).includes("EXAMPLEKEY")));
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
  check("D5", "a sandbox rejection is explained", /sandbox/.test(await errorOf(() => sendMailWith("ses", { to: "x@example.com", subject: "s", html: "h" }))));
  mode = "badkey";
  check("D5", "an unknown key is explained", /doesn't recognize/.test(await errorOf(async () => getSesAccount((await getSesCredentials())!))));
  mode = "denied";
  check("D5", "a missing IAM permission names what's needed", /ses:GetAccount/.test(await errorOf(async () => getSesAccount((await getSesCredentials())!))));
  mode = "ok";
  await db.query("update email_delivery set ses_secret_ciphertext = null where id = 'app'");
  let thrown = "";
  try {
    await sendMail({ to: "x@example.com", subject: "s", html: "h" });
  } catch (e) {
    thrown = (e as Error).message;
  }
  check("D5", "SES chosen but incomplete fails instead of falling back to SMTP", thrown === "SMTP_NOT_CONFIGURED", thrown);
  check("D5", "and the switch would refuse SES now", (await providersReady()).ses === false);
} finally {
  await restore();
  await new Promise<void>((r) => fake.close(() => r()));
}
const after = (await db.query("select * from email_delivery")).rows;
check("D3", "email_delivery is back exactly as it was", JSON.stringify(after) === JSON.stringify(before));
check("D3", "the service in use is unchanged", (await getEmailProvider()) === providerBefore, providerBefore);
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
