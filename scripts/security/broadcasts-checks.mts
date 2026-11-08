// Broadcast checks, run before a deploy (broadcasts phase 5). Run from the repo
// root against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/broadcasts-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the HTTP checks. Those turn the
// test user's promotional opt-out on for one check and put back exactly what
// was there; everything else only reads. Nothing is ever sent.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { sanitizeGuideHtml } from "../../lib/guide-html.ts";
import { unsubscribeToken, verifyUnsubscribeToken } from "../../lib/unsubscribe.ts";
import { loadAudiences } from "../../lib/broadcasts-data.ts";
import { getNotification } from "../../lib/notifications.ts";

const APP = process.env.APP_URL ?? "";
const USER_EMAIL = process.env.TEST_USER_EMAIL ?? "ui-test@jobtiva.test";
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

// Windows checkouts get CRLF line endings; the patterns below expect \n.
const read = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const one = async <T,>(q: string, v: unknown[] = []) => (await db.query(q, v)).rows[0] as T | undefined;

/* ---------------- B1 access ---------------- */

for (const f of filesUnder("app/jmp-admin/(panel)/broadcasts", /\.tsx$/)) {
  check("B1", `admin check in ${f}`, read(f).includes("requireAdmin("));
}
{
  const src = read("actions/admin-broadcasts.ts");
  // The body opens at the "{" ending the signature line; return types hold braces too.
  const actions = [...src.matchAll(/export async function (\w+)\([^]*?\)[^\n]*\{\n([^]*?)\n\}/g)];
  check("B1", "actions found in actions/admin-broadcasts.ts", actions.length >= 5, `${actions.length}`);
  for (const [, name, body] of actions) {
    const first = body.split("\n").find((l) => l.trim())?.trim() ?? "";
    check("B1", `${name} starts with requireAdmin`, /requireAdmin\(\)/.test(first), first.slice(0, 60));
  }
}
{
  // No session by design: the signed token is the only key, and every action checks it.
  const src = read("actions/unsubscribe.ts");
  const actions = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  const uses = (src.match(/setPromoOptOutByToken\(/g) ?? []).length;
  check("B1", "every unsubscribe action goes through the signed token", actions.length > 0 && uses === actions.length, `${uses}/${actions.length}`);
}
for (const f of ["app/(dashboard)/notifications/[id]/page.tsx", "app/(dashboard)/notifications/page.tsx"]) {
  check("B1", `${f} scopes to the signed-in user`, read(f).includes("getSessionUser()"));
}

/* ---------------- B2 message HTML ---------------- */

check("B2", "the save action sanitizes the message", /contentHtml:\s*sanitizeGuideHtml\(/.test(read("actions/admin-broadcasts.ts")));
{
  const html = sanitizeGuideHtml(
    '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">x</a><a href="https://example.com" onclick="alert(4)">ok</a>',
  );
  check("B2", "no <script> survives", !/<script/i.test(html));
  check("B2", "no event handlers survive", !/\son\w+=/i.test(html));
  check("B2", "no javascript: links survive", !/javascript:/i.test(html));
  check("B2", "ordinary content survives", html.includes("<p>Hi</p>") && html.includes("https://example.com"));
}
{
  const sender = read("lib/broadcasts-send.ts");
  check("B2", "promotional emails carry List-Unsubscribe headers", /headers:\s*b\.promo\s*\?\s*unsubscribeHeaders\(/.test(sender));
  check("B2", "promotional emails carry the signed footer link", /b\.promo\s*\?\s*unsubscribePageUrl\(/.test(sender));
  check("B2", "development only emails test addresses", /DEV && !TEST_ADDRESS\.test/.test(sender));
}

/* ---------------- B3 unsubscribe tokens ---------------- */

{
  const t = unsubscribeToken("user-abc123");
  const [id, sig] = t.split(".");
  const other = unsubscribeToken("someone-else");
  const flip = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  check("B3", "a genuine token verifies", verifyUnsubscribeToken(t) === "user-abc123");
  for (const [name, tok] of [
    ["changed signature", `${id}.${flip}`],
    ["another user's signature", `${id}.${other.split(".")[1]}`],
    ["signature moved to another id", `${other.split(".")[0]}.${sig}`],
    ["no signature", id],
    ["extra part", `${t}.x`],
    ["junk", "not-a-token"],
    ["empty", ""],
  ] as const) {
    check("B3", `refused: ${name}`, verifyUnsubscribeToken(tok) === null);
  }
}

/* ---------------- B4 audience ---------------- */

{
  const a = await loadAudiences();
  const c = await one<Record<string, number>>(`
    select
      count(*)::int as all_users,
      count(*) filter (where u.email_verified)::int as verified,
      count(*) filter (where not coalesce(s.promo_opt_out, false))::int as promo
    from "user" u left join user_settings s on s.user_id = u.id
    where u.role = 'user' and u.status <> 'inactive'`);
  check("B4", "Important reaches every user not deactivated", a.important.inApp === c?.all_users, `${a.important.inApp} vs ${c?.all_users}`);
  check("B4", "Important emails only confirmed addresses", a.important.email === c?.verified, `${a.important.email} vs ${c?.verified}`);
  check("B4", "Promotional leaves out opt-outs", a.promotional.inApp === c?.promo, `${a.promotional.inApp} vs ${c?.promo}`);
}

/* ---------------- B5 notification isolation ---------------- */

{
  const n = await one<{ id: string; user_id: string }>(`select id, user_id from notifications limit 1`);
  if (!n) {
    console.log("SKIP  B5 no notifications to test with");
  } else {
    check("B5", "a notification opens for its owner", (await getNotification(n.user_id, n.id)) !== null);
    check("B5", "and not for anyone else", (await getNotification(`${n.user_id}-not-them`, n.id)) === null);
  }
}

/* ---------------- B6 HTTP ---------------- */

if (!APP) {
  console.log("SKIP  B6 HTTP checks (set APP_URL)");
} else {
  for (const [name, headers] of [
    ["no secret", {}],
    ["wrong secret", { authorization: "Bearer not-the-secret" }],
  ] as const) {
    const res = await fetch(`${APP}/api/cron/broadcasts`, { method: "POST", headers });
    check("B6", `cron route refuses ${name}`, res.status === 401, String(res.status));
  }

  const u = await one<{ id: string }>(`select id from "user" where email = $1`, [USER_EMAIL]);
  if (!u) {
    console.log(`SKIP  B6 unsubscribe checks (no user ${USER_EMAIL})`);
  } else {
    const before = await one<{ v: boolean | null; at: Date | null; has: boolean }>(
      `select s.promo_opt_out as v, s.promo_opt_out_at as at, s.user_id is not null as has
       from "user" u left join user_settings s on s.user_id = u.id where u.id = $1`,
      [u.id],
    );
    const optOut = async () => (await one<{ v: boolean }>(`select promo_opt_out as v from user_settings where user_id = $1`, [u.id]))?.v ?? false;
    const token = unsubscribeToken(u.id);
    try {
      await db.query(`update user_settings set promo_opt_out = false where user_id = $1`, [u.id]);
      const page = await fetch(`${APP}/unsubscribe?t=${token}`, { redirect: "manual" });
      check("B6", "opening the page serves it", page.status === 200, String(page.status));
      check("B6", "but changes nothing without a browser", (await optOut()) === false);
      const get = await fetch(`${APP}/api/unsubscribe?t=${token}`, { redirect: "manual" });
      check("B6", "a GET on the one-click URL only redirects", get.status === 303 && (await optOut()) === false, String(get.status));
      const bad = await fetch(`${APP}/api/unsubscribe?t=bad.token`, { method: "POST", body: "List-Unsubscribe=One-Click" });
      check("B6", "one-click POST refuses a bad token", bad.status === 400, String(bad.status));
      const good = await fetch(`${APP}/api/unsubscribe?t=${token}`, { method: "POST", body: "List-Unsubscribe=One-Click" });
      check("B6", "one-click POST with the real token unsubscribes", good.status === 200 && (await optOut()) === true, String(good.status));
    } finally {
      // Put back exactly what was there, including no settings row at all.
      if (before?.has) {
        await db.query(`update user_settings set promo_opt_out = $2, promo_opt_out_at = $3 where user_id = $1`, [u.id, before.v, before.at]);
      } else {
        await db.query(`delete from user_settings where user_id = $1`, [u.id]);
      }
      const after = await one<{ v: boolean | null; at: Date | null }>(
        `select promo_opt_out as v, promo_opt_out_at as at from user_settings where user_id = $1`,
        [u.id],
      );
      check(
        "B6",
        "test user's opt-out restored",
        before?.has ? after?.v === before.v && String(after?.at) === String(before.at) : after === undefined,
      );
    }
  }
}

await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
