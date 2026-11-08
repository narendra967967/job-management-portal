// Admin knowledge base checks, run before a deploy (knowledge base phase 7).
// Read-only: it searches, parses and fetches, and never calls the AI or writes
// to the database. Run from the repo root against the local stack, after a
// sync so the database holds the current articles:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/kb-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3100, the production build) adds the
// signed-out checks on every knowledge base route.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseKbFile } from "../../lib/kb-files.ts";
import { searchKb } from "../../lib/kb-search.ts";

const APP = process.env.APP_URL ?? "";
let failures = 0;

function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? `  (${detail})` : ""}`);
}

function filesUnder(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p, ext) : ext.test(name) ? [p] : [];
  });
}

/* ---------------- K1 access ---------------- */

// Every page and every exported action checks for an admin session first.
for (const f of filesUnder("app/jmp-admin/(panel)/knowledge-base", /\.tsx$/)) {
  check("K1", `admin check in ${f}`, readFileSync(f, "utf8").includes("requireAdmin("));
}
{
  // Windows checkouts get CRLF line endings; the pattern below expects \n.
  const src = readFileSync("actions/admin-kb.ts", "utf8").replace(/\r\n/g, "\n");
  // The body opens at the "{" ending the signature line; return types hold braces too.
  const actions = [...src.matchAll(/export async function (\w+)\([^]*?\)[^\n]*\{\n([^]*?)\n\}/g)];
  check("K1", "actions found in actions/admin-kb.ts", actions.length >= 7, `${actions.length}`);
  for (const [, name, body] of actions) {
    const first = body.split("\n").find((l) => l.trim())?.trim() ?? "";
    check("K1", `${name} starts with requireAdmin`, /requireAdmin\(\)/.test(first), first.slice(0, 60));
  }
}
if (APP) {
  for (const route of ["", "/articles", "/articles/new", "/unanswered", "/history"]) {
    const url = `${APP}/jmp-admin/knowledge-base${route}`;
    try {
      const res = await fetch(url, { redirect: "manual" });
      const to = res.headers.get("location") ?? "";
      check("K1", `signed out ${route || "/"} goes to admin sign-in`, res.status >= 300 && res.status < 400 && to.includes("/jmp-admin/login"), `${res.status} ${to}`);
    } catch (e) {
      check("K1", `signed out ${route || "/"} reachable`, false, String(e));
    }
  }
} else {
  console.log("SKIP  K1 signed-out route checks (set APP_URL)");
}

/* ---------------- K2 repo articles ---------------- */

const front = (extra: string, body = "Some text.") =>
  `---\ntitle: Test\ncategory: Runbooks\nsummary: A summary.\n${extra}---\n\n${body}\n`;
{
  const hostile = [
    "<script>alert(1)</script>",
    '<img src="x" onerror="alert(1)">',
    "[link](javascript:alert(1))",
    '<iframe src="https://evil.example/"></iframe>',
    '<a href="https://example.com" onclick="alert(1)">x</a>',
  ].join("\n\n");
  const r = parseKbFile("test.md", front("", hostile));
  const html = "error" in r ? "" : r.contentHtml;
  check("K2", "hostile markdown parses", !("error" in r));
  check("K2", "no <script> survives", !/<script/i.test(html));
  check("K2", "no event handlers survive", !/\son\w+=/i.test(html));
  check("K2", "no javascript: links survive", !/javascript:/i.test(html));
  check("K2", "no iframe from an unknown site survives", !/<iframe[^>]*evil\.example/i.test(html));
}
check("K2", "missing summary is refused", "error" in parseKbFile("t.md", "---\ntitle: T\ncategory: Runbooks\n---\n\nText\n"));
check("K2", "unknown category is refused", "error" in parseKbFile("t.md", front("").replace("Runbooks", "Nope")));
check("K2", "over-long summary is refused", "error" in parseKbFile("t.md", front("").replace("A summary.", "x".repeat(241))));

// Every real article parses, and none carries anything shaped like a secret.
const SECRET = /(sk-[a-z0-9_-]{16,}|sk-or-v1|AKIA[0-9A-Z]{12}|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|postgres(ql)?:\/\/[^\s<]*:[^\s<]*@|(password|secret|token)\s*[:=]\s*[A-Za-z0-9+/_-]{12,})/i;
for (const f of filesUnder("docs/knowledge-base", /\.md$/)) {
  const rel = path.relative("docs/knowledge-base", f).split(path.sep).join("/");
  if (rel === "README.md" || path.basename(f).startsWith("_")) continue;
  const raw = readFileSync(f, "utf8");
  const r = parseKbFile(rel, raw);
  check("K2", `${rel} parses`, !("error" in r), "error" in r ? r.error : "");
  check("K2", `${rel} has nothing shaped like a secret`, !SECRET.test(raw));
}

/* ---------------- K3 search input ---------------- */

for (const q of [
  "'; drop table kb_articles; --",
  "a & !b | c:* <-> d",
  "<script>alert(1)</script>",
  "\\' OR 1=1",
  "x ".repeat(250),
  "…  ¿ ünïcödé — 日本語",
]) {
  try {
    const hits = await searchKb(q, 3);
    check("K3", `odd input searches safely: ${JSON.stringify(q.slice(0, 30))}`, Array.isArray(hits));
  } catch (e) {
    check("K3", `odd input searches safely: ${JSON.stringify(q.slice(0, 30))}`, false, String(e).slice(0, 120));
  }
}

/* ---------------- K4 answer quality (search) ---------------- */

// A question should find the article that answers it first; one the knowledge
// base doesn't cover should find nothing. Expected titles are matched loosely.
const answered: [string, string][] = [
  ["A user says their lead disappeared", "stale"],
  ["Why was a lead closed automatically?", "daily automatic lead cleanup"],
  ["How many follow-up reminders does a user get?", "follow-up reminders"],
  ["What does stale mean?", "stale"],
  ["Why did a lead move to Applied by itself?", "moved stage on its own"],
  ["Can a user undo a discard?", "discarding"],
  ["Which leads show in Ready to action?", "which list"],
  ["Why was a user's alert rejected as not from a supported site?", "Email log"],
  ["How does a user forward an alert by hand?", "by hand"],
  ["How do I add a new job site like Instahyre?", "job sites"],
  ["When does AI read a job alert?", "AI reads"],
  ["How do I turn forwarding off for everyone?", "Switching forwarding"],
  ["What happens when a user hits the lead limit?", "limits"],
  ["A user's plan expired, what do they see?", "expires"],
  ["Which plan switches control AI features?", "plan switch"],
  ["How does a user test their AI key?", "AI key"],
  ["Which prompt is used for drafts?", "prompts"],
  ["How do support ticket replies reach the user?", "support tickets"],
  ["A new user never got the verification email", "accounts"],
  ["How does a user delete their account?", "deleting an account"],
  ["How long are notifications kept?", "kept"],
  ["How do I delete very old leads permanently?", "Lead retention"],
  ["Where do I change the app logo?", "admin setting"],
  ["How long does a sign-in last?", "sign-in length"],
  ["How do I roll back a deploy?", "deploy"],
  ["When does the daily cron job run?", "scheduled jobs"],
  ["How do I restore the database from a backup?", "Backups"],
  ["How do I view the app logs on the server?", "Everyday server"],
  ["Nobody can sign in, what do I do?", "reCAPTCHA"],
  ["Why did the knowledge base answer without AI?", "knowledge base agent"],
  ["How do I email all users about planned downtime?", "every user"],
  ["How does a user unsubscribe from promotional emails?", "broadcasts"],
  ["discarding a lead", "discarding"],
  ["leads disappearing from the list", "stale"],
  ["please tell me how to roll back a deploy", "deploy"],
  ["my lead vanished, where did it go?", "stale"],
];
const unanswered = [
  "How do I refund a yearly plan?",
  "How do I export all users to a spreadsheet?",
  "What is the company's office address?",
  "Can I change the color theme to dark mode?",
  "How do I issue an invoice to a customer?",
  "Does Jobtiva integrate with Slack?",
];
for (const [q, expect] of answered) {
  const top = (await searchKb(q, 1))[0];
  check("K4", `finds "${expect}" for: ${q}`, !!top && top.title.toLowerCase().includes(expect.toLowerCase()), top?.title ?? "nothing");
}
for (const q of unanswered) {
  const hits = await searchKb(q, 1);
  check("K4", `finds nothing for: ${q}`, hits.length === 0, hits[0]?.title ?? "");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
