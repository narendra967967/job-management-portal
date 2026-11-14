// Admin dashboard checks (docs/admin-dashboard/spec.md, phase 7), run before a
// deploy. Run from the repo root against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/dashboard-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the signed-out HTTP checks.
// Amazon SES is never contacted: SES_ENDPOINT points at a closed local port.
// The layout and job-run checks write to admin_dashboard_layouts and job_runs
// and then put back exactly the rows that were there before.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Run this against a local stack, not production.");
  process.exit(1);
}
process.env.SES_ENDPOINT = "http://127.0.0.1:9";

const APP = process.env.APP_URL ?? "";
let failures = 0;
function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? `  (${detail})` : ""}`);
}
// Windows checkouts get CRLF line endings; the patterns below expect \n.
const read = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

const model = await import("../../lib/admin/dashboard-model.ts");
const { JOBS, isLate } = await import("../../lib/job-runs-model.ts");
const { runJob } = await import("../../lib/job-runs.ts");
const { loadDashboard } = await import("../../lib/admin/dashboard-data.ts");
const { getDashboardLayout, setDashboardLayout, layoutInputSchema } = await import("../../lib/admin/dashboard-layout.ts");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

/* ---------------- S: the code is wired the way the spec says ---------------- */

const PANEL = "app/jmp-admin/(panel)";
for (const page of ["dashboard", "sent-emails"]) {
  const src = read(`${PANEL}/${page}/page.tsx`);
  check("S1", `${page} page checks the admin session first`, /export default async function[\s\S]*?\{\s*(const \w+ = )?await requireAdmin\(\)/.test(src));
}
{
  const src = read("actions/admin-dashboard.ts");
  const gate = src.indexOf("await requireAdmin()");
  const parse = src.indexOf("parseInput(layoutInputSchema");
  check("S2", "layout action checks the admin, then validates with Zod", gate > 0 && parse > gate);
  check("S2", "layout is saved for the signed-in admin only", /setDashboardLayout\(adminId,/.test(src));
}

const cronDirs = readdirSync("app/api/cron");
const jobKeys = JOBS.map((j) => j.key) as string[];
const jmpCron = read("scripts/cron/jmp-cron.sh");
const cronRun = read("deploy/vps/cron-run.sh");
const crontab = read("deploy/vps/crontab.txt");
for (const dir of cronDirs) {
  const src = read(`app/api/cron/${dir}/route.ts`);
  const key = src.match(/runJob\("([a-z]+)"/)?.[1];
  check("S3", `cron route ${dir} records its runs`, !!key && jobKeys.includes(key), key ?? "no runJob");
  const authAt = src.indexOf('status: 401');
  check("S3", `cron route ${dir} rejects a missing secret before the job`, authAt > 0 && authAt < src.indexOf("runJob("));
  check("S3", `cron route ${dir} is reachable from the crontab helper`, !!key && jmpCron.includes(`${key})`) && jmpCron.includes(`/api/cron/${dir}"`));
}
for (const k of jobKeys) {
  check("S4", `job ${k} is scheduled for prod and preprod`, crontab.includes(`cron-run.sh prod ${k} `) && crontab.includes(`cron-run.sh preprod ${k} `));
  check("S4", `job ${k} is in cron-run.sh's usage`, cronRun.includes(k));
}
check("S4", "every job has its own route", new Set(cronDirs.map((d) => read(`app/api/cron/${d}/route.ts`).match(/runJob\("([a-z]+)"/)?.[1])).size === jobKeys.length);

{
  const docker = read("Dockerfile");
  const runner = docker.slice(docker.indexOf("AS runner"));
  check("S5", "the image carries the deployed commit", /ARG APP_COMMIT/.test(runner) && /ENV APP_COMMIT=\$APP_COMMIT/.test(runner));
  check("S5", "CI passes the git commit into the build", /docker build --build-arg APP_COMMIT="\$SHA"/.test(read("deploy/vps/ci-ship.sh")));
}

// Every page a dashboard number opens exists.
const sample = [
  model.links.users({ plan: "paid" }),
  model.links.tickets({ status: "open" }),
  model.links.orders({ status: "failed" }),
  model.links.renewals({ due: "7" }),
  model.links.broadcasts({}),
  model.links.inbound({}),
  model.links.kbUnanswered(),
  model.links.settings("email"),
  model.links.sentEmails({ status: "failed" }),
  model.links.systemBlock(),
];
for (const href of sample) {
  const path = href.split(/[?#]/)[0].replace("/jmp-admin/", "");
  check("S6", `link target ${path} exists`, existsSync(`${PANEL}/${path}/page.tsx`));
}
{
  const settingsSrc = read("components/admin/settings/settings-client.tsx");
  const used = new Set(
    ["components/admin/dashboard/blocks-ops.tsx", "components/admin/dashboard/blocks-growth.tsx", "lib/admin/dashboard-data.ts"]
      .flatMap((f) => [...read(f).matchAll(/links\.settings\("([a-z-]+)"\)/g)].map((m) => m[1])),
  );
  for (const s of used) check("S6", `Settings section "${s}" exists`, new RegExp(`id: "${s}"`).test(settingsSrc));
}

/* ---------------- L: each admin's layout ---------------- */

const adminEmail = process.env.LOCAL_TEST_ADMIN_EMAIL ?? "";
const admin = adminEmail
  ? (await pool.query<{ id: string }>(`select id from "user" where lower(email) = lower($1) and role = 'admin'`, [adminEmail])).rows[0]
  : undefined;
if (!admin) {
  console.log("SKIP  L  no local admin account (LOCAL_TEST_ADMIN_EMAIL)");
} else {
  const before = (await pool.query("select * from admin_dashboard_layouts where user_id = $1", [admin.id])).rows[0];
  try {
    const all = model.BLOCKS.map((b) => b.id) as string[];
    await pool.query("delete from admin_dashboard_layouts where user_id = $1", [admin.id]);
    const d = await getDashboardLayout(admin.id);
    check("L1", "no saved layout means the default", d.order.join() === all.join() && d.hidden.length === 0);

    const saved = await setDashboardLayout(admin.id, {
      order: ["system", "support", "support", "not-a-block", "tile-users"],
      hidden: ["revenue", "made-up"],
    });
    check("L2", "unknown blocks are dropped and duplicates removed", !saved.order.includes("not-a-block" as never) && saved.order.filter((x) => x === "support").length === 1 && !saved.hidden.includes("made-up" as never));
    check("L2", "blocks missing from a saved layout come back", saved.order.length === all.length && all.every((id) => saved.order.includes(id as never)));
    check("L2", "the saved order is kept", saved.order[0] === "system" && saved.order[1] === "support");
    const back = await getDashboardLayout(admin.id);
    check("L3", "a saved layout reads back the same", back.order.join() === saved.order.join() && back.hidden.join() === "revenue");
    const rows = (await pool.query("select block_order, hidden from admin_dashboard_layouts where user_id = $1", [admin.id])).rows;
    check("L3", "one row per admin, holding only real block ids", rows.length === 1 && (rows[0].block_order as string[]).every((id) => all.includes(id)));

    // A block id saved before it was removed from the dashboard is ignored on read.
    await pool.query(`update admin_dashboard_layouts set block_order = block_order || '["retired-block"]'::jsonb where user_id = $1`, [admin.id]);
    check("L3", "a retired block in a saved row is ignored", !(await getDashboardLayout(admin.id)).order.includes("retired-block" as never));

    await setDashboardLayout(admin.id, model.defaultLayout());
    check("L4", "Reset to default removes the row", (await pool.query("select 1 from admin_dashboard_layouts where user_id = $1", [admin.id])).rowCount === 0);

    const big = Array.from({ length: 41 }, (_, i) => `b${i}`);
    check("L5", "too many blocks is refused", !layoutInputSchema.safeParse({ order: big, hidden: [] }).success);
    check("L5", "a non-text block id is refused", !layoutInputSchema.safeParse({ order: [1], hidden: [] }).success);
    check("L5", "an overlong block id is refused", !layoutInputSchema.safeParse({ order: ["x".repeat(41)], hidden: [] }).success);
    check("L5", "a normal layout is accepted", layoutInputSchema.safeParse({ order: all, hidden: ["system"] }).success);
  } finally {
    await pool.query("delete from admin_dashboard_layouts where user_id = $1", [admin.id]);
    if (before) {
      await pool.query("insert into admin_dashboard_layouts (user_id, block_order, hidden, updated_at) values ($1, $2, $3, $4)", [
        admin.id, JSON.stringify(before.block_order), JSON.stringify(before.hidden), before.updated_at,
      ]);
    }
  }
}
{
  const fk = (await pool.query(`
    select tc.table_name, rc.delete_rule from information_schema.table_constraints tc
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
    where tc.table_name in ('admin_dashboard_layouts', 'sent_email_log') and tc.constraint_type = 'FOREIGN KEY'`)).rows;
  check("L6", "a deleted admin's layout goes with the account", fk.some((r) => r.table_name === "admin_dashboard_layouts" && r.delete_rule === "CASCADE"));
}

/* ---------------- J: scheduled job runs ---------------- */

const jobsBefore = (await pool.query("select * from job_runs")).rows;
const jobRow = async (k: string) => (await pool.query("select * from job_runs where job = $1", [k])).rows[0];
try {
  await pool.query("delete from job_runs where job = 'ai'");
  const v = await runJob("ai", async () => ({ n: 7 }));
  let r = await jobRow("ai");
  check("J1", "a run returns the job's own result", v.n === 7);
  check("J1", "a good run is recorded", r?.last_ok === true && r.last_error === null && r.failures_in_a_row === 0 && r.last_ok_at !== null);
  const okAt = r.last_ok_at.toISOString();

  const key = ["AK", "IA", "TESTONLYNOTAKEY0"].join("");
  const boom = new Error(`refused for ${key}\n  at somewhere\n${"x".repeat(800)}`);
  let caught: unknown;
  try {
    await runJob("ai", async () => {
      throw boom;
    });
  } catch (e) {
    caught = e;
  }
  r = await jobRow("ai");
  check("J2", "a failed run throws the job's own error", caught === boom);
  check("J2", "a failed run is recorded", r.last_ok === false && r.failures_in_a_row === 1);
  check("J2", "the error is one short line with keys masked", !r.last_error.includes(key) && r.last_error.includes("[access key]") && !r.last_error.includes("\n") && r.last_error.length <= 500);
  check("J2", "the last good run is kept after a failure", r.last_ok_at.toISOString() === okAt);
  try {
    await runJob("ai", async () => {
      throw "plain text";
    });
  } catch {}
  check("J2", "failures are counted in a row", (await jobRow("ai")).failures_in_a_row === 2);
  await runJob("ai", async () => 1);
  r = await jobRow("ai");
  check("J3", "a good run resets the count and clears the error", r.failures_in_a_row === 0 && r.last_error === null);
  check("J3", "one row per job", (await pool.query("select count(*)::int n from job_runs where job = 'ai'")).rows[0].n === 1);

  // Recording must never change the job's outcome.
  console.log("      (J4 hides job_runs for a moment: two \"[job-runs] couldn't record\" server-log lines are expected)");
  await pool.query("alter table job_runs rename to job_runs_hidden_by_checks");
  let got: unknown;
  let err: unknown;
  const realErr = new Error("real failure");
  try {
    got = await runJob("purge", async () => "done");
    await runJob("purge", async () => {
      throw realErr;
    });
  } catch (e) {
    err = e;
  }
  await pool.query("alter table job_runs_hidden_by_checks rename to job_runs");
  check("J4", "a run that can't be recorded still returns its result", got === "done");
  check("J4", "a failure that can't be recorded still throws the job's error", err === realErr);

  const now = Date.parse("2026-11-15T12:00:00Z");
  check("J5", "not late before its window", !isLate(new Date(now - 29 * 60_000), 30, now));
  check("J5", "late after its window", isLate(new Date(now - 31 * 60_000), 30, now));
  check("J5", "never run is not late", !isLate(null, 30, now));
} finally {
  await pool.query("alter table if exists job_runs_hidden_by_checks rename to job_runs").catch(() => {});
  await pool.query("delete from job_runs");
  for (const s of jobsBefore) {
    await pool.query(
      "insert into job_runs (job, last_started_at, last_finished_at, last_ok, last_error, last_duration_ms, last_ok_at, failures_in_a_row) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [s.job, s.last_started_at, s.last_finished_at, s.last_ok, s.last_error, s.last_duration_ms, s.last_ok_at, s.failures_in_a_row],
    );
  }
  check("J6", "job runs put back as they were", (await pool.query("select count(*)::int n from job_runs")).rows[0].n === jobsBefore.length, `${jobsBefore.length} rows`);
}

/* ---------------- D: the numbers load, for every period ---------------- */

const tz = "Asia/Kolkata";
const today = model.todayIn(tz);
const sels: { id: string; from?: string; to?: string }[] = [
  ...model.PERIODS.filter((p) => p.id !== "custom").map((p) => ({ id: p.id as string })),
  { id: "custom", from: model.addDays(today, -13), to: today },
];
let first: Awaited<ReturnType<typeof loadDashboard>> | null = null;
for (const sel of sels) {
  try {
    const parsed = model.parsePeriod({ period: sel.id, from: sel.from, to: sel.to });
    check("D1", `period ${sel.id} is recognized`, parsed.id === sel.id);
    const range = model.periodRange(parsed, today);
    const d = await loadDashboard(range, tz, today);
    first ??= d;
    const counts = [d.users.total, d.users.joined, d.signedIn.count, d.paid.count, d.revenue.total, d.emailDelivery.log.sent, d.emailDelivery.log.failed];
    check("D1", `${sel.id} loads with sane counts`, counts.every((n) => Number.isFinite(n) && n >= 0), `${range.from} to ${range.to}`);
  } catch (e) {
    check("D1", `${sel.id} loads`, false, e instanceof Error ? e.message : String(e));
  }
}
if (first) {
  const customers = (await pool.query(`select count(*)::int n from "user" where role = 'user'`)).rows[0].n;
  check("D2", "Total users counts customers only", first.users.total === customers, `${first.users.total} vs ${customers}`);
  check("D3", "System lists every scheduled job, in order", first.system.jobs.map((j) => j.key).join() === jobKeys.join());
  check("D3", "the funnel has every step", first.funnel.length === model.FUNNEL_STEPS.length);
  check("D3", "Needs attention links all open admin pages", first.attention.every((a) => !a.href || a.href.startsWith("/jmp-admin/")));
  check("D3", "the System block can be linked to", read("components/admin/dashboard/dashboard-view.tsx").includes("id={`block-${id}`}") && model.links.systemBlock().endsWith("#block-system"));
}

// Failed and late scheduled jobs reach Needs attention.
{
  const before = (await pool.query("select * from job_runs")).rows;
  const range = model.periodRange(model.parsePeriod({}), today);
  const keys = async () => (await loadDashboard(range, tz, today)).attention;
  try {
    await pool.query("delete from job_runs");
    // Jobs that have never run (a fresh environment) aren't flagged.
    let att = await keys();
    check("D4", "jobs that never ran aren't flagged", !att.some((a) => a.key.startsWith("jobs-")));
    await pool.query(`insert into job_runs values
      ('ai', now(), now(), true, null, 5, now(), 0),
      ('broadcasts', now(), now(), false, 'boom', 5, null, 2),
      ('reminders', now() - interval '3 days', now() - interval '3 days', true, null, 5, now() - interval '3 days', 0),
      ('purge', now() - interval '3 days', now() - interval '3 days', false, 'boom', 5, null, 1)`);
    att = await keys();
    const failed = att.find((a) => a.key === "jobs-failed");
    const late = att.find((a) => a.key === "jobs-late");
    check("D4", "failed jobs are urgent and named", failed?.severity === "critical" && failed.count === 2 && failed.text.includes("Broadcast sender") && failed.text.includes("Daily cleanup"), failed?.text);
    check("D4", "a job that failed isn't also reported late", late?.count === 1 && late.text.includes("Renewal reminders") && !late.text.includes("Daily cleanup"), late?.text);
    check("D4", "both open the System block", failed?.href === model.links.systemBlock() && late?.href === model.links.systemBlock());
    check("D4", "a healthy job isn't flagged", !att.some((a) => a.text.includes("AI alert reader")));
    await pool.query("delete from job_runs where job <> 'broadcasts'");
    att = await keys();
    check("D4", "one failed job reads as a sentence", att.find((a) => a.key === "jobs-failed")?.text === "Broadcast sender failed on its last run");
  } finally {
    await pool.query("delete from job_runs");
    for (const s of before) {
      await pool.query(
        "insert into job_runs (job, last_started_at, last_finished_at, last_ok, last_error, last_duration_ms, last_ok_at, failures_in_a_row) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [s.job, s.last_started_at, s.last_finished_at, s.last_ok, s.last_error, s.last_duration_ms, s.last_ok_at, s.failures_in_a_row],
      );
    }
    check("D4", "job runs put back as they were", (await pool.query("select count(*)::int n from job_runs")).rows[0].n === before.length, `${before.length} rows`);
  }
}

/* ---------------- H: signed out (APP_URL only) ---------------- */

if (!APP) {
  console.log("SKIP  H  signed-out HTTP checks (set APP_URL to run them)");
} else {
  for (const path of ["/jmp-admin/dashboard", "/jmp-admin/sent-emails"]) {
    const res = await fetch(`${APP}${path}`, { redirect: "manual" });
    const to = res.headers.get("location") ?? "";
    check("H1", `${path} sends a signed-out visitor away`, res.status >= 300 && res.status < 400 && !to.includes(path), `${res.status} → ${to}`);
  }
  const runsBefore = (await pool.query("select count(*)::int n from job_runs")).rows[0].n;
  for (const dir of cronDirs) {
    const res = await fetch(`${APP}/api/cron/${dir}`, { method: "POST", headers: { authorization: "Bearer wrong" } });
    check("H2", `cron ${dir} refuses a wrong secret`, res.status === 401);
  }
  check("H2", "refused cron calls record nothing", (await pool.query("select count(*)::int n from job_runs")).rows[0].n === runsBefore);
}

await pool.end();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
