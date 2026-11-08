// Email template checks, run before a deploy (email templates phase 4). Run from
// the repo root against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/email-templates-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the signed-out HTTP checks. The
// fallback check saves wording for one email for a moment and puts back exactly
// what was there; everything else only reads. Nothing is ever sent.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  BODY_MAX,
  EMAIL_TEMPLATES,
  SUBJECT_MAX,
  fillTemplate,
  greetingName,
  placeholdersIn,
  sampleValues,
  templateByKey,
  templateProblems,
} from "../../lib/email-templates-model.ts";
import { emailBodyHtml, emailHtmlToText, getTemplateContent, paragraphsBlock, renderTemplate } from "../../lib/email-templates.ts";

const APP = process.env.APP_URL ?? "";
let failures = 0;

function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? `  (${detail})` : ""}`);
}

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    return statSync(p).isDirectory() ? filesUnder(p, ext) : ext.test(name) ? [p] : [];
  });
}

// Windows checkouts get CRLF line endings; the patterns below expect \n.
const read = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const rel = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, "/");

/* ---------------- E1 the registry ---------------- */

const keys = EMAIL_TEMPLATES.map((t) => t.key);
check("E1", "every email has a unique key", new Set(keys).size === keys.length, `${keys.length} emails`);
check(
  "E1",
  "every placeholder key is unique within its email",
  EMAIL_TEMPLATES.every((t) => new Set(t.placeholders.map((p) => p.key)).size === t.placeholders.length),
);
check(
  "E1",
  "every email offers {{app_name}}",
  EMAIL_TEMPLATES.every((t) => t.placeholders.some((p) => p.key === "app_name")),
);

/* ---------------- E2 the built-in wording ---------------- */

for (const def of EMAIL_TEMPLATES) {
  const problems = templateProblems(def, def.defaults);
  check("E2", `built-in wording of "${def.key}" passes its own rules`, problems.length === 0, problems[0]?.message ?? "");
  const cleaned = { ...def.defaults, bodyHtml: emailBodyHtml(def.defaults.bodyHtml) };
  check("E2", `"${def.key}" survives cleaning with its placeholders`, templateProblems(def, cleaned).length === 0);
  const all = [def.defaults.subject, def.defaults.heading, def.defaults.bodyHtml, def.defaults.buttonLabel ?? "", def.defaults.footerNote].join(" ");
  check("E2", `"${def.key}" has no em dashes`, !all.includes("—"));
}

/* ---------------- E3 filling in values ---------------- */

for (const def of EMAIL_TEMPLATES) {
  const r = await renderTemplate(def, sampleValues(def));
  const text = [r.subject, r.heading, r.bodyHtml, r.buttonLabel ?? "", r.footerNote].join(" ");
  check("E3", `"${def.key}" fills every placeholder`, placeholdersIn(text).length === 0, placeholdersIn(text).join(", "));
}
{
  const def = templateByKey("ticket_resolved")!;
  const html = fillTemplate(def, "<p>{{user_name}} {{conversation}}</p>", { user_name: "<img src=x onerror=alert(1)>", conversation: "<div>ok</div>" }, "html");
  check("E3", "plain values are escaped in HTML", html.includes("&lt;img") && !html.includes("<img"));
  check("E3", "block values go in as the sender's HTML", html.includes("<div>ok</div>"));
  check("E3", "{{user_name}} is a first name or \"there\"", greetingName("Priya Sharma") === "Priya" && greetingName("  ") === "there" && greetingName(null) === "there");
  const block = paragraphsBlock("Plan <b>Pro</b>", "", null);
  check("E3", "app-written paragraphs are escaped and empty ones dropped", block.includes("&lt;b&gt;") && (block.match(/<p /g) ?? []).length === 1);
}

/* ---------------- E4 what saving refuses ---------------- */

{
  const def = templateByKey("code_reset_leads")!;
  const has = (c: object, re: RegExp) => templateProblems(def, { ...def.defaults, ...c }).some((p) => re.test(p.message));
  check("E4", "an unknown placeholder is refused", has({ subject: "Hi {{nope}}" }, /isn't available/));
  check("E4", "a missing required placeholder is refused", has({ bodyHtml: "<p>No code here</p>" }, /needs \{\{code\}\}/));
  check("E4", "a block outside the message is refused", has({ subject: "{{code}}" }, /only go in the message/));
  check("E4", "an over-long subject is refused", has({ subject: "x".repeat(SUBJECT_MAX + 1) }, /Keep it under/));
  check("E4", "an over-long message is refused", has({ bodyHtml: `<p>{{code}}${"x".repeat(BODY_MAX)}</p>` }, /Keep it under/));
  check("E4", "an empty subject is refused", has({ subject: "  " }, /can't be empty/));
  const reset = templateByKey("reset_password")!;
  check(
    "E4",
    "an email with a button needs a label",
    templateProblems(reset, { ...reset.defaults, buttonLabel: "" }).some((p) => p.field === "buttonLabel"),
  );
}

/* ---------------- E5 cleaning the message ---------------- */

{
  const out = emailBodyHtml(
    '<p onclick="steal()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a></p><iframe src="https://evil.example"></iframe><style>p{}</style><img src="http://x/a.png">',
  );
  check("E5", "scripts and style blocks are removed", !/<script|<style/i.test(out));
  check("E5", "event handlers are removed", !/onclick/i.test(out));
  check("E5", "javascript: links are removed", !/javascript:/i.test(out));
  check("E5", "iframes from other sites are removed", !/<iframe/i.test(out));
  check("E5", "images that aren't https lose their address", !/src="http:/i.test(out));
  check("E5", "paragraphs get inline styles for email apps", /<p style="margin:0 0 14px;/.test(out));
  check("E5", "a tag that only starts like a styled one is left alone", emailBodyHtml("<pre>x</pre>").startsWith("<pre>"));
  const text = emailHtmlToText('<p>One &amp; two</p><ul><li>a</li><li>b</li></ul><table><tr><td>K</td><td>V</td></tr></table>');
  check("E5", "the plain-text part keeps paragraphs, list items and table rows", text === "One & two\n- a\n- b\n\nK V", JSON.stringify(text));
}

/* ---------------- E6 every automatic email goes through a template ---------------- */

const SENDER_EXCEPTIONS = new Set([
  "lib/email.ts", // defines it
  "lib/email-templates.ts", // the template sender itself
  "lib/broadcasts-send.ts", // broadcasts are written per send
  "actions/admin-broadcasts.ts", // the broadcast test email
  "actions/admin-settings.ts", // the SMTP test email
  "actions/admin-email-delivery.ts", // the Amazon SES test email
]);
const sources = ["lib", "actions", "app", "components"].flatMap((d) => filesUnder(d, /\.(ts|tsx)$/));
const bypass = sources.filter((f) => !SENDER_EXCEPTIONS.has(rel(f)) && /\bsendAppEmail\s*\(|\bsendMail\s*\(/.test(read(f)) && rel(f) !== "lib/mailer.ts");
check("E6", "nothing sends email around the templates", bypass.length === 0, bypass.map(rel).join(", "));
// A key counts as sent when a file that calls sendTemplateEmail names it.
const senderSource = sources
  .filter((f) => !rel(f).startsWith("lib/email-templates") && rel(f) !== "actions/admin-email-templates.ts")
  .map(read)
  .filter((s) => s.includes("sendTemplateEmail("))
  .join("\n");
for (const key of keys) check("E6", `"${key}" has a sender`, senderSource.includes(`"${key}"`));
{
  const actions = read("actions/admin-email-templates.ts");
  const exported = [...actions.matchAll(/export async function (\w+)\([^]*?\{\n([^]*?)\n\}/g)];
  check(
    "E6",
    "every Email templates action checks for an admin first",
    exported.length >= 4 && exported.every((m) => /^\s*const adminId = await requireAdmin\(\);/.test(m[2])),
    `${exported.length} actions`,
  );
}

/* ---------------- E7 saved wording and the fallback (database) ---------------- */

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
{
  const def = templateByKey("deletion_canceled")!;
  const before = (await db.query("select key, content, updated_by, updated_at from email_templates where key = $1", [def.key])).rows[0];
  try {
    await db.query(
      "insert into email_templates (key, content) values ($1, $2) on conflict (key) do update set content = excluded.content",
      [def.key, { ...def.defaults, subject: "Checks: saved subject" }],
    );
    check("E7", "saved wording is what gets sent", (await getTemplateContent(def)).subject === "Checks: saved subject");
    await db.query("update email_templates set content = $2 where key = $1", [def.key, { ...def.defaults, subject: "Broken {{nope}}" }]);
    const warn = console.warn;
    console.warn = () => {};
    const fallback = await getTemplateContent(def);
    console.warn = warn;
    check("E7", "unusable saved wording falls back to the built-in wording", fallback.subject === def.defaults.subject);
    await db.query("update email_templates set content = $2 where key = $1", [def.key, { subject: 1 }]);
    console.warn = () => {};
    const garbled = await getTemplateContent(def);
    console.warn = warn;
    check("E7", "saved wording of the wrong shape falls back too", garbled.subject === def.defaults.subject);
  } finally {
    if (before) {
      await db.query("update email_templates set content = $2, updated_by = $3, updated_at = $4 where key = $1", [
        before.key,
        before.content,
        before.updated_by,
        before.updated_at,
      ]);
    } else {
      await db.query("delete from email_templates where key = $1", [def.key]);
    }
  }
  const after = (await db.query("select key, content, updated_by, updated_at from email_templates where key = $1", [def.key])).rows[0];
  check("E7", "the check put back exactly what was there", JSON.stringify(after) === JSON.stringify(before));
}
{
  const over = await db.query(
    "select template_key, count(*)::int as n from email_template_versions group by template_key having count(*) > 5",
  );
  check("E7", "no email keeps more than 5 earlier versions", over.rowCount === 0, over.rows.map((r) => r.template_key).join(", "));
  const unknown = await db.query("select key from email_templates where not (key = any($1))", [keys]);
  check("E7", "every saved row belongs to a known email", unknown.rowCount === 0, unknown.rows.map((r) => r.key).join(", "));
}
await db.end();

/* ---------------- E8 signed out (HTTP) ---------------- */

if (!APP) {
  console.log("SKIP  E8 signed-out route checks (set APP_URL)");
} else {
  for (const p of ["/jmp-admin/email-templates", "/jmp-admin/email-templates/reset_password"]) {
    const res = await fetch(`${APP}${p}`, { redirect: "manual" });
    const to = res.headers.get("location") ?? "";
    check("E8", `${p} sends a signed-out visitor to the admin sign-in`, res.status >= 300 && res.status < 400 && to.includes("/jmp-admin/login"), `${res.status} ${to}`);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
