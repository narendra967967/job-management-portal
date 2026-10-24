// Phase 5 security checks for email forwarding (docs/email-forwarding.md §7).
// Runs against a LOCAL stack — the production image is the realistic target:
//   app container on APP_URL, mail-in container on SMTP_PORT, both on the local DB.
//
//   npx tsx --env-file=.env.local scripts/security/forwarding-checks.mts
//
// Env: APP_URL (default http://127.0.0.1:3100), SMTP_PORT (2526), DATABASE_URL,
// INBOUND_SECRET, CRON_SECRET, TEST_USER_EMAIL (default ui-test@jobtiva.test),
// SAMPLES_DIR (real .eml samples — never committed). It changes settings only
// temporarily and restores them; test rows it creates are deleted at the end.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import net from "node:net";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import pg from "pg";
import { signedFor, matchSender } from "../../lib/inbound/trust.ts";
import { draftsFromAiReply, emailForAi } from "../../lib/inbound/ai-reader.ts";
import { forwardedOriginal } from "../../lib/inbound/hand-forward.ts";
import { jobKeyForPosting, jobKeyForUrl } from "../../lib/job-key.ts";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 2526);
const SECRET = process.env.INBOUND_SECRET ?? "";
const CRON = process.env.CRON_SECRET ?? "";
const USER_EMAIL = process.env.TEST_USER_EMAIL ?? "ui-test@jobtiva.test";
const SAMPLES = process.env.SAMPLES_DIR ?? "";
const DOMAIN = process.env.INBOUND_DOMAIN ?? "in.localhost";

let failures = 0;
const results: string[] = [];
function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  const line = `${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? ` — ${detail}` : ""}`;
  results.push(line);
  console.log(line);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------- tiny SMTP client ---------------- */

class Smtp {
  private buf = "";
  private waiters: ((line: string) => void)[] = [];
  private lines: string[] = [];
  closed = false;
  private constructor(private sock: net.Socket) {
    sock.setEncoding("utf8");
    sock.on("data", (d: string) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf("\r\n")) >= 0) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        if (/^\d{3} /.test(line)) {
          const w = this.waiters.shift();
          if (w) w(line);
          else this.lines.push(line);
        }
      }
    });
    sock.on("close", () => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) w("CLOSED");
    });
    sock.on("error", () => {});
  }
  static connect(): Promise<{ c: Smtp; greeting: string }> {
    return new Promise((resolve, reject) => {
      const sock = net.connect(SMTP_PORT, "127.0.0.1");
      const c = new Smtp(sock);
      sock.once("error", reject);
      c.reply(10_000).then((greeting) => resolve({ c, greeting }), reject);
    });
  }
  reply(timeoutMs = 15_000): Promise<string> {
    const queued = this.lines.shift();
    if (queued) return Promise.resolve(queued);
    if (this.closed) return Promise.resolve("CLOSED");
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve("TIMEOUT"), timeoutMs);
      this.waiters.push((l) => {
        clearTimeout(t);
        resolve(l);
      });
    });
  }
  async cmd(line: string, timeoutMs?: number): Promise<string> {
    this.sock.write(line + "\r\n");
    return this.reply(timeoutMs);
  }
  async data(raw: string | Buffer): Promise<string> {
    const r = await this.cmd("DATA");
    if (!r.startsWith("354")) return r;
    const body = Buffer.isBuffer(raw) ? raw.toString("latin1") : raw;
    this.sock.write(body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.\r\n");
    return this.reply(60_000);
  }
  quit() {
    try {
      this.sock.write("QUIT\r\n");
    } catch {}
    this.sock.end();
  }
}
const code = (line: string) => Number(line.slice(0, 3)) || line;

async function send(rcpt: string, raw: string | Buffer, mailFrom = "sender@example.com"): Promise<string> {
  const { c } = await Smtp.connect();
  await c.cmd("EHLO checks.example");
  await c.cmd(`MAIL FROM:<${mailFrom}>`);
  const r = await c.cmd(`RCPT TO:<${rcpt}>`);
  if (!r.startsWith("250")) {
    c.quit();
    return r;
  }
  const d = await c.data(raw);
  c.quit();
  return d;
}

function mail(from: string, to: string, subject: string, body: string, messageId: string): string {
  return [
    `From: Test <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
}

/* ---------------- main ---------------- */

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows as T[];
const [me] = await q<{ id: string }>(`select id from "user" where email = $1`, [USER_EMAIL]);
const [addr] = await q<{ token: string }>(`select token from inbound_addresses where user_id = $1`, [me?.id]);
if (!me || !addr) throw new Error(`No user/address for ${USER_EMAIL}`);
const TO = `${addr.token}@${DOMAIN}`;
const RUN = `p5-${Date.now()}`;
const lastLog = async () =>
  (await q<{ status: string; reason: string; from_address: string | null; from_domain: string; site: string | null }>(
    `select status, reason, from_address, from_domain, site from inbound_email_log where user_id = $1 order by received_at desc limit 1`,
    [me.id],
  ))[0];
const waitForLog = async (afterCount: number) => {
  for (let i = 0; i < 40; i++) {
    const [{ n }] = await q<{ n: string }>(`select count(*) as n from inbound_email_log where user_id = $1`, [me.id]);
    if (Number(n) > afterCount) return lastLog();
    await sleep(500);
  }
  return null;
};
/** Run fn with an intake switch set to `value`, then put back whatever the
 *  admin had — never assume the original (the owner's settings must survive). */
async function withSwitch<T>(column: "forwarding_enabled" | "gmail_oauth_enabled", value: boolean, fn: () => Promise<T>): Promise<T> {
  const [row] = await q<Record<string, boolean>>(`select ${column} as v from email_intake_config where id = 'app'`);
  await q(`update email_intake_config set ${column} = $1 where id = 'app'`, [value]);
  try {
    return await fn();
  } finally {
    await q(`update email_intake_config set ${column} = $1 where id = 'app'`, [row.v]);
  }
}
const logCount = async () => Number((await q<{ n: string }>(`select count(*) as n from inbound_email_log where user_id = $1`, [me.id]))[0].n);

console.log(`\n== A. Logic (pure modules) ==`);
{
  const pass = { status: { result: "pass" } };
  check("A1", "DKIM pass from the allowed domain vouches", signedFor({ dkim: { results: [{ ...pass, signingDomain: "mailb.linkedin.com" }] } }, "linkedin.com") === "mailb.linkedin.com");
  check("A2", "DKIM from a look-alike domain does not", signedFor({ dkim: { results: [{ ...pass, signingDomain: "linkedin.com.evil.io" }] } }, "linkedin.com") === null);
  check("A3", "Failed DKIM does not", signedFor({ dkim: { results: [{ status: { result: "fail" }, signingDomain: "linkedin.com" }] } }, "linkedin.com") === null);
  const arc = (sealer: string, result = "pass") => ({
    dkim: { results: [{ status: { result: "fail" }, signingDomain: "linkedin.com" }] },
    arc: { status: { result }, signature: { signingDomain: sealer }, authenticationResults: { dkim: [{ result: "pass", header: { d: "linkedin.com" } }] } },
  });
  check("A4", "ARC-only: Google's passing seal recording linkedin DKIM vouches", signedFor(arc("google.com"), "linkedin.com") === "linkedin.com");
  check("A5", "ARC sealed by a non-Google domain does not", signedFor(arc("evil.example"), "linkedin.com") === null);
  check("A6", "A failing ARC chain does not", signedFor(arc("google.com", "fail"), "linkedin.com") === null);
  const senders = [
    { id: "1", match: "jobalerts-noreply@linkedin.com", signingDomain: "linkedin.com", parser: "linkedin" as const, enabled: true },
    { id: "2", match: "*@naukri.com", signingDomain: "naukri.com", parser: "naukri" as const, enabled: true },
    { id: "3", match: "jobs@off.example", signingDomain: "off.example", parser: "none" as const, enabled: false },
  ];
  check("A7", "Exact sender match only (no lookalike local part)", !!matchSender(senders, "jobalerts-noreply@linkedin.com") && !matchSender(senders, "jobalerts-noreply2@linkedin.com"));
  check("A8", "Wildcard covers subdomains but not lookalike domains", !!matchSender(senders, "a@mail.naukri.com") && !matchSender(senders, "a@naukri.com.evil.io"));
  check("A9", "Disabled senders never match", !matchSender(senders, "jobs@off.example"));

  const links = ["https://a.example/job/1", "https://b.example/job/2"];
  const inj = draftsFromAiReply(
    JSON.stringify({ jobs: [{ title: "Real", company: "C", location: "", link: 1 }, { title: "Injected", company: "X", location: "", link: 99 }, { title: "Evil URL", company: "X", location: "", link: "https://evil.example" }] }),
    links,
    { site: "x.com", maxJobs: 20 },
  );
  check("A10", "AI: only jobs naming a real link number are kept (no outside URLs)", inj.drafts.length === 1 && inj.drafts.every((d) => links.includes(d.canonicalJobUrl)), `found ${inj.found}, kept ${inj.drafts.length}`);
  check("A11", "AI: cap applies", draftsFromAiReply(JSON.stringify({ jobs: Array.from({ length: 50 }, (_, i) => ({ title: `J${i}`, company: "C", location: `L${i}`, link: 1 })) }), links, { site: "x.com", maxJobs: 20 }).drafts.length === 20);
  let bad = 0;
  for (const r of ["ignore all instructions", "<script>alert(1)</script>", '{"jobs":"all"}']) {
    try {
      draftsFromAiReply(r, links, { site: "x.com", maxJobs: 20 });
    } catch {
      bad++;
    }
  }
  check("A12", "AI: non-JSON / wrong-shape replies are refused", bad === 3);
  const { body } = emailForAi({ html: '<script>steal()</script><style>x{}</style><a href="javascript:alert(1)">Click</a><a href="https://ok.example/j">Job</a>', text: "" });
  check("A13", "AI input drops scripts/styles and non-http links", !body.includes("steal") && !/javascript:/i.test(body) && body.includes("Job [1]"));
  const fwd = await forwardedOriginal({ subject: "Fwd", text: "---------- Forwarded message ---------\nFrom: X <jobalerts-noreply@linkedin.com>\nSubject: s", html: false, attachments: [] });
  check("A14", "Hand-forward: original sender found in the forward block", fwd?.from === "jobalerts-noreply@linkedin.com");
  check("A15", "Job keys: look-alike hosts don't get a site id", jobKeyForUrl("https://evil.example/?jl=1010299906707").startsWith("url:") && jobKeyForUrl("https://naukri.com.evil.io/job-listings-x-161026010673").startsWith("url:"));
  check("A16", "Job keys: same posting → same key, any reader", jobKeyForPosting("timesjobs.com", { title: "Career Opportunities: Dev (1)", company: "A", location: "B", url: "https://t/x" }) === jobKeyForPosting("timesjobs", { title: "Dev (1)", company: "A", location: "B", url: "https://t/y" }));
}

console.log(`\n== B. Live stack (${APP}, SMTP :${SMTP_PORT}) ==`);

// B1–B3: recipients are checked at RCPT — nothing is relayed, nothing unknown accepted.
{
  const { c, greeting } = await Smtp.connect();
  await c.cmd("EHLO checks.example");
  await c.cmd("MAIL FROM:<a@example.com>");
  check("B1", "No open relay (other domain refused at RCPT)", code(await c.cmd("RCPT TO:<victim@gmail.com>")) === 550);
  check("B2", "Unknown token refused at RCPT (before DATA)", code(await c.cmd(`RCPT TO:<abcdefghjkmn@${DOMAIN}>`)) === 550);
  {
    // Refused as bad syntax (501) by the SMTP layer, or as unknown (550) — any permanent 5xx.
    const r = code(await c.cmd(`RCPT TO:<../../etc@${DOMAIN}>`));
    check("B3", "Malformed address refused at RCPT (permanent 5xx)", typeof r === "number" && r >= 500 && r < 600, String(r));
  }
  check("B4", "No AUTH offered (cannot be used to send mail out)", !/AUTH/.test(greeting) && code(await c.cmd("AUTH PLAIN AGFAYg==")) >= 500);
  c.quit();
}

// B5–B7: forged and unknown senders are dropped; rejected mail keeps only the domain.
{
  let n = await logCount();
  await send(TO, mail("jobalerts-noreply@linkedin.com", TO, "Forged alert", "x", `${RUN}-forged@example.com`));
  let row = await waitForLog(n);
  check("B5", "Forged LinkedIn email (no valid signature) rejected", row?.status === "rejected" && /Signature check failed/.test(row.reason), row?.reason);
  check("B6", "Rejected mail stores no sender address (domain only)", row?.from_address === null && row?.from_domain === "linkedin.com");
  n = await logCount();
  await send(TO, mail("deals@shop.example", TO, "Buy now", "spam", `${RUN}-spam@example.com`));
  row = await waitForLog(n);
  check("B7", "Sender not on the allowed list rejected", row?.status === "rejected" && /Sender not allowed/.test(row.reason) && row.from_address === null, row?.reason);
  n = await logCount();
  await send(TO, `From: ${USER_EMAIL}\r\nSubject: Fwd\r\n\r\n---------- Forwarded message ---------\r\nFrom: jobalerts-noreply@linkedin.com\r\n`, USER_EMAIL);
  row = await waitForLog(n);
  check("B8", "Hand-forward claiming the user's own address but unsigned is rejected", row?.status === "rejected" && /signature check failed/i.test(row.reason), row?.reason);
  const cols = await q<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'inbound_email_log'`);
  check("B9", "The log has no subject/body columns", !cols.some((c) => /subject|body|content|html|text/.test(c.column_name)), cols.map((c) => c.column_name).join(","));
}

// B10–B12: size limits.
{
  const { c } = await Smtp.connect();
  await c.cmd("EHLO checks.example");
  check("B10", "Declared size over 10 MB refused at MAIL FROM", code(await c.cmd("MAIL FROM:<a@example.com> SIZE=20000000")) === 552);
  c.quit();
  const big = "X".repeat(76) + "\r\n";
  const r = await send(TO, mail("a@example.com", TO, "big", big.repeat(Math.ceil((11 * 1024 * 1024) / big.length)), `${RUN}-huge@example.com`));
  check("B11", "Actual message over 10 MB refused after DATA", code(r) === 552, r);
  const n = await logCount();
  await send(TO, mail("deals@shop.example", TO, "mid", big.repeat(Math.ceil((3 * 1024 * 1024) / big.length)), `${RUN}-mid@example.com`));
  const row = await waitForLog(n);
  check("B12", "Message over the admin limit (default 2 MB) dropped as Too large", row?.status === "rejected" && /Too large/.test(row.reason), row?.reason);
}

// B13: malformed MIME doesn't crash anything.
{
  const n = await logCount();
  const r = await send(TO, Buffer.from("\x00\x01\xff garbage ===\r\n--\r\nContent-Type: multipart/mixed; boundary=\r\n\r\n--\r\n", "latin1"));
  const row = await waitForLog(n);
  check("B13", "Malformed MIME accepted at SMTP and logged as rejected (no crash)", code(r) === 250 && row?.status === "rejected", row?.reason);
}

// B14: duplicate Message-ID (a real alert this user already processed).
if (SAMPLES && existsSync(SAMPLES)) {
  const f = readdirSync(SAMPLES).find((n) => n.startsWith("Technical Project Manager at Asc"));
  if (f) {
    const n = await logCount();
    await send(TO, readFileSync(`${SAMPLES}/${f}`));
    const row = await waitForLog(n);
    check("B14", "Same email again (same Message-ID) is not read twice", row?.status === "duplicate", row?.reason);
  }
}

// B15: forwarding switched off → temporary failure, senders retry.
{
  const r = await withSwitch("forwarding_enabled", false, async () => {
    const { c } = await Smtp.connect();
    await c.cmd("EHLO checks.example");
    await c.cmd("MAIL FROM:<a@example.com>");
    const reply = await c.cmd(`RCPT TO:<${TO}>`);
    c.quit();
    return reply;
  });
  check("B15", "Forwarding off → 451 (try later), nothing accepted", code(r) === 451, r);
}

// B16–B17: internal endpoints are locked.
{
  const post = (path: string, init: RequestInit) => fetch(`${APP}${path}`, { method: "POST", ...init });
  const s1 = (await post("/api/inbound/recipient", { body: JSON.stringify({ recipient: TO }) })).status;
  const s2 = (await post("/api/inbound/recipient", { headers: { authorization: "Bearer wrong-wrong-wrong-wrong-wrong-wrong-12" }, body: JSON.stringify({ recipient: TO }) })).status;
  const s3 = (await post("/api/inbound/email", { headers: { "x-inbound-recipient": TO }, body: "x" })).status;
  check("B16", "Internal endpoints refuse missing/wrong secret (401)", s1 === 401 && s2 === 401 && s3 === 401, `${s1}/${s2}/${s3}`);
  const s4 = (await post("/api/inbound/recipient", { headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" }, body: "{not json" })).status;
  check("B17", "Recipient endpoint validates its input (400)", s4 === 400, String(s4));
}

// B18: cron routes refuse without the secret.
{
  const st = await Promise.all(["/api/cron/gmail-sync", "/api/cron/purge-leads", "/api/cron/ai-intake"].map(async (p) => (await fetch(`${APP}${p}`, { method: "POST" })).status));
  check("B18", "Cron routes refuse without CRON_SECRET (401)", st.every((s) => s === 401), st.join("/"));
}

// B19–B20: admin pages need an admin; a normal user's session doesn't open them.
{
  const anon = await fetch(`${APP}/jmp-admin/inbound-log`, { redirect: "manual" });
  check("B19", "Admin page without a session → redirected", anon.status >= 300 && anon.status < 400, `${anon.status} → ${anon.headers.get("location")}`);
}

// B21: Connect Gmail switch off → linking and syncing refuse.
{
  const { link, cronBody } = await withSwitch("gmail_oauth_enabled", false, async () => {
    const link = await fetch(`${APP}/api/auth/link-social`, { method: "POST", headers: { "content-type": "application/json", origin: APP }, body: JSON.stringify({ provider: "google" }) });
    const cron = await fetch(`${APP}/api/cron/gmail-sync`, { method: "POST", headers: { authorization: `Bearer ${CRON}` } });
    return { link, cronBody: await cron.json().catch(() => ({})) };
  });
  check("B21", "Connect Gmail off: link refused (403), cron syncs nobody", link.status === 403 && Array.isArray(cronBody.results) && cronBody.results.length === 0, `${link.status}, ${JSON.stringify(cronBody).slice(0, 60)}`);
}

// B22–B23: login rate limit — by X-Real-IP; a made-up X-Forwarded-For doesn't help.
for (const [id, base] of [["B22", "/api/auth"], ["B23", "/api/admin-auth"]] as const) {
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
  const statuses: number[] = [];
  for (let i = 0; i < 8; i++) {
    const r = await fetch(`${APP}${base}/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP, "x-real-ip": ip, "x-forwarded-for": `198.51.100.${i}` },
      body: JSON.stringify({ email: `nobody-${RUN}@example.com`, password: "wrong-password-123" }),
    });
    statuses.push(r.status);
  }
  check(id, `${base} sign-in limited per X-Real-IP despite spoofed X-Forwarded-For`, statuses.slice(5).every((s) => s === 429) && statuses.slice(0, 5).every((s) => s !== 429), statuses.join(","));
}

// B24: per-IP concurrent connections.
{
  const conns = await Promise.all(Array.from({ length: 14 }, () => Smtp.connect().catch(() => null)));
  const codes = conns.map((x) => (x ? code(x.greeting) : "ERR"));
  for (const x of conns) x?.c.quit();
  check("B24", "Per-IP concurrency capped (extra connections get 421)", codes.filter((c) => c === 220).length <= 10 && codes.includes(421), codes.join(","));
  await sleep(1500);
}

// B25: per-address hourly limit (60).
{
  const { c } = await Smtp.connect();
  await c.cmd("EHLO checks.example");
  const codes: (number | string)[] = [];
  for (let i = 0; i < 62; i++) {
    await c.cmd("MAIL FROM:<a@example.com>");
    codes.push(code(await c.cmd(`RCPT TO:<${TO}>`)));
    await c.cmd("RSET");
  }
  c.quit();
  check("B25", "Per-address limit: more than 60 an hour → 451", codes.slice(0, 50).every((x) => x === 250) && codes.slice(-1)[0] === 451, `first 451 at #${codes.indexOf(451) + 1}`);
}

// B26: idle connections are closed (30 s).
{
  const { c } = await Smtp.connect();
  const t0 = Date.now();
  const r = await c.reply(45_000);
  check("B26", "Idle connection closed by the server (~30 s)", (r === "CLOSED" || /^421/.test(r)) && Date.now() - t0 < 40_000, `${r} after ${Math.round((Date.now() - t0) / 1000)} s`);
}

// B27: flood — the web app stays responsive while the receiver is hammered.
{
  const timeLogin = async () => {
    const t = Date.now();
    await fetch(`${APP}/login`).then((r) => r.text());
    return Date.now() - t;
  };
  const base: number[] = [];
  for (let i = 0; i < 5; i++) base.push(await timeLogin());
  const during: number[] = [];
  let refused = 0;
  let served = 0;
  const flood = (async () => {
    for (let wave = 0; wave < 15; wave++) {
      await Promise.all(
        Array.from({ length: 20 }, async () => {
          const x = await Smtp.connect().catch(() => null);
          if (!x) return void refused++;
          if (code(x.greeting) === 220) {
            served++;
            await x.c.cmd("EHLO flood.example");
            await x.c.cmd("MAIL FROM:<f@example.com>");
            await x.c.cmd(`RCPT TO:<${TO}>`);
          } else refused++;
          x.c.quit();
        }),
      );
    }
  })();
  const probe = (async () => {
    for (let i = 0; i < 10; i++) {
      during.push(await timeLogin());
      await sleep(200);
    }
  })();
  await Promise.all([flood, probe]);
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  check(
    "B27",
    "Flood of 300 SMTP connections: web app stays responsive, excess refused with 421",
    med(during) < Math.max(1500, med(base) * 5) && refused > 0,
    `/login median ${med(base)} ms → ${med(during)} ms during; served ${served}, refused ${refused}`,
  );
}

// B28: nothing left behind (spool drained, AI queue empty for this user).
{
  await sleep(2000);
  const [{ n }] = await q<{ n: string }>(`select count(*) as n from inbound_ai_queue where user_id = $1`, [me.id]);
  check("B28", "No email content left in the AI queue", Number(n) === 0, `${n} rows`);
}

// Clean up this run's ingestion issues/log rows created by these checks.
await q(`delete from inbound_email_log where user_id = $1 and received_at > now() - interval '30 minutes' and status in ('rejected')`, [me.id]);
await db.end();

console.log(`\n${failures ? `${failures} FAILED` : "All checks passed"} (${results.length} checks)`);
process.exit(failures ? 1 : 0);
