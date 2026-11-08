// Payments security checks (payments Phase 4). Report: docs/security-payments.md.
//
// Runs against the PRODUCTION build (headers, CSP and auth behave as deployed)
// on the local database:
//
//   docker run -d --name jobtiva-sec -p 3100:3000 --env-file <env> jobtiva:localtest
//   docker cp jobtiva-sec:/app/.next/server/server-reference-manifest.json <manifest>
//   APP_URL=http://127.0.0.1:3100 ACTION_MANIFEST=<manifest> \
//     node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs \
//       --import tsx scripts/security/payments-checks.mts
//
// Needs the LOCAL_TEST_* accounts (ui-test, ui-admin) and CRON_SECRET from
// .env.local. Everything it changes (gateway row, Billing, ui-test's plan,
// a temporary order on another account) is read first and restored at the
// end; the orders and reminder rows it creates are deleted. Your real gateway
// keys are put back byte for byte. Prints PASS/FAIL; exits 1 on any FAIL.

import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { encryptSecret } from "../../lib/crypto.ts";
import { startCheckout } from "../../lib/payments/orders.ts";

const APP = (process.env.APP_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const MANIFEST = process.env.ACTION_MANIFEST ?? "";
const CRON = process.env.CRON_SECRET ?? "";
const USER = { email: process.env.LOCAL_TEST_EMAIL ?? "", password: process.env.LOCAL_TEST_PASSWORD ?? "" };
const ADMIN = { email: process.env.LOCAL_TEST_ADMIN_EMAIL ?? "", password: process.env.LOCAL_TEST_ADMIN_PASSWORD ?? "" };

const KEY_SECRET = "sec-test-key-secret-not-real";
const WEBHOOK_SECRET = "sec-test-webhook-secret-not-real";
const DAY = 86_400_000;

let failures = 0;
function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? `  (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

/* ---------------- HTTP helpers ---------------- */

async function signIn(kind: "user" | "admin", who: { email: string; password: string }, ip: string): Promise<string> {
  const res = await fetch(`${APP}/api/${kind === "admin" ? "admin-auth" : "auth"}/sign-in/email`, {
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

/** Server Action ids and the page each one is served from (production manifest). */
function loadActions(): Map<string, { id: string; page: string }> {
  const out = new Map<string, { id: string; page: string }>();
  if (!MANIFEST) return out;
  const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    node: Record<string, { workers: Record<string, unknown>; exportedName?: string; filename?: string }>;
  };
  for (const [id, entry] of Object.entries(m.node)) {
    const name = entry.exportedName;
    if (!name) continue;
    const worker = Object.keys(entry.workers).find((w) => w.startsWith("app/")) ?? "";
    const page = (
      "/" +
      worker
        .replace(/^app\//, "")
        .replace(/\/page$/, "")
        .split("/")
        .filter((s) => !/^\(.*\)$/.test(s))
        .join("/")
    ).replace(/\/$/, "") || "/";
    if (!out.has(name)) out.set(name, { id, page });
  }
  return out;
}
const ACTIONS = loadActions();

interface ActionResult {
  status: number;
  body: string;
  /** The action's return value, when it returned normally. */
  value: unknown;
  redirect: string | null;
}

async function action(name: string, args: unknown[], cookie: string, extraHeaders: Record<string, string> = {}): Promise<ActionResult> {
  const a = ACTIONS.get(name);
  if (!a) throw new Error(`action ${name} not in manifest`);
  const res = await fetch(`${APP}${a.page}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "next-action": a.id,
      "content-type": "text/plain;charset=UTF-8",
      accept: "text/x-component",
      origin: APP,
      cookie,
      ...extraHeaders,
    },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  // RSC rows look like `1:{"ok":false,...}`; the action's value is row 1.
  let value: unknown = undefined;
  const row = body.split("\n").find((l) => /^1:/.test(l));
  if (row) {
    try {
      value = JSON.parse(row.slice(2));
    } catch {
      value = row.slice(2);
    }
  }
  return {
    status: res.status,
    body,
    value,
    redirect: res.headers.get("x-action-redirect") ?? res.headers.get("location"),
  };
}

/** The action's return value as text ("" when it didn't return one). */
const val = (r: ActionResult) => (r.value === undefined ? "" : JSON.stringify(r.value));

async function webhook(body: string, signature: string | null) {
  const res = await fetch(`${APP}/api/webhooks/razorpay`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature !== null ? { "x-razorpay-signature": signature } : {}) },
    body,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
const signed = (obj: object) => {
  const raw = JSON.stringify(obj);
  return { raw, sig: hmac(WEBHOOK_SECRET, raw) };
};
const paymentEvent = (event: string, entity: Record<string, unknown>) => ({ event, payload: { payment: { entity } } });

/* ---------------- static audit: every Server Action checks its caller ---------------- */

const AUTH_CALLS = ["requireAdmin(", "getSessionUser(", "getSessionUserId(", "getCurrentUserId(", "getActiveUserId("];
// Public by design: sign-up (behind the admin switch + rate limit), password
// reset (needs the emailed token) and one-click unsubscribe (HMAC-signed token,
// checked in constant time in lib/unsubscribe.ts).
const PUBLIC_BY_DESIGN = new Set([
  "actions/signup.ts:signUpAction",
  "actions/auth.ts:resetPasswordAction",
  "actions/unsubscribe.ts:unsubscribeAction",
  "actions/unsubscribe.ts:resubscribeAction",
]);

function auditActions(): { total: number; unguarded: string[] } {
  const unguarded: string[] = [];
  let total = 0;
  for (const f of readdirSync("actions").filter((n) => n.endsWith(".ts"))) {
    const file = `actions/${f}`;
    const src = readFileSync(file, "utf8");
    if (!/^["']use server["']/m.test(src)) continue;
    // Split into top-level functions; local helpers that check auth count too.
    const fns = [...src.matchAll(/^(export )?async function (\w+)/gm)].map((m, i, all) => ({
      exported: !!m[1],
      name: m[2],
      body: src.slice(m.index!, i + 1 < all.length ? all[i + 1].index : src.length),
    }));
    const guards = new Set(fns.filter((fn) => AUTH_CALLS.some((c) => fn.body.includes(c))).map((fn) => fn.name));
    // Helpers that call a guard helper are guards too (one level is enough here).
    for (const fn of fns) if ([...guards].some((g) => fn.body.includes(`${g}(`))) guards.add(fn.name);
    for (const fn of fns.filter((x) => x.exported)) {
      total++;
      const key = `${file}:${fn.name}`;
      if (PUBLIC_BY_DESIGN.has(key)) continue;
      const ok = AUTH_CALLS.some((c) => fn.body.includes(c)) || [...guards].some((g) => g !== fn.name && fn.body.includes(`${g}(`));
      if (!ok) unguarded.push(key);
    }
  }
  return { total, unguarded };
}

/* ---------------- main ---------------- */

async function main() {
  // ---- snapshot everything we touch
  const [gw] = await q("select * from payment_gateways where id = 'razorpay'");
  const [billing] = await q("select * from billing_config limit 1");
  const [u] = await q<{ id: string; plan_id: string; plan_expires_at: Date; status: string }>(
    `select id, plan_id, plan_expires_at, status from "user" where email = $1`,
    [USER.email],
  );
  const [other] = await q<{ id: string }>(`select id from "user" where email <> $1 and role <> 'admin' order by created_at limit 1`, [USER.email]);
  const startedAt = new Date();
  const tempOrders: string[] = [];
  if (!gw || !billing || !u || !other) throw new Error("missing gateway / billing / test users");
  const plans = await q<{ id: string; name: string; is_free: boolean; status: string; show_on_pricing: boolean; monthly_price: number; yearly_price: number }>(
    "select id, name, is_free, status, show_on_pricing, monthly_price, yearly_price from plans",
  );
  const paidListed = plans.find((p) => !p.is_free && p.status === "active" && p.show_on_pricing && p.monthly_price > 0)!;
  const free = plans.find((p) => p.is_free);
  const inactive = plans.find((p) => p.status !== "active");
  // (During the run ui-test is on paidListed, so any other unlisted plan isn't theirs.)
  const unlisted = plans.find((p) => !p.is_free && p.status === "active" && !p.show_on_pricing);

  try {
    // Fake keys we know the secrets of; Razorpay itself will reject them.
    await q(
      `update payment_gateways set enabled = true, mode = 'test', key_id = 'rzp_test_SecCheckFake01',
         key_secret_ciphertext = $1, webhook_secret_ciphertext = $2 where id = 'razorpay'`,
      [encryptSecret(KEY_SECRET), encryptSecret(WEBHOOK_SECRET)],
    );
    // ui-test on a running paid plan.
    await q(`update "user" set plan_id = $1, plan_expires_at = now() + interval '20 days' where id = $2`, [paidListed.id, u.id]);

    /* ---- A: Server Actions check the caller ---- */
    const audit = auditActions();
    check("A1", "every Server Action checks the caller (static scan)", audit.unguarded.length === 0, `${audit.total} actions; unguarded: ${audit.unguarded.join(", ") || "none"}`);

    /* ---- P: plan and price integrity (server-side order creation) ---- */
    const refused = async (planId: string, period: "monthly" | "yearly") => {
      const before = (await q("select count(*)::int n from payment_orders where user_id = $1", [u.id]))[0].n;
      const r = await startCheckout(u.id, planId, period);
      const after = (await q("select count(*)::int n from payment_orders where user_id = $1", [u.id]))[0].n;
      return { r, created: after - before };
    };
    if (free) {
      const x = await refused(free.id, "monthly");
      check("P1", "a free plan can't be bought", !x.r.ok && x.created === 0, !x.r.ok ? x.r.error : "accepted");
    }
    if (inactive) {
      const x = await refused(inactive.id, "monthly");
      check("P2", "an inactive plan can't be bought", !x.r.ok && x.created === 0, !x.r.ok ? x.r.error : "accepted");
    }
    if (unlisted) {
      const x = await refused(unlisted.id, "monthly");
      check("P3", "an unlisted plan (not the user's own) can't be bought", !x.r.ok && x.created === 0, !x.r.ok ? x.r.error : "accepted");
    }
    {
      const x = await refused("00000000-0000-4000-8000-000000000000", "monthly");
      check("P4", "an unknown plan id is refused", !x.r.ok && x.created === 0);
    }

    // Billing incomplete → no order at all, fallback flag.
    await q("update billing_config set gst_registered = null");
    {
      const x = await refused(paidListed.id, "monthly");
      check("P5", "Billing incomplete → no online payment (fallback)", !x.r.ok && !!x.r.fallback && x.created === 0);
    }
    await q("update billing_config set gst_registered = $1", [billing.gst_registered]);
    // Gateway off → fallback.
    await q("update payment_gateways set enabled = false where id = 'razorpay'");
    {
      const x = await refused(paidListed.id, "monthly");
      check("P6", "gateway off → no online payment (fallback)", !x.r.ok && !!x.r.fallback && x.created === 0);
    }
    await q("update payment_gateways set enabled = true where id = 'razorpay'");
    // Deactivated account.
    await q(`update "user" set status = 'inactive' where id = $1`, [u.id]);
    {
      const x = await refused(paidListed.id, "monthly");
      check("P7", "a deactivated account can't pay", !x.r.ok && x.created === 0);
    }
    await q(`update "user" set status = $1 where id = $2`, [u.status, u.id]);

    /* ---- sessions (production build) ---- */
    const userCookie = await signIn("user", USER, "10.9.0.1");
    const adminCookie = await signIn("admin", ADMIN, "10.9.0.2");
    check("H0", "action manifest loaded", ACTIONS.size > 50, `${ACTIONS.size} actions`);

    // P8: the browser can't set the amount: extra fields are ignored.
    {
      const r = await action("startCheckoutAction", [{ planId: paidListed.id, period: "monthly", amount: 100, total: 100 }], userCookie);
      const [o] = await q<{ total_amount: number; base_amount: number }>(
        "select total_amount, base_amount from payment_orders where user_id = $1 order by created_at desc limit 1",
        [u.id],
      );
      check(
        "P8",
        "amount comes from the server, not the request",
        !!o && o.base_amount === paidListed.monthly_price * 100,
        `sent amount 100, order base ${o?.base_amount} total ${o?.total_amount}; ${val(r).slice(0, 80)}`,
      );
    }
    {
      const r = await action("startCheckoutAction", [{ planId: "not-a-uuid", period: "weekly" }], userCookie);
      check("P9", "malformed checkout input is refused by validation", val(r).includes('"ok":false'));
    }
    {
      const r = await action("startCheckoutAction", [{ planId: paidListed.id, period: "monthly" }], "");
      // The middleware turns a cookie-less request away before the action runs.
      check("P10", "signed out → checkout refused", val(r).includes("sign in") || (r.status >= 300 && r.status < 400), `${r.status} ${r.redirect ?? ""}`);
    }

    /* ---- O: other users' orders (IDOR) ---- */
    const [otherOrder] = await q<{ id: string }>(
      `insert into payment_orders (receipt_prefix, user_id, plan_id, plan_name, period, kind, currency,
         base_amount, tax_amount, total_amount, tax_rate, prices_include_tax, gateway, mode, gateway_order_id)
       values ('SEC-', $1, $2, $3, 'monthly', 'new', 'INR', $4, 0, $4, 0, false, 'razorpay', 'test', 'order_SECOTHER0001')
       returning id`,
      [other.id, paidListed.id, paidListed.name, paidListed.monthly_price * 100],
    );
    tempOrders.push(otherOrder.id);
    {
      const sig = hmac(KEY_SECRET, "order_SECOTHER0001|pay_SECOTHER0001");
      const r = await action(
        "verifyCheckoutAction",
        [{ orderId: otherOrder.id, razorpayOrderId: "order_SECOTHER0001", razorpayPaymentId: "pay_SECOTHER0001", razorpaySignature: sig }],
        userCookie,
      );
      const [o] = await q<{ status: string }>("select status from payment_orders where id = $1", [otherOrder.id]);
      check("O1", "can't verify another user's order, even with a valid signature", o.status === "created" && val(r).includes("not found"), val(r));
    }
    {
      const r = await action("closeCheckoutAction", [{ orderId: otherOrder.id, outcome: "cancelled" }], userCookie);
      const [o] = await q<{ status: string }>("select status from payment_orders where id = $1", [otherOrder.id]);
      check("O2", "can't cancel another user's order", o.status === "created" && val(r).includes('"ok":false'), val(r));
    }
    for (const [id, name, args] of [
      ["O3", "listOrdersAction", [{ from: new Date(Date.now() - 365 * DAY).toISOString(), to: new Date().toISOString() }]],
      ["O4", "listRenewalsAction", []],
      ["O5", "getGatewaysAction", []],
      ["O6", "resendReceiptAction", [{ orderId: otherOrder.id }]],
    ] as const) {
      const r = await action(name, args as unknown[], userCookie);
      const leaked = /@/.test(r.body) && r.body.includes('"rows"');
      check(id, `user session can't call admin ${name}`, !leaked && (!!r.redirect || r.status >= 300), `${r.status} → ${r.redirect ?? "no redirect"}`);
    }
    {
      const before = (await q("select key_id from payment_gateways where id = 'razorpay'"))[0].key_id;
      const r = await action("saveGatewayAction", [{ id: "razorpay", mode: "test", keyId: "rzp_test_Hijacked0001", keySecret: "x", webhookSecret: "y" }], userCookie);
      const after = (await q("select key_id from payment_gateways where id = 'razorpay'"))[0].key_id;
      check("O7", "user session can't change gateway keys", before === after, `${r.status} → ${r.redirect ?? "no redirect"}`);
    }

    /* ---- S: checkout signature ---- */
    const [mine] = await q<{ id: string }>(
      `insert into payment_orders (receipt_prefix, user_id, plan_id, plan_name, period, kind, currency,
         base_amount, tax_amount, total_amount, tax_rate, prices_include_tax, gateway, mode, gateway_order_id)
       values ('SEC-', $1, $2, $3, 'monthly', 'renew', 'INR', $4, 0, $4, 0, false, 'razorpay', 'test', 'order_SECMINE00001')
       returning id`,
      [u.id, paidListed.id, paidListed.name, paidListed.monthly_price * 100],
    );
    tempOrders.push(mine.id);
    const verify = (paymentId: string, signature: string, orderId = "order_SECMINE00001") =>
      action("verifyCheckoutAction", [{ orderId: mine.id, razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature }], userCookie);
    const statusOf = async (id: string) => (await q<{ status: string }>("select status from payment_orders where id = $1", [id]))[0].status;
    {
      const r = await verify("pay_SECMINE00001", "0".repeat(64));
      check("S1", "wrong signature → not paid", (await statusOf(mine.id)) === "created", val(r));
    }
    {
      const r = await verify("pay_SECMINE00002", hmac(KEY_SECRET, "order_SECMINE00001|pay_SECMINE00001"));
      check("S2", "a signature for another payment id → not paid", (await statusOf(mine.id)) === "created", val(r));
    }
    {
      const r = await verify("pay_SECMINE00001", "not-hex");
      check("S3", "malformed signature → refused by validation", (await statusOf(mine.id)) === "created", val(r));
    }
    {
      const r = await verify("pay_SECMINE00001", hmac(KEY_SECRET, "order_OTHERORDER01|pay_SECMINE00001"), "order_OTHERORDER01");
      check("S4", "a gateway order id that isn't this order's → refused", (await statusOf(mine.id)) === "created", val(r));
    }
    {
      // Correct signature, but Razorpay (fake keys) can't confirm the payment:
      // a valid signature alone never marks an order paid.
      const r = await verify("pay_SECMINE00001", hmac(KEY_SECRET, "order_SECMINE00001|pay_SECMINE00001"));
      check("S5", "valid signature but unconfirmed by Razorpay → not paid", (await statusOf(mine.id)) === "created", val(r));
    }

    /* ---- W: webhook ---- */
    const entity = (over: Record<string, unknown> = {}) => ({
      id: "pay_SECMINE00001",
      order_id: "order_SECMINE00001",
      amount: paidListed.monthly_price * 100,
      currency: "INR",
      status: "captured",
      method: "card",
      error_description: null,
      ...over,
    });
    {
      const { raw } = signed(paymentEvent("payment.captured", entity()));
      check("W1", "no signature → 401", (await webhook(raw, null)).status === 401);
      check("W2", "wrong signature → 401", (await webhook(raw, hmac("guess", raw))).status === 401);
      check("W3", "non-hex signature → 401", (await webhook(raw, "zz")).status === 401);
      const tampered = raw.replace(String(paidListed.monthly_price * 100), "100");
      check("W4", "body changed after signing → 401", (await webhook(tampered, hmac(WEBHOOK_SECRET, raw))).status === 401);
      check("W5", "oversized body → 413", (await webhook(" ".repeat(300 * 1024), "a".repeat(64))).status === 413);
    }
    {
      const s = signed(paymentEvent("payment.captured", entity({ order_id: "order_NOTOURS00001" })));
      const r = await webhook(s.raw, s.sig);
      check("W6", "signed event for an order that isn't ours → ignored", r.status === 200 && !!r.json?.ignored);
    }
    {
      const s = signed(paymentEvent("payment.captured", entity({ amount: 100 })));
      await webhook(s.raw, s.sig);
      check("W7", "amount mismatch → not paid", (await statusOf(mine.id)) === "created");
      const c = signed(paymentEvent("payment.captured", entity({ currency: "USD" })));
      await webhook(c.raw, c.sig);
      check("W8", "currency mismatch → not paid", (await statusOf(mine.id)) === "created");
      const a = signed(paymentEvent("payment.captured", entity({ status: "refunded" })));
      await webhook(a.raw, a.sig);
      check("W9", "a payment that isn't captured → not paid", (await statusOf(mine.id)) === "created");
    }
    {
      const before = (await q<{ plan_expires_at: Date }>(`select plan_expires_at from "user" where id = $1`, [u.id]))[0].plan_expires_at;
      const s = signed(paymentEvent("payment.captured", entity()));
      // Five at once: the plan must be applied exactly once.
      const all = await Promise.all(Array.from({ length: 5 }, () => webhook(s.raw, s.sig)));
      const after = (await q<{ plan_expires_at: Date }>(`select plan_expires_at from "user" where id = $1`, [u.id]))[0].plan_expires_at;
      // user.plan_expires_at has no time zone (stored as UTC); compare in SQL so
      // the driver's local-time parsing can't skew it.
      const [o] = await q<{ status: string; kind: string; same: boolean }>(
        `select o.status, o.kind, o.term_ends_at = (u.plan_expires_at at time zone 'UTC') as same
           from payment_orders o join "user" u on u.id = o.user_id where o.id = $1`,
        [mine.id],
      );
      const oneMonth = after.getTime() - before.getTime();
      check(
        "W10",
        "5 identical webhooks at once → plan applied once",
        all.every((r) => r.status === 200) && o.status === "paid" && oneMonth > 27 * DAY && oneMonth < 32 * DAY && o.same,
        `http ${all.map((r) => r.status).join("/")}, renewal added ${(oneMonth / DAY).toFixed(1)} days, kind ${o.kind}, term matches plan: ${o.same}`,
      );
      await webhook(s.raw, s.sig);
      const again = (await q<{ plan_expires_at: Date }>(`select plan_expires_at from "user" where id = $1`, [u.id]))[0].plan_expires_at;
      check("W11", "replayed webhook later → no change", +again === +after);
      const f = signed(paymentEvent("payment.failed", entity({ status: "failed", error_description: "Declined" })));
      await webhook(f.raw, f.sig);
      check("W12", "payment.failed can't undo a paid order", (await statusOf(mine.id)) === "paid");
      const cl = await action("closeCheckoutAction", [{ orderId: mine.id, outcome: "failed", reason: "x" }], userCookie);
      check("W13", "the browser can't mark a paid order failed", (await statusOf(mine.id)) === "paid", val(cl));
    }
    {
      // Billing changes later never alter an order.
      const [o1] = await q<{ base_amount: number; tax_amount: number; billing_snapshot: unknown }>(
        "select base_amount, tax_amount, billing_snapshot from payment_orders where user_id = $1 and receipt_prefix <> 'SEC-' order by created_at desc limit 1",
        [u.id],
      );
      await q("update billing_config set tax_rate = 28, company_name = 'Changed Later Ltd'");
      const [o2] = await q<{ base_amount: number; tax_amount: number; billing_snapshot: unknown }>(
        "select base_amount, tax_amount, billing_snapshot from payment_orders where user_id = $1 and receipt_prefix <> 'SEC-' order by created_at desc limit 1",
        [u.id],
      );
      check("B1", "changing Billing doesn't alter existing orders", JSON.stringify(o1) === JSON.stringify(o2) && !!o1?.billing_snapshot);
      await q("update billing_config set tax_rate = $1, company_name = $2", [billing.tax_rate, billing.company_name]);
    }

    /* ---- R: order rate limit ---- */
    {
      let refusedAt = 0;
      for (let i = 1; i <= 12 && !refusedAt; i++) {
        const r = await startCheckout(u.id, paidListed.id, "monthly");
        if (!r.ok && /Too many/.test(r.error)) refusedAt = i;
      }
      const [{ n }] = await q<{ n: number }>("select count(*)::int n from payment_orders where user_id = $1 and created_at > now() - interval '1 hour'", [u.id]);
      check("R1", "at most 10 checkouts an hour per user", refusedAt > 0 && n <= 10, `refused on attempt ${refusedAt}, ${n} orders this hour`);
    }

    /* ---- K: secrets ---- */
    {
      const [row] = await q<Record<string, string>>("select * from payment_gateways where id = 'razorpay'");
      const dump = JSON.stringify(row);
      check("K1", "secrets are encrypted at rest", !dump.includes(KEY_SECRET) && !dump.includes(WEBHOOK_SECRET));
      const page = await (await fetch(`${APP}/jmp-admin/settings?section=payments`, { headers: { cookie: adminCookie } })).text();
      check(
        "K2",
        "admin Settings page never contains the secrets or their ciphertext",
        page.includes("rzp_test_SecCheckFake01") &&
          !page.includes(KEY_SECRET) &&
          !page.includes(WEBHOOK_SECRET) &&
          !page.includes(row.key_secret_ciphertext) &&
          !page.includes(row.webhook_secret_ciphertext),
        `page ${page.length} bytes`,
      );
      const gws = await action("getGatewaysAction", [], adminCookie);
      check("K3", "getGatewaysAction returns no secret fields", !/ciphertext|keySecret"|webhookSecret"/.test(gws.body) && gws.body.includes("hasKeySecret"));
      const reasons = (await q<{ failure_reason: string | null }>("select failure_reason from payment_orders where user_id = $1", [u.id])).map((r) => r.failure_reason ?? "").join(" ");
      check("K4", "failure reasons never contain the secret", !reasons.includes(KEY_SECRET));
    }

    /* ---- G: admin gateway rules ---- */
    {
      const save = (args: Record<string, unknown>) => action("saveGatewayAction", [{ id: "razorpay", ...args }], adminCookie);
      let r = await save({ mode: "live", keyId: "rzp_test_SecCheckFake01" });
      check("G1", "a test key can't be saved in live mode", val(r).includes('"ok":false'), val(r));
      r = await save({ mode: "test", keyId: "rzp_test_SecCheckFake02" });
      check("G2", "a new key ID needs its secret", val(r).includes('"ok":false'), val(r));
      r = await save({ mode: "test", keyId: "" });
      check("G3", "can't remove keys while the gateway is on", val(r).includes('"ok":false'), val(r));
      await q("update payment_gateways set enabled = false, webhook_secret_ciphertext = null where id = 'razorpay'");
      r = await action("setGatewayEnabledAction", [{ id: "razorpay", enabled: true }], adminCookie);
      const [{ enabled }] = await q<{ enabled: boolean }>("select enabled from payment_gateways where id = 'razorpay'");
      check("G4", "can't turn on without all three credentials", !enabled && val(r).includes('"ok":false'), val(r));
      await q("update payment_gateways set enabled = true, webhook_secret_ciphertext = $1 where id = 'razorpay'", [encryptSecret(WEBHOOK_SECRET)]);
    }

    /* ---- L: limited mode (expired plan) ---- */
    await q(`update "user" set plan_expires_at = now() - interval '1 day' where id = $1`, [u.id]);
    {
      const locked = ["/leads", "/todo", "/contacts", "/outreach", "/outreached", "/reminders", "/archive", "/ready", "/notifications"];
      const bad: string[] = [];
      for (const p of locked) {
        const res = await fetch(`${APP}${p}`, { headers: { cookie: userCookie }, redirect: "manual" });
        const to = res.headers.get("location") ?? "";
        if (!(res.status >= 300 && res.status < 400 && to.includes("/upgrade"))) bad.push(`${p}:${res.status}`);
      }
      check("L1", "every locked page redirects an expired user to /upgrade", bad.length === 0, bad.join(", ") || `${locked.length} pages`);
      const open: string[] = [];
      for (const p of ["/upgrade", "/settings", "/guides"]) {
        const res = await fetch(`${APP}${p}`, { headers: { cookie: userCookie }, redirect: "manual" });
        if (res.status !== 200) open.push(`${p}:${res.status}`);
      }
      check("L2", "Upgrade Plan, Settings and guides stay open", open.length === 0, open.join(", "));
      const spoof = await fetch(`${APP}/leads`, { headers: { cookie: userCookie, "x-pathname": "/upgrade" }, redirect: "manual" });
      check("L3", "a spoofed x-pathname header doesn't unlock a page", (spoof.headers.get("location") ?? "").includes("/upgrade"), String(spoof.status));
      const rsc = await fetch(`${APP}/leads`, { headers: { cookie: userCookie, rsc: "1" }, redirect: "manual" });
      const rscBody = await rsc.text();
      check("L4", "client-side navigation (RSC) to a locked page is redirected too", rscBody.includes("/upgrade") || (rsc.headers.get("location") ?? "").includes("/upgrade"), String(rsc.status));
      const leadsBefore = (await q<{ n: number }>("select count(*)::int n from job_leads where user_id = $1", [u.id]))[0].n;
      const add = await action(
        "createLeadAction",
        [{ title: "Tester", company: "Sec Check Co", location: "", remote: true, jobUrl: "https://example.com/job/1", status: "new", tags: [], jdText: "" }],
        userCookie,
      );
      const leadsAfter = (await q<{ n: number }>("select count(*)::int n from job_leads where user_id = $1", [u.id]))[0].n;
      check("L5", "feature actions refuse an expired user (add lead)", leadsAfter === leadsBefore, `http ${add.status}`);
      // A valid change that would land if the action weren't gated.
      const [{ h }] = await q<{ h: number }>("select sync_interval_hours h from user_settings where user_id = $1", [u.id]);
      const fu = await action("updateSyncIntervalAction", [h === 6 ? 12 : 6], userCookie);
      const [{ h: h2 }] = await q<{ h: number }>("select sync_interval_hours h from user_settings where user_id = $1", [u.id]);
      check("L6", "Settings feature actions refuse an expired user", h2 === h, `http ${fu.status}`);
      if (h2 !== h) await q("update user_settings set sync_interval_hours = $1 where user_id = $2", [h, u.id]);
      const pay = await action("startCheckoutAction", [{ planId: paidListed.id, period: "monthly" }], userCookie);
      check("L7", "an expired user can still start a payment", !val(pay).includes("plan has ended"), val(pay).slice(0, 90));
    }

    /* ---- C: cron + admin pages ---- */
    {
      const call = (auth?: string) =>
        fetch(`${APP}/api/cron/plan-reminders`, { method: "POST", headers: auth ? { authorization: auth } : {} }).then((r) => r.status);
      check("C1", "reminders cron without the secret → 401", (await call()) === 401);
      check("C2", "reminders cron with a wrong secret → 401", (await call("Bearer wrong")) === 401);
      check("C3", "reminders cron with the secret → 200", CRON !== "" && (await call(`Bearer ${CRON}`)) === 200);
      const bad: string[] = [];
      for (const p of ["/jmp-admin/orders", "/jmp-admin/renewals", "/jmp-admin/settings"]) {
        const res = await fetch(`${APP}${p}`, { redirect: "manual" });
        if (!(res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/jmp-admin/login"))) bad.push(`${p}:${res.status}`);
        const asUser = await fetch(`${APP}${p}`, { headers: { cookie: userCookie }, redirect: "manual" });
        if (!(asUser.status >= 300 && asUser.status < 400)) bad.push(`${p} as user:${asUser.status}`);
      }
      check("C4", "payment admin pages need an admin session", bad.length === 0, bad.join(", "));
    }

    /* ---- H: headers (production build) ---- */
    {
      const h = (await fetch(`${APP}/login`)).headers;
      const csp = h.get("content-security-policy") ?? "";
      const dir = (name: string) => csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + " ")) ?? "";
      check("H1", "CSP allows Razorpay's script and nothing new besides", dir("script-src").includes("https://checkout.razorpay.com") && !/\s\*(\s|$)|https:\s|http:/.test(dir("script-src")), dir("script-src"));
      check("H2", "CSP frames only known hosts", dir("frame-src").includes("https://api.razorpay.com") && !/\s\*(\s|$)/.test(dir("frame-src")));
      check("H3", "CSP still blocks framing of our pages", dir("frame-ancestors") === "frame-ancestors 'none'" && h.get("x-frame-options") === "DENY");
      const coop = async (p: string, cookie = "") =>
        (await fetch(`${APP}${p}`, { headers: cookie ? { cookie } : {}, redirect: "manual" })).headers.get("cross-origin-opener-policy");
      check("H4", "popups allowed only on the checkout pages", (await coop("/upgrade", userCookie)) === "same-origin-allow-popups" && (await coop("/settings", userCookie)) === "same-origin-allow-popups" && (await coop("/login")) === "same-origin" && (await coop("/")) === "same-origin");
      check("H5", "Payment Request API limited to us and Razorpay", (h.get("permissions-policy") ?? "").includes('payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")'));
    }
  } finally {
    // ---- restore
    await q(
      `update payment_gateways set enabled = $1, mode = $2, key_id = $3, key_secret_ciphertext = $4,
         webhook_secret_ciphertext = $5, last_test_ok = $6, last_test_at = $7 where id = 'razorpay'`,
      [gw.enabled, gw.mode, gw.key_id, gw.key_secret_ciphertext, gw.webhook_secret_ciphertext, gw.last_test_ok, gw.last_test_at],
    );
    await q("update billing_config set gst_registered = $1, tax_rate = $2, company_name = $3", [billing.gst_registered, billing.tax_rate, billing.company_name]);
    await q(`update "user" set plan_id = $1, plan_expires_at = $2, status = $3 where id = $4`, [u.plan_id, u.plan_expires_at, u.status, u.id]);
    await q("delete from payment_orders where user_id = $1 and created_at >= $2", [u.id, startedAt]);
    if (tempOrders.length) await q("delete from payment_orders where id = any($1)", [tempOrders]);
    await q("delete from plan_reminders_sent where user_id = $1 and sent_at >= $2", [u.id, startedAt]);
    await q("delete from job_leads where user_id = $1 and company = 'Sec Check Co'", [u.id]);
    const [g2] = await q("select * from payment_gateways where id = 'razorpay'");
    const [u2] = await q<{ plan_id: string; plan_expires_at: Date }>(`select plan_id, plan_expires_at from "user" where id = $1`, [u.id]);
    console.log(
      `\nRestored: gateway ${g2.key_secret_ciphertext === gw.key_secret_ciphertext && g2.enabled === gw.enabled ? "ok" : "MISMATCH"}, ui-test plan ${u2.plan_id === u.plan_id && +u2.plan_expires_at === +u.plan_expires_at ? "ok" : "MISMATCH"}`,
    );
    await db.end();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

void sleep;
void path;
main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
