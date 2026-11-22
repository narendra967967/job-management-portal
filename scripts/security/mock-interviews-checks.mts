// Mock interviews safety checks (roadmap R1.7). Runs on the local database,
// with the HTTP checks against a running app (the dev server is fine):
//
//   APP_URL=http://localhost:3000 \
//     node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs \
//       --import tsx scripts/security/mock-interviews-checks.mts
//
// ACTION_MANIFEST defaults to the dev server's .next/server/server-reference-manifest.json;
// point it at a production build's copy to run against that instead. Needs the
// LOCAL_TEST_* accounts (ui-test, ui-admin).
//
// It never reaches OpenAI, Razorpay or a mail server. In this process, outbound
// fetch is replaced by a stand-in (AI replies, Razorpay orders) and email by a
// recorder, so the module key is only ever handed to the stand-in. The HTTP
// checks only make requests that must be refused before any of that happens.
//
// What it changes, all read first and put back exactly at the end: Module
// settings (Open / Coming soon, prices), the Razorpay gateway row (fake keys we
// know the secrets of), the Free plan's allowance, and ui-test's plan. It
// deletes the bookings, payment orders, emails logged and the temporary plan it
// creates. Payment orders can't normally be deleted (a database guard), so
// cleanup uses session_replication_role = replica, which needs the local
// superuser. Prints PASS/FAIL; exits 1 on any FAIL.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import pg from "pg";
import { decryptSecret, encryptSecret } from "../../lib/crypto.ts";
import { bookAiInterview } from "../../lib/mock-interviews/booking.ts";
import { getModuleSettings, settingsSnapshot } from "../../lib/mock-interviews/config.ts";
import { getBookingSetup, getBriefing, getReport, getSession, listBookings, listInterviews } from "../../lib/mock-interviews/data.ts";
import { endInterview, evaluateInterview, heartbeat, startInterview, submitAnswer } from "../../lib/mock-interviews/engine.ts";
import { INDUSTRIES, METRICS, overallScore } from "../../lib/mock-interviews/model.ts";
import { evaluationSchema, parseJsonObject, toWriting } from "../../lib/mock-interviews/prompts.ts";
import { aiPaymentAvailable } from "../../lib/payments/ai-interview-orders.ts";
import { confirmPayment } from "../../lib/payments/orders.ts";
import { db as appDb } from "../../lib/db.ts";
import { paymentOrders } from "../../db/schema.ts";
import { eq } from "drizzle-orm";

const APP = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MANIFEST = process.env.ACTION_MANIFEST ?? ".next/server/server-reference-manifest.json";
const USER = { email: process.env.LOCAL_TEST_EMAIL ?? "", password: process.env.LOCAL_TEST_PASSWORD ?? "" };
const ADMIN = { email: process.env.LOCAL_TEST_ADMIN_EMAIL ?? "", password: process.env.LOCAL_TEST_ADMIN_PASSWORD ?? "" };

const RUN = Math.random().toString(36).slice(2, 8);
const MARK = `SEC check ${RUN}`; // role on every booking this script makes
const OTHER_MARK = `SEC other ${RUN}`; // role on the other account's bookings
const KEY_SECRET = "sec-test-key-secret-not-real";
const WEBHOOK_SECRET = "sec-test-webhook-secret-not-real";
const DAY = 86_400_000;

let failures = 0;
function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? `  (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];

/* ---------------- stand-ins: outbound fetch and email ---------------- */

const realFetch = globalThis.fetch;
const aiReplies: string[] = []; // queued AI reply texts; empty = a reply that isn't JSON
const aiCalls: { url: string; auth: string }[] = [];
const razorpayOrders: { amount: number }[] = [];
const strayCalls: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const host = new URL(url).hostname;
  if (host === "localhost" || host === "127.0.0.1") return realFetch(input, init);
  const headers = new Headers(init?.headers);
  if (/api\.openai\.com|openrouter\.ai|api\.anthropic\.com/.test(host)) {
    aiCalls.push({ url, auth: headers.get("authorization") ?? headers.get("x-api-key") ?? "" });
    const text = aiReplies.shift() ?? "Sorry, I can't help with that.";
    return Response.json({
      choices: [{ message: { content: text } }],
      content: [{ text }],
      usage: { prompt_tokens: 1000, completion_tokens: 200, input_tokens: 1000, output_tokens: 200 },
    });
  }
  if (host === "api.razorpay.com" && /\/orders$/.test(new URL(url).pathname)) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { amount: number; currency: string };
    razorpayOrders.push({ amount: body.amount });
    return Response.json({ id: `order_SEC${RUN}${razorpayOrders.length}`, amount: body.amount, currency: body.currency, status: "created" });
  }
  strayCalls.push(url);
  throw new Error(`blocked outbound call in checks: ${host}`);
}) as typeof fetch;

const sentMail: { to: string; subject: string }[] = [];
// In development, mail to .test addresses is logged instead of sent (lib/email.ts); count those too.
const realInfo = console.info;
console.info = (...args: unknown[]) => {
  const m = /^\[email\] dev: skipped "(.*)" to (.*)$/.exec(String(args[0] ?? ""));
  if (m) sentMail.push({ to: m[2], subject: m[1] });
  realInfo(...args);
};
(nodemailer as unknown as { createTransport: unknown }).createTransport = () => ({
  sendMail: async (m: { to: string; subject: string }) => {
    sentMail.push({ to: String(m.to), subject: String(m.subject) });
    return { messageId: `<sec-${RUN}@local>`, accepted: [m.to], rejected: [] };
  },
  verify: async () => true,
  close: () => {},
});

/* ---------------- HTTP helpers ---------------- */

async function signIn(kind: "user" | "admin", who: { email: string; password: string }, ip: string): Promise<string> {
  const res = await realFetch(`${APP}/api/${kind === "admin" ? "admin-auth" : "auth"}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP, "x-real-ip": ip },
    body: JSON.stringify(who),
  });
  if (!res.ok) throw new Error(`${kind} sign-in failed: ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Server Action ids and a page each one is served from. */
function loadActions(): Map<string, { id: string; page: string }> {
  const out = new Map<string, { id: string; page: string }>();
  const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    node: Record<string, { workers: Record<string, unknown>; exportedName?: string }>;
  };
  for (const [id, entry] of Object.entries(m.node)) {
    const name = entry.exportedName;
    if (!name || out.has(name)) continue;
    const worker = Object.keys(entry.workers).find((w) => w.startsWith("app/") && !w.includes("[")) ?? Object.keys(entry.workers)[0] ?? "";
    const page =
      (
        "/" +
        worker
          .replace(/^app\//, "")
          .replace(/\/page$/, "")
          .split("/")
          .filter((s) => !/^\(.*\)$/.test(s))
          .join("/")
      ).replace(/\/$/, "") || "/";
    out.set(name, { id, page });
  }
  return out;
}
let ACTIONS = loadActions();

interface ActionResult {
  status: number;
  body: string;
  value: unknown;
}

async function post(name: string, body: BodyInit, cookie: string, contentType?: string): Promise<ActionResult> {
  const a = ACTIONS.get(name);
  if (!a) throw new Error(`action ${name} not in manifest`);
  const res = await realFetch(`${APP}${a.page}`, {
    method: "POST",
    redirect: "manual",
    headers: { "next-action": a.id, accept: "text/x-component", origin: APP, cookie, ...(contentType ? { "content-type": contentType } : {}) },
    body,
  });
  const text = await res.text();
  let value: unknown = undefined;
  const row = text.split("\n").find((l) => /^1:/.test(l));
  if (row) {
    try {
      value = JSON.parse(row.slice(2));
    } catch {
      value = row.slice(2);
    }
  }
  return { status: res.status, body: text, value };
}
const action = (name: string, args: unknown[], cookie: string) => post(name, JSON.stringify(args), cookie, "text/plain;charset=UTF-8");

/** An action whose last argument is the booking FormData (encoded as React sends it). */
function formAction(name: string, leading: unknown[], s: Record<string, unknown>, cookie: string) {
  const body = new FormData();
  body.set("_1_setup", JSON.stringify(s));
  body.set("0", JSON.stringify([...leading, "$K1"]));
  return post(name, body, cookie);
}

const val = (r: ActionResult) => (r.value === undefined ? "" : JSON.stringify(r.value));
/** Refused: no normal return value that says ok. */
const refused = (r: ActionResult) => !val(r).includes('"ok":true') && r.value !== true;

async function page(p: string, cookie = "") {
  const res = await realFetch(`${APP}${p}`, { redirect: "manual", headers: { cookie } });
  return { status: res.status, location: res.headers.get("location") ?? "", html: await res.text() };
}

/* ---------------- booking input ---------------- */

const RESUME =
  "Project manager with seven years of experience running delivery for software teams of eight to twenty people. " +
  "Led the move of a billing platform to a new provider over five months, finishing two weeks early. Ran weekly " +
  "planning, kept a single risk log, and reported status to directors. Certified scrum master. Comfortable with Jira, " +
  "Confluence, SQL basics and spreadsheets for budget tracking.";

let CATEGORY = "";
const setup = (over: Record<string, unknown> = {}) => ({
  role: MARK,
  industry: INDUSTRIES[0],
  category: CATEGORY,
  difficulty: "Easy",
  durationMin: 15,
  topics: ["Planning"],
  leadId: null,
  resumeMode: "paste",
  resumeId: null,
  resumeText: RESUME,
  jdMode: "general",
  jdLeadId: null,
  jdText: "",
  ...over,
});
const form = (s: Record<string, unknown>) => {
  const f = new FormData();
  f.set("setup", JSON.stringify(s));
  return f;
};

/* ---------------- snapshots ---------------- */

type Row = Record<string, unknown>;
const colTypes = new Map<string, Map<string, string>>();
async function typesOf(table: string) {
  if (!colTypes.has(table)) {
    const rows = await q<{ column_name: string; data_type: string }>(
      "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1",
      [table],
    );
    colTypes.set(table, new Map(rows.map((r) => [r.column_name, r.data_type])));
  }
  return colTypes.get(table)!;
}
/** Put a row back exactly as it was read (every column but the key). */
async function restoreRow(table: string, key: string, row: Row) {
  const types = await typesOf(table);
  const cols = Object.keys(row).filter((c) => c !== key);
  const values = cols.map((c) => (types.get(c) === "jsonb" || types.get(c) === "json") && row[c] !== null ? JSON.stringify(row[c]) : row[c]);
  await q(`update "${table}" set ${cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ")} where "${key}" = $${cols.length + 1}`, [...values, row[key]]);
}

/* ---------------- static checks ---------------- */

const AUTH_CALLS = ["requireAdmin(", "getCurrentUserId(", "getSessionUser(", "getSessionUserId("];
function unguardedActions(file: string): { total: number; unguarded: string[] } {
  const src = readFileSync(file, "utf8");
  const fns = [...src.matchAll(/^(export )?async function (\w+)/gm)].map((m, i, all) => ({
    exported: !!m[1],
    name: m[2],
    body: src.slice(m.index!, i + 1 < all.length ? all[i + 1].index : src.length),
  }));
  const guards = new Set(fns.filter((fn) => AUTH_CALLS.some((c) => fn.body.includes(c))).map((fn) => fn.name));
  const exported = fns.filter((f) => f.exported);
  const unguarded = exported.filter((fn) => !AUTH_CALLS.some((c) => fn.body.includes(c)) && ![...guards].some((g) => g !== fn.name && fn.body.includes(`${g}(`)));
  return { total: exported.length, unguarded: unguarded.map((f) => f.name) };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* ---------------- main ---------------- */

async function main() {
  const startedAt = new Date();
  const [cfg] = await q("select * from mock_interview_config where id = 'app'");
  const [gw] = await q("select * from payment_gateways where id = 'razorpay'");
  const [u] = await q<{ id: string; email: string } & Row>(`select * from "user" where email = $1`, [USER.email]);
  const [other] = await q<{ id: string }>(`select id from "user" where email <> $1 and role <> 'admin' order by created_at limit 1`, [USER.email]);
  const [freePlan] = await q<{ id: string } & Row>("select * from plans where is_free limit 1");
  if (!cfg || !gw || !u || !other || !freePlan) throw new Error("missing module settings / gateway / test users / Free plan");
  const settings = await getModuleSettings();
  CATEGORY = settings.categories[0];
  const tempPlanIds: string[] = [];

  try {
    await q("update mock_interview_config set ai_state = 'open' where id = 'app'");
    // Payment off unless a check turns it on: the allowance checks must never reach checkout.
    await q("update payment_gateways set enabled = false where id = 'razorpay'");

    // Sign in, and open each page once so a dev server compiles it and lists its actions.
    const userCookie = await signIn("user", USER, "10.9.1.1");
    const adminCookie = await signIn("admin", ADMIN, "10.9.1.2");
    const warmId = "00000000-0000-4000-8000-000000000002";
    for (const p of [
      "/mock-interviews",
      "/mock-interviews/ai",
      "/mock-interviews/ai/new",
      `/mock-interviews/ai/prepare/${warmId}`,
      `/mock-interviews/ai/session/${warmId}`,
      "/mock-interviews/history",
      `/leads/${warmId}`, // a lead's "Prepare for interview" box asks aiInterviewsOpenAction
    ])
      await page(p, userCookie);
    const adminWarm: string[] = [];
    for (const p of ["/jmp-admin/mock-interviews/ai", "/jmp-admin/mock-interviews/settings"]) {
      const r = await page(p, adminCookie);
      adminWarm.push(`${p} ${r.status}${r.location ? ` → ${r.location}` : ""}`);
    }
    const NEEDED = [
      "bookAiInterviewAction",
      "updateAiBookingAction",
      "aiInterviewsOpenAction",
      "startInterviewAction",
      "interviewHeartbeatAction",
      "answerInterviewAction",
      "endInterviewAction",
      "emailAiInterviewReceiptAction",
      "saveModuleSettingsAction",
      "testModuleAiAction",
      "getAiInterviewEventsAction",
      "creditAiInterviewAction",
    ];
    // A dev server writes the manifest as it compiles, so give it a moment.
    for (let i = 0; i < 15; i++) {
      ACTIONS = loadActions();
      if (NEEDED.every((n) => ACTIONS.has(n))) break;
      await sleep(2000);
    }
    const missing = NEEDED.filter((n) => !ACTIONS.has(n));
    if (missing.length) throw new Error(`actions not in the manifest: ${missing.join(", ")} (admin pages: ${adminWarm.join("; ")})`);

    /* ---- A: signed out, and the wrong kind of account ---- */
    for (const f of ["actions/mock-interviews.ts", "actions/admin-mock-interviews.ts"]) {
      const a = unguardedActions(f);
      check("A1", `every action in ${f} checks the session (static scan)`, a.unguarded.length === 0, `${a.total} actions; unguarded: ${a.unguarded.join(", ") || "none"}`);
    }
    check("A2", "action manifest loaded", ACTIONS.has("bookAiInterviewAction") && ACTIONS.has("saveModuleSettingsAction"), `${ACTIONS.size} actions`);

    const fakeId = "00000000-0000-4000-8000-000000000001";
    const candidatePages = [
      "/mock-interviews",
      "/mock-interviews/ai",
      "/mock-interviews/ai/new",
      `/mock-interviews/ai/prepare/${fakeId}`,
      `/mock-interviews/ai/session/${fakeId}`,
      "/mock-interviews/history",
      "/mock-interviews/performance",
      `/mock-interviews/report/${fakeId}`,
    ];
    {
      const bad: string[] = [];
      for (const p of candidatePages) {
        const r = await page(p);
        if (r.status < 300 || r.status >= 400) bad.push(`${p} ${r.status}`);
      }
      check("A3", "signed out → every Mock interviews page redirects", bad.length === 0, bad.join(", ") || `${candidatePages.length} pages`);
    }
    {
      const bad: string[] = [];
      for (const p of ["/jmp-admin/mock-interviews/ai", "/jmp-admin/mock-interviews/settings?section=ai"]) {
        const r = await page(p);
        if (r.status === 200 && /Test connection|ai_key/.test(r.html)) bad.push(`${p} ${r.status}`);
      }
      check("A4", "signed out → admin Mock interviews pages don't render", bad.length === 0, bad.join(", ") || "redirected");
    }
    {
      const names = [
        "aiInterviewsOpenAction",
        "startInterviewAction",
        "interviewHeartbeatAction",
        "answerInterviewAction",
        "endInterviewAction",
        "emailAiInterviewReceiptAction",
        "saveModuleSettingsAction",
        "testModuleAiAction",
        "getAiInterviewEventsAction",
        "creditAiInterviewAction",
      ];
      const leaked: string[] = [];
      for (const n of names) {
        const r = await action(n, [fakeId, "hello"], "");
        if (!refused(r) || /"events"|ai_key|"model"/.test(r.body)) leaked.push(`${n} ${r.status} ${val(r).slice(0, 60)}`);
      }
      const b = await formAction("bookAiInterviewAction", [], setup(), "");
      if (!refused(b)) leaked.push(`bookAiInterviewAction ${val(b).slice(0, 60)}`);
      const [{ n }] = await q<{ n: number }>("select count(*)::int n from ai_interviews where role = $1", [MARK]);
      check("A5", "signed out → every Mock interviews action is refused", leaked.length === 0 && n === 0, leaked.join("; ") || `${names.length + 1} actions, no booking made`);
    }
    {
      const a = await realFetch(`${APP}/api/cron/mock-interviews`, { method: "POST" });
      const b = await realFetch(`${APP}/api/cron/mock-interviews`, { method: "POST", headers: { authorization: "Bearer not-the-secret" } });
      const c = await realFetch(`${APP}/api/cron/mock-interviews`, { method: "GET" });
      check("A6", "interviews cron refuses a missing or wrong secret", a.status === 401 && b.status === 401 && c.status !== 200, `${a.status} / ${b.status} / GET ${c.status}`);
    }

    {
      const r = await action("aiInterviewsOpenAction", [], userCookie);
      check("H1", "signed in, the action call works (sanity)", r.value === true, `${r.status} ${val(r)}`);
    }
    {
      const before = (await q<{ updated_at: Date }>("select updated_at from mock_interview_config where id = 'app'"))[0].updated_at.getTime();
      const leaked: string[] = [];
      const s = await action("saveModuleSettingsAction", [{ section: "availability", aiState: "coming_soon", humanState: "coming_soon" }], userCookie);
      if (!refused(s)) leaked.push(`save ${val(s).slice(0, 60)}`);
      for (const n of ["testModuleAiAction", "getAiInterviewEventsAction", "creditAiInterviewAction"]) {
        const r = await action(n, [n === "creditAiInterviewAction" ? { id: fakeId, note: "a long enough reason" } : fakeId], userCookie);
        if (!refused(r) || /"events"|"model"/.test(r.body)) leaked.push(`${n} ${val(r).slice(0, 60)}`);
      }
      const after = (await q<{ updated_at: Date; ai_state: string }>("select updated_at, ai_state from mock_interview_config where id = 'app'"))[0];
      const adminPage = await page("/jmp-admin/mock-interviews/settings?section=ai", userCookie);
      const pageOk = !(adminPage.status === 200 && /Test connection/.test(adminPage.html));
      check(
        "A7",
        "a candidate account can't use the admin actions or pages",
        leaked.length === 0 && after.updated_at.getTime() === before && after.ai_state === "open" && pageOk,
        leaked.join("; ") || `settings unchanged; admin page ${adminPage.status}`,
      );
    }

    /* ---- B: one user can't reach another's interviews ---- */
    const snap = settingsSnapshot(settings, "Easy");
    const insertInterview = async (userId: string, role: string, status: string, extra: Row = {}) => {
      const cols = { user_id: userId, role, industry: INDUSTRIES[0], category: CATEGORY, difficulty: "Easy", duration_min: 15, topics: ["Planning"], resume_source: "paste", resume_label: "Pasted resume", resume_text: RESUME, job_description_source: "none", coverage: "plan", status, valid_until: new Date(Date.now() + 30 * DAY), settings: JSON.stringify(snap), ...extra };
      const keys = Object.keys(cols);
      const [r] = await q<{ id: string }>(`insert into ai_interviews (${keys.map((k) => `"${k}"`).join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(cols));
      return r.id;
    };
    const otherReady = await insertInterview(other.id, OTHER_MARK, "ready");
    const otherLive = await insertInterview(other.id, OTHER_MARK, "in_progress", { started_at: new Date(Date.now() - 60_000), last_active_at: new Date() });
    const rowOf = async (id: string) => (await q<Row>("select status, started_at, active_seconds, role from ai_interviews where id = $1", [id]))[0];
    const msgCount = async (id: string) => (await q<{ n: number }>("select count(*)::int n from ai_interview_messages where interview_id = $1", [id]))[0].n;
    const liveBefore = await rowOf(otherLive);
    {
      const results = [
        await action("startInterviewAction", [otherReady], userCookie),
        await action("interviewHeartbeatAction", [otherLive], userCookie),
        await action("answerInterviewAction", [otherLive, "My answer"], userCookie),
        await action("endInterviewAction", [otherLive], userCookie),
        await formAction("updateAiBookingAction", [otherReady], setup({ role: "Taken over" }), userCookie),
        await action("emailAiInterviewReceiptAction", [otherReady], userCookie),
      ];
      const ready = await rowOf(otherReady);
      const live = await rowOf(otherLive);
      const untouched =
        ready.status === "ready" && ready.started_at === null && ready.role === OTHER_MARK && live.status === "in_progress" && live.active_seconds === liveBefore.active_seconds && (await msgCount(otherLive)) === 0;
      check(
        "B1",
        "another user's interview can't be started, answered, ended, edited or receipted",
        results.every(refused) && val(results[4]).includes("can't be changed") && untouched && aiCalls.length === 0 && sentMail.length === 0,
        results.map((r) => val(r).slice(0, 40)).join(" | "),
      );
    }
    {
      const leaks: string[] = [];
      for (const p of [`/mock-interviews/ai/prepare/${otherReady}`, `/mock-interviews/ai/session/${otherLive}`, `/mock-interviews/report/${otherReady}`, "/mock-interviews/ai", "/mock-interviews/history"]) {
        const r = await page(p, userCookie);
        if (r.html.includes(OTHER_MARK)) leaks.push(p);
      }
      check("B2", "another user's interviews don't show on any page", leaks.length === 0, leaks.join(", ") || "5 pages");
    }
    {
      const [mine] = await q<{ id: string }>(
        "select e.ai_interview_id id from interview_evaluations e where e.user_id = $1 and e.source = 'ai' and e.status = 'submitted' limit 1",
        [u.id],
      );
      const direct = [
        (await getBriefing(u.id, otherReady)) === null,
        (await getBookingSetup(u.id, otherReady)) === null,
        (await getSession(u.id, otherLive)) === null,
        (await getReport(u.id, otherReady)) === null,
        !(await listBookings(u.id)).some((b) => b.id === otherReady || b.id === otherLive),
        !(await listInterviews(u.id)).some((b) => b.id === otherLive),
        (await heartbeat(u.id, otherLive)) === null,
        !(await startInterview(u.id, otherReady)).ok,
        !(await submitAnswer(u.id, otherLive, "x")).ok,
        !(await endInterview(u.id, otherLive)).ok,
        ...(mine ? [(await getReport(other.id, mine.id)) === null, (await getReport(u.id, mine.id)) !== null] : []),
      ];
      check("B3", "the data layer scopes every read and change to the owner", direct.every(Boolean) && aiCalls.length === 0, `${direct.filter(Boolean).length}/${direct.length}${mine ? "" : " (no report of ui-test's to try)"}`);
    }

    /* ---- C: the allowance can't be bypassed or spent twice ---- */
    const [tempPlan] = await q<{ id: string; name: string }>(
      "insert into plans (name, code, is_free, status, show_on_pricing, ai_interviews_included) values ($1, $2, false, 'inactive', false, 1) returning id, name",
      [`SEC plan ${RUN}`, `sec-${RUN}`],
    );
    tempPlanIds.push(tempPlan.id);
    const periodEnd = new Date(Date.now() + 20 * DAY);
    await q(`update "user" set plan_id = $1, plan_expires_at = $2 where id = $3`, [tempPlan.id, periodEnd, u.id]);
    const planRows = async () =>
      (await q<{ n: number }>("select count(*)::int n from ai_interviews where user_id = $1 and coverage = 'plan' and role = $2", [u.id, MARK]))[0].n;
    {
      const results = await Promise.all([1, 2, 3].map(() => bookAiInterview(u.id, form(setup()))));
      const wins = results.filter((r) => r.ok).length;
      check("C1", "three bookings at once with one interview left → exactly one is covered", wins === 1 && (await planRows()) === 1, results.map((r) => (r.ok ? "booked" : r.error)).join(" | "));
    }
    const [ownReady] = await q<{ id: string }>("select id from ai_interviews where user_id = $1 and role = $2 and status = 'ready'", [u.id, MARK]);
    {
      const r = await formAction("bookAiInterviewAction", [], { ...setup(), coverage: "plan", status: "ready", pricePaise: 0, priceFullPaise: 0, allowancePeriodEnds: null }, userCookie);
      const [{ n }] = await q<{ n: number }>("select count(*)::int n from ai_interviews where user_id = $1 and role = $2", [u.id, MARK]);
      check("C2", "with the allowance spent, extra fields in the request can't make a booking free", refused(r) && val(r).includes("Online payment isn't available") && n === 1 && (await planRows()) === 1, val(r).slice(0, 90));
    }
    {
      const r = await formAction("updateAiBookingAction", [ownReady.id], setup({ durationMin: 60, difficulty: "Hard" }), userCookie);
      const [row] = await q<{ duration_min: number; difficulty: string }>("select duration_min, difficulty from ai_interviews where id = $1", [ownReady.id]);
      check("C3", "a covered booking's length and difficulty can't be raised afterwards", refused(r) && val(r).includes("stay as booked") && row.duration_min === 15 && row.difficulty === "Easy", val(r).slice(0, 90));
    }
    {
      await q(`update "user" set plan_expires_at = now() - interval '1 day' where id = $1`, [u.id]);
      const r = await bookAiInterview(u.id, form(setup()));
      const [{ n }] = await q<{ n: number }>("select count(*)::int n from ai_interviews where user_id = $1 and role = $2 and coverage = 'plan'", [u.id, MARK]);
      check("C4", "an expired plan's allowance can't be used", !r.ok && n === 1, r.ok ? "booked" : r.error);
    }
    {
      const nextEnd = new Date(periodEnd.getTime() + 30 * DAY);
      await q(`update "user" set plan_expires_at = $1 where id = $2`, [nextEnd, u.id]);
      const r = await bookAiInterview(u.id, form(setup()));
      check("C5", "a renewed period gets its own allowance (sanity)", r.ok && (await planRows()) === 2, r.ok ? "booked" : r.error);
    }
    {
      const [{ used }] = await q<{ used: number }>("select count(*)::int used from ai_interviews where user_id = $1 and coverage = 'free'", [u.id]);
      await q("update plans set ai_interviews_included = $1 where id = $2", [used + 1, freePlan.id]);
      await q(`update "user" set plan_id = $1, plan_expires_at = null where id = $2`, [freePlan.id, u.id]);
      const results = await Promise.all([1, 2].map(() => bookAiInterview(u.id, form(setup()))));
      const [{ now }] = await q<{ now: number }>("select count(*)::int now from ai_interviews where user_id = $1 and coverage = 'free'", [u.id]);
      check("C6", "the Free plan's interview can only be taken once, even with two at once", results.filter((r) => r.ok).length === 1 && now === used + 1, results.map((r) => (r.ok ? "booked" : r.error)).join(" | "));
      await q(`update "user" set plan_expires_at = now() + interval '400 days' where id = $1`, [u.id]);
      const again = await bookAiInterview(u.id, form(setup()));
      check("C7", "and it doesn't come back when the account's dates change", !again.ok, again.ok ? "booked" : again.error);
      await restoreRow("plans", "id", freePlan);
    }

    /* ---- D: paid bookings charge the right price, once ---- */
    await q(
      `update payment_gateways set enabled = true, mode = 'test', key_id = 'rzp_test_SecCheckFake01',
         key_secret_ciphertext = $1, webhook_secret_ciphertext = $2 where id = 'razorpay'`,
      [encryptSecret(KEY_SECRET), encryptSecret(WEBHOOK_SECRET)],
    );
    await q(`update "user" set plan_id = $1, plan_expires_at = now() - interval '1 day' where id = $2`, [tempPlan.id, u.id]);
    const pricing = {
      Easy: { ratePerMinutePaise: 300, discountOn: false, discountPercent: 40 },
      Medium: { ratePerMinutePaise: 450, discountOn: true, discountPercent: 25 },
      Hard: { ratePerMinutePaise: 500, discountOn: true, discountPercent: 10 },
    };
    await q("update mock_interview_config set pricing = $1 where id = 'app'", [JSON.stringify(pricing)]);
    const [{ recent }] = await q<{ recent: number }>("select count(*)::int recent from payment_orders where user_id = $1 and created_at > now() - interval '1 hour'", [u.id]);
    if (!(await aiPaymentAvailable())) {
      check("D0", "online payment is available for the price checks", false, "Billing isn't complete locally, so paid bookings can't be tried");
    } else if (recent > 6) {
      check("D0", "room under the 10 orders an hour limit for the price checks", false, `${recent} orders in the last hour; run again later`);
    } else {
      const orderOf = async (bookingId: string) => (await appDb.select().from(paymentOrders).where(eq(paymentOrders.aiInterviewId, bookingId)))[0];
      const priceOf = async (id: string) =>
        (await q<{ price_full_paise: number; price_paise: number; discount_percent: number; status: string; coverage: string }>("select price_full_paise, price_paise, discount_percent, status, coverage from ai_interviews where id = $1", [id]))[0];

      // Easy, 30 min: discount set but switched off → full price.
      const easy = await bookAiInterview(u.id, form(setup({ difficulty: "Easy", durationMin: 30 })));
      const easyRow = easy.ok ? await priceOf(easy.id) : null;
      const easyOrder = easy.ok ? await orderOf(easy.id) : null;
      check(
        "D1",
        "Easy 30 min at ₹3/min with its discount off → ₹90, no discount",
        !!easyRow && easyRow.price_full_paise === 9000 && easyRow.price_paise === 9000 && easyRow.discount_percent === 0 && easyRow.status === "pending_payment" && easyOrder?.totalAmount === 9000 && razorpayOrders.at(-1)?.amount === 9000,
        easy.ok ? `booking ${easyRow?.price_paise}, order ${easyOrder?.totalAmount}, gateway ${razorpayOrders.at(-1)?.amount}` : easy.error,
      );

      // Medium, 45 min, 25% on: 20250 → 15187.5 → rounded to the rupee, ₹152.
      const med = await bookAiInterview(u.id, form({ ...setup({ difficulty: "Medium", durationMin: 45 }), pricePaise: 100, coverage: "free", discountPercent: 100 }));
      const medRow = med.ok ? await priceOf(med.id) : null;
      const medOrder = med.ok ? await orderOf(med.id) : null;
      check(
        "D2",
        "Medium 45 min at ₹4.50/min with 25% off → ₹152, whatever the request says",
        !!medRow && medRow.price_full_paise === 20250 && medRow.price_paise === 15200 && medRow.discount_percent === 25 && medRow.coverage === "paid" && medOrder?.totalAmount === 15200,
        med.ok ? `booking ${medRow?.price_full_paise} → ${medRow?.price_paise} (${medRow?.discount_percent}%), order ${medOrder?.totalAmount}` : med.error,
      );

      if (easy.ok && easyOrder && med.ok && medOrder) {
        const creds = { keyId: "rzp_test_SecCheckFake01", keySecret: KEY_SECRET };
        const pay = (o: typeof easyOrder, over: Partial<{ amount: number; order_id: string }> = {}) => ({
          id: `pay_SEC${RUN}`,
          order_id: o.gatewayOrderId,
          amount: o.totalAmount,
          currency: o.currency,
          status: "captured" as const,
          method: "upi",
          error_description: null,
          ...over,
        });
        // D3/D4: wrong amount or wrong order changes nothing.
        const wrongAmount = await confirmPayment(medOrder, pay(medOrder, { amount: medOrder.totalAmount - 100 }), creds);
        const wrongOrder = await confirmPayment(medOrder, pay(medOrder, { order_id: easyOrder.gatewayOrderId ?? "" }), creds);
        const medAfter = await orderOf(med.id);
        check(
          "D3",
          "a payment for the wrong amount or another order is refused",
          !wrongAmount.ok && !wrongOrder.ok && medAfter.status !== "paid" && (await priceOf(med.id)).status === "pending_payment",
          `${!wrongAmount.ok ? wrongAmount.error : "accepted"} | ${!wrongOrder.ok ? wrongOrder.error : "accepted"}`,
        );

        // Handler and webhook confirming the same payment at once.
        const mailBefore = sentMail.length;
        const both = await Promise.all([confirmPayment(easyOrder, pay(easyOrder), creds), confirmPayment(easyOrder, pay(easyOrder), creds)]);
        const third = await confirmPayment(easyOrder, pay(easyOrder), creds);
        await sleep(2500); // the receipt is sent in the background
        const firstTime = [...both, third].filter((r) => r.ok && !r.alreadyPaid).length;
        const o = await orderOf(easy.id);
        const b = await priceOf(easy.id);
        const [{ n }] = await q<{ n: number }>("select count(*)::int n from payment_orders where ai_interview_id = $1", [easy.id]);
        const receipts = sentMail.slice(mailBefore).length;
        check(
          "D4",
          "confirming one payment three times (two at once) books it once, one order, one receipt",
          both.every((r) => r.ok) && third.ok && firstTime === 1 && o.status === "paid" && b.status === "ready" && n === 1 && receipts === 1,
          `first-time confirms ${firstTime}, order ${o.status}, booking ${b.status}, orders ${n}, receipts ${receipts}`,
        );
      } else {
        check("D3", "payment confirm checks", false, "the paid bookings above didn't start");
      }
    }
    await q("update payment_gateways set enabled = false where id = 'razorpay'");

    /* ---- E: reports always match the report format ---- */
    {
      const good = {
        scores: { communication: 6, technical: 5, confidence: 7, problemSolving: 5, relevance: 6 },
        strengths: [{ headline: "Clear structure", detail: "You framed each answer around the situation and the result." }],
        improvements: [{ headline: "Give numbers", detail: "Say how much time or money the change saved." }],
        missed: [],
        betterAnswers: [],
        nextSteps: [{ headline: "Practice estimates", detail: "Work through two estimation questions out loud." }],
      };
      const bad: [string, unknown][] = [
        ["score above 10", { ...good, scores: { ...good.scores, technical: 11 } }],
        ["score of 0", { ...good, scores: { ...good.scores, technical: 0 } }],
        ["fractional score", { ...good, scores: { ...good.scores, technical: 6.5 } }],
        ["score as text", { ...good, scores: { ...good.scores, technical: "7" } }],
        ["missing score", { ...good, scores: { communication: 6, technical: 5, confidence: 7, problemSolving: 5 } }],
        ["no strengths", { ...good, strengths: [] }],
        ["long headline", { ...good, strengths: [{ headline: "x".repeat(91), detail: "y" }] }],
        ["empty detail", { ...good, improvements: [{ headline: "Fine", detail: " " }] }],
        ["no next steps", { ...good, nextSteps: undefined }],
      ];
      const slipped = bad.filter(([, v]) => evaluationSchema.safeParse(v).success).map(([n]) => n);
      const fenced = (() => {
        try {
          return evaluationSchema.safeParse(parseJsonObject("Here you go:\n```json\n" + JSON.stringify(good) + "\n```")).success;
        } catch {
          return false;
        }
      })();
      const notJson = (() => {
        try {
          parseJsonObject("I can't score this interview.");
          return false;
        } catch {
          return true;
        }
      })();
      check("E1", "the report format rejects bad scores and missing parts", slipped.length === 0 && evaluationSchema.safeParse(good).success, slipped.join(", ") || `${bad.length} bad replies refused`);
      check("E2", "a reply wrapped in prose or a code fence still reads; one with no JSON doesn't", fenced && notJson);
      const many = { ...good, strengths: Array(9).fill(good.strengths[0]), missed: Array(12).fill({ question: "Q", headline: "Missed it", note: "N" }), betterAnswers: Array(12).fill({ question: "Q", answer: "A" }) };
      const w = toWriting(evaluationSchema.parse(many));
      check("E3", "a long reply is cut to what the report shows", w.strengths.length === 4 && w.missed.length === 8 && w.betterAnswers.length === 8);

      // E4: the real evaluation, with the AI stand-in.
      const evalId = await insertInterview(u.id, MARK, "completed", { started_at: new Date(Date.now() - 20 * 60_000), ended_at: new Date(), active_seconds: 900 });
      await q(
        `insert into ai_interview_messages (interview_id, seq, sender, kind, question_no, text) values
           ($1, 1, 'ai', 'question', 1, 'Tell me about a project you led.'),
           ($1, 2, 'candidate', 'answer', null, 'I led a billing migration over five months and we finished two weeks early.')`,
        [evalId],
      );
      const callsBefore = aiCalls.length;
      aiReplies.push("not json", JSON.stringify({ ...good, scores: { ...good.scores, technical: 12 } }), "{}");
      const failed = await evaluateInterview(evalId);
      const [none] = await q("select id from interview_evaluations where ai_interview_id = $1", [evalId]);
      check("E4", "three unusable AI replies → no report saved, left for the retry job", failed === false && !none && aiCalls.length - callsBefore === 3);
      aiReplies.push(JSON.stringify(many));
      const okEval = await evaluateInterview(evalId);
      const [e] = await q<Row>("select * from interview_evaluations where ai_interview_id = $1", [evalId]);
      const writing = e?.writing as { missed: unknown[] } | undefined;
      check("E5", "a usable reply → a report in the format, trimmed", okEval && !!e && e.status === "submitted" && writing?.missed.length === 8 && e.technical === 5);
      const keyUsed = aiCalls.slice(callsBefore).every((c) => c.auth.length > 10);
      check("E6", "the module key went only to the AI stand-in, never out", keyUsed && strayCalls.length === 0, strayCalls.join(", ") || `${aiCalls.length} AI calls, all stand-in`);
    }
    {
      const rows = await q<Row>("select * from interview_evaluations where source = 'ai' and status = 'submitted'");
      const bad: string[] = [];
      for (const r of rows) {
        const scores = Object.fromEntries(METRICS.map((m) => [m.key, Number(r[m.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)])]));
        const w = r.writing as Record<string, { headline?: string }[]> | null;
        const okScores = Object.values(scores).every((s) => Number.isInteger(s) && s >= 1 && s <= 10);
        const okOverall = r.weights ? overallScore(scores as never, r.weights as never) === r.overall : true;
        const okWriting =
          !!w &&
          [["strengths", 1, 4], ["improvements", 1, 4], ["missed", 0, 8], ["betterAnswers", 0, 8], ["nextSteps", 1, 4]].every(
            ([k, lo, hi]) => Array.isArray(w[k as string]) && w[k as string].length >= (lo as number) && w[k as string].length <= (hi as number),
          );
        if (!okScores || !okOverall || !okWriting) bad.push(String(r.ai_interview_id).slice(0, 8));
      }
      check("E7", "every saved AI report has scores 1 to 10, the right overall and the report's parts", bad.length === 0, bad.join(", ") || `${rows.length} reports`);
    }

    /* ---- F: the module key never reaches the browser ---- */
    {
      const clientFiles = [...walk("components"), ...walk("app")].filter((f) => /\.(tsx?|jsx?)$/.test(f) && /^["']use client["']/m.test(readFileSync(f, "utf8")));
      // Type-only imports are erased before the browser bundle, so they're fine.
      const SERVER = /^import (?!type\b)[^;]*from ["']@\/lib\/(ai|crypto|db|mock-interviews\/(config|engine|booking|prompts|data)|payments\/[\w-]+)["']/m;
      const offenders = clientFiles.filter((f) => SERVER.test(readFileSync(f, "utf8")));
      const guarded = ["lib/mock-interviews/booking.ts", "lib/mock-interviews/engine.ts", "lib/mock-interviews/data.ts", "lib/mock-interviews/prompts.ts", "lib/ai.ts"].filter(
        (f) => !/^import ["']server-only["']/m.test(readFileSync(f, "utf8")),
      );
      check("F1", "no browser code imports the AI, key or interview server modules", offenders.length === 0 && guarded.length === 0, [...offenders, ...guarded.map((g) => `${g} lacks server-only`)].join(", ") || `${clientFiles.length} client files`);
    }
    {
      const cipher = String(cfg.ai_key_ciphertext ?? "");
      const key = cipher ? decryptSecret(cipher) : "";
      const needles = [key, cipher].filter((s) => s.length > 8);
      const pages = [
        ["admin", "/jmp-admin/mock-interviews/settings?section=ai"],
        ["admin", "/jmp-admin/mock-interviews/ai"],
        ["user", "/mock-interviews/ai"],
        ["user", "/mock-interviews/ai/new"],
        ["user", `/mock-interviews/ai/prepare/${ownReady.id}`],
      ] as const;
      const leaks: string[] = [];
      let settingsRendered = false;
      let settingsInfo = "";
      for (const [who, p] of pages) {
        const r = await page(p, who === "admin" ? adminCookie : userCookie);
        if (p.includes("/settings")) {
          settingsRendered = r.status === 200 && /Test connection/.test(r.html);
          settingsInfo = `settings page ${r.status}${r.location ? ` → ${r.location}` : ""}`;
        }
        if (needles.some((n) => r.html.includes(n))) leaks.push(p);
      }
      const chunks = existsDir(".next/static") ? walk(".next/static").filter((f) => f.endsWith(".js")) : [];
      const inChunks = chunks.filter((f) => needles.some((n) => readFileSync(f, "utf8").includes(n)));
      check(
        "F2",
        "the saved key isn't in any admin or candidate page, or in browser scripts",
        needles.length > 0 && leaks.length === 0 && inChunks.length === 0 && settingsRendered,
        needles.length === 0 ? "no module key saved locally to look for" : [...leaks, ...inChunks].join(", ") || `${pages.length} pages, ${chunks.length} scripts${settingsRendered ? "" : `; ${settingsInfo} didn't render`}`,
      );
    }

    /* ---- G: Coming soon closes the feature, not just the menu ---- */
    await q("update mock_interview_config set ai_state = 'coming_soon' where id = 'app'");
    {
      const [done] = await q<{ id: string }>("select ai_interview_id id from interview_evaluations where user_id = $1 and status = 'submitted' limit 1", [u.id]);
      const open: string[] = [];
      for (const p of [
        "/mock-interviews/ai",
        "/mock-interviews/ai/new",
        `/mock-interviews/ai/prepare/${ownReady.id}`,
        `/mock-interviews/ai/session/${ownReady.id}`,
        "/mock-interviews/history",
        "/mock-interviews/performance",
        ...(done ? [`/mock-interviews/report/${done.id}`] : []),
      ]) {
        const r = await page(p, userCookie);
        if (!/Coming soon/i.test(r.html) || r.html.includes(MARK)) open.push(`${p} ${r.status}`);
      }
      check("G1", "Coming soon → every AI interview page shows Coming soon, not the feature", open.length === 0, open.join(", ") || "7 pages");
    }
    {
      const before = await rowOf(ownReady.id);
      const [{ n: countBefore }] = await q<{ n: number }>("select count(*)::int n from ai_interviews where user_id = $1", [u.id]);
      const results = [
        await formAction("bookAiInterviewAction", [], setup(), userCookie),
        await formAction("updateAiBookingAction", [ownReady.id], setup({ role: `${MARK} edited` }), userCookie),
        await action("startInterviewAction", [ownReady.id], userCookie),
        await action("interviewHeartbeatAction", [ownReady.id], userCookie),
        await action("answerInterviewAction", [ownReady.id, "An answer"], userCookie),
        await action("endInterviewAction", [ownReady.id], userCookie),
        await action("aiInterviewsOpenAction", [], userCookie),
      ];
      const direct = await bookAiInterview(u.id, form(setup()));
      const after = await rowOf(ownReady.id);
      const [{ n: countAfter }] = await q<{ n: number }>("select count(*)::int n from ai_interviews where user_id = $1", [u.id]);
      check(
        "G2",
        "Coming soon → booking, editing and every interview action is refused",
        results.every(refused) && results.slice(0, 2).every((r) => val(r).includes("aren't open")) && !direct.ok && after.status === before.status && after.role === before.role && countAfter === countBefore,
        results.map((r) => val(r).slice(0, 36)).join(" | "),
      );
    }
    check("Z1", "nothing reached a real AI service, Razorpay or a mail server", strayCalls.length === 0, strayCalls.join(", ") || "all outbound calls went to stand-ins");
  } finally {
    // ---- put everything back
    await restoreRow("mock_interview_config", "id", cfg);
    await restoreRow("payment_gateways", "id", gw);
    await restoreRow("plans", "id", freePlan);
    await restoreRow("user", "id", u);
    const ids = (await q<{ id: string }>("select id from ai_interviews where role in ($1, $2, $3)", [MARK, OTHER_MARK, `${MARK} edited`])).map((r) => r.id);
    const orders = (await q<{ id: string }>("select id from payment_orders where ai_interview_id = any($1::uuid[])", [ids])).map((r) => r.id);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local session_replication_role = replica");
      const [inv] = (await client.query("select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'order_id'")).rows;
      if (inv) await client.query("delete from invoices where order_id = any($1::uuid[])", [orders]);
      await client.query("delete from payment_orders where id = any($1::uuid[])", [orders]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      console.error("cleanup of test payment orders failed:", err);
      failures++;
    } finally {
      client.release();
    }
    await q("delete from ai_interviews where id = any($1::uuid[])", [ids]);
    await q("delete from sent_email_log where sent_at >= $1 and to_address = $2 and template_key like 'mock_interview%'", [startedAt, u.email]);
    for (const id of tempPlanIds) await q("delete from plans where id = $1", [id]);

    // ---- and prove it
    const [cfgNow] = await q("select * from mock_interview_config where id = 'app'");
    const [gwNow] = await q("select * from payment_gateways where id = 'razorpay'");
    const [uNow] = await q(`select * from "user" where id = $1`, [u.id]);
    const [freeNow] = await q("select * from plans where id = $1", [freePlan.id]);
    const same = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);
    const [{ left }] = await q<{ left: number }>("select count(*)::int left from ai_interviews where role in ($1, $2)", [MARK, OTHER_MARK]);
    check(
      "Z2",
      "everything changed was put back exactly, and test rows are gone",
      same(cfg, cfgNow) && same(gw, gwNow) && same(u, uNow) && same(freePlan, freeNow) && left === 0,
      [!same(cfg, cfgNow) && "module settings", !same(gw, gwNow) && "gateway", !same(u, uNow) && "ui-test", !same(freePlan, freeNow) && "Free plan", left && `${left} bookings`].filter(Boolean).join(", ") || "settings, gateway, plan, account",
    );
  }
}

function existsDir(p: string) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    await pool.end();
    console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
    process.exit(failures ? 1 : 0);
  });
