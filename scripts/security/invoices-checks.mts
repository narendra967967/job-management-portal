// Invoice checks (docs/invoices/spec.md, phase 4), run before a deploy. From
// the repo root, against the local stack:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/invoices-checks.mts
//
// APP_URL (e.g. http://127.0.0.1:3000) adds the signed-out HTTP checks.
// It issues invoices for two throwaway test-mode orders on the local test
// user, then removes them (a superuser session skips the database's
// never-delete guard; the server's app users can't) and puts back exactly the
// counters, billing details and Billing terms that were there before.
// Nothing is emailed, and no payment gateway is contacted.
// Prints PASS/FAIL per check and exits non-zero on any FAIL.

import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Run this against a local stack, not production.");
  process.exit(1);
}

const APP = process.env.APP_URL ?? "";
let failures = 0;
function check(id: string, name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${detail ? `  (${detail})` : ""}`);
}
// Windows checkouts get CRLF line endings; the patterns below expect \n.
const read = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

const { splitTax } = await import("../../lib/invoices/tax.ts");
const { billingErrors, isBillingComplete } = await import("../../lib/invoices/billing-details.ts");
const { formatInvoiceNumber, financialYear, invoicePrefixError, amountInWords, INVOICE_PREFIX_MAX } = await import("../../lib/invoices/model.ts");
const { safeNextPath } = await import("../../lib/safe-next.ts");
const { ensureInvoice, TEST_INVOICE_PREFIX } = await import("../../lib/invoices/issue.ts");

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as T[];

/* ---------------- S: the code is wired the way the spec says ---------------- */

{
  const user = read("app/api/invoices/[orderId]/route.ts");
  check("S1", "user invoice route checks the session first", /getSessionUserId\(\)[\s\S]*invoiceDenied\(request, "signin"\)/.test(user));
  check("S1", "user invoice route serves only the signed-in user's paid orders", /eq\(paymentOrders\.userId, userId\)/.test(user) && /eq\(paymentOrders\.status, "paid"\)/.test(user));
  const admin = read("app/api/admin/invoices/[orderId]/route.ts");
  check("S1", "admin invoice route requires an admin", /await requireAdmin\(\)/.test(admin));
  for (const [name, src] of [["user", user], ["admin", admin]] as const) {
    check("S2", `${name} route draws the PDF from the stored copy`, /renderInvoicePdf\(inv\.doc/.test(src) && !/buildInvoiceDoc/.test(src));
  }
  const dir = "lib/invoices";
  const disk = readdirSync(dir).filter((f) => /writeFile|createWriteStream|appendFile|from "node:fs"|from "fs"/.test(read(`${dir}/${f}`)));
  check("S3", "nothing in lib/invoices writes to disk (PDFs are drawn in memory)", disk.length === 0, disk.join(", "));

  const orders = read("lib/payments/orders.ts");
  const ai = read("lib/payments/ai-interview-orders.ts");
  const booking = read("lib/mock-interviews/booking.ts");
  check("S4", "plan checkout refuses to start without complete billing details", /isBillingComplete\(buyer\)\) return \{ ok: false, needsBilling: true/.test(orders));
  check("S4", "AI interview checkout refuses without them", /isBillingComplete\(buyer\)\) return \{ ok: false, needsBilling: true/.test(ai));
  check("S4", "a paid AI interview isn't booked without them", /quote && !isBillingComplete\(await getUserBilling\(userId\)\)\) return \{ ok: false, error: BILLING_NEEDED, needsBilling: true/.test(booking));
  check("S4", "both checkouts copy the buyer and the tax split onto the order", (orders.match(/buyerSnapshot: buyer/g)?.length ?? 0) >= 1 && /buyerSnapshot: buyer/.test(ai) && /placeOfSupply: split\.placeOfSupply/.test(orders) && /placeOfSupply: gst\.placeOfSupply/.test(ai));
  check("S5", "an invoice is issued after each confirmed payment", /afterPaid\(order\.id, sendReceipt\)/.test(orders) && /afterPaid\(order\.id, sendAiInterviewReceipt\)/.test(ai));
  check("S5", "issuing sits outside the payment's own transaction", !/db\.transaction[\s\S]*?ensureInvoice[\s\S]*?\}\);\n\n  if \(!result\)/.test(orders));
  check("S5", "missing invoices are issued at server start", /issueMissingInvoices\(\)/.test(read("instrumentation.ts")));
  const retention = read("lib/retention.ts");
  check("S6", "data retention never touches orders or invoices", !/paymentOrders|payment_orders|invoices\b|invoiceCounters/.test(retention));
  check("S7", "Email me the invoice only sends the user's own invoices", /emailInvoiceCopies\(p\.data, userId\)/.test(read("actions/my-payments.ts")));
  check("S7", "the Invoice copy email is registered in Email templates", /key: "invoice_copy"/.test(read("lib/email-templates-model.ts")));
  check("S8", "the rupee font ships with the server build", /outputFileTracingIncludes[\s\S]*noto-sans-devanagari/.test(read("next.config.ts")));
}

/* ---------------- L: the rules themselves ---------------- */

{
  check("L1", "GST off: no split", JSON.stringify(splitTax(900, { registered: false, sellerState: "06", buyerState: "27" })) === JSON.stringify({ cgst: 0, sgst: 0, igst: 0, placeOfSupply: null, split: null, utgst: false }));
  const same = splitTax(7, { registered: true, sellerState: "06", buyerState: "06" });
  check("L1", "same state: CGST + SGST adding up to the tax, odd paise too", same.split === "intra" && same.cgst + same.sgst === 7 && same.igst === 0 && same.placeOfSupply === "06");
  const other = splitTax(9000, { registered: true, sellerState: "06", buyerState: "29" });
  check("L1", "another state: all IGST, place of supply is the buyer's", other.split === "inter" && other.igst === 9000 && other.cgst + other.sgst === 0 && other.placeOfSupply === "29");
  check("L1", "seller in a union territory without legislature: UTGST", splitTax(100, { registered: true, sellerState: "04", buyerState: "04" }).utgst === true);
  check("L1", "no buyer state on record: the seller's state (CGST + SGST)", splitTax(100, { registered: true, sellerState: "06", buyerState: null }).split === "intra");

  const ok = { fullName: "Test Buyer", mobile: "9876543210", addressLine: "1 Test Lane", city: "Pune", stateCode: "27", pin: "411045", country: "IN" as const, gstin: "", businessName: "", pan: "" };
  check("L2", "complete billing details pass", isBillingComplete(ok));
  check("L2", "each required field is required", ["fullName", "mobile", "addressLine", "city", "stateCode", "pin"].every((k) => !!billingErrors({ ...ok, [k]: "" })[k as keyof typeof ok]));
  check("L2", "a PIN starting with 0 is refused", !!billingErrors({ ...ok, pin: "011045" }).pin);
  check("L2", "a GSTIN from another state is refused", !!billingErrors({ ...ok, gstin: "29AAPFU0939F1ZV", businessName: "X" }).gstin);
  check("L2", "a business GSTIN needs the business name", !!billingErrors({ ...ok, stateCode: "27", gstin: "27AAPFU0939F1ZV" }).businessName);
  check("L2", "a badly formed PAN is refused; PAN is optional", !!billingErrors({ ...ok, pan: "ABC" }).pan && !billingErrors(ok).pan);

  check("L3", "the longest prefix still fits Rule 46's 16 characters", formatInvoiceNumber("X".repeat(INVOICE_PREFIX_MAX), "26-27", 99999).length <= 16);
  check("L3", "a 6-character prefix is refused", !!invoicePrefixError("ABCDEF") && !invoicePrefixError("JT/"));
  check("L3", "financial year turns on April 1 in India time", financialYear("2027-03-31T18:00:00Z") === "26-27" && financialYear("2027-03-31T19:00:00Z") === "27-28");
  check("L3", "amount in words, Indian style", amountInWords(123456789) === "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paise Only");

  check("L4", "sign-in returns only to a page on this site", safeNextPath("/api/invoices/x") === "/api/invoices/x" && [ "//evil.com", "/\\evil.com", "https://evil.com", "/login?x=1", "/jmp-admin/x"].every((v) => safeNextPath(v) === null));
}

/* ---------------- D: what's in the database ---------------- */

{
  const paid = await q<{ id: string; n: number }>(`select o.id, count(i.id)::int as n from payment_orders o left join invoices i on i.order_id = o.id where o.status = 'paid' group by o.id`);
  check("D1", "every paid order has exactly one invoice", paid.every((r) => r.n === 1), `${paid.length} paid orders`);
  const unpaid = await q(`select i.number from invoices i join payment_orders o on o.id = i.order_id where o.status <> 'paid'`);
  check("D1", "no unpaid order has an invoice", unpaid.length === 0);

  const rows = await q<{ series: string; seq: number; number: string; mode: string; financial_year: string }>(`select series, seq, number, mode::text as mode, financial_year from invoices order by series, seq`);
  const counters = new Map((await q<{ series: string; last_seq: number }>(`select series, last_seq from invoice_counters`)).map((c) => [c.series, c.last_seq]));
  const bySeries = new Map<string, typeof rows>();
  for (const r of rows) bySeries.set(r.series, [...(bySeries.get(r.series) ?? []), r]);
  let unbroken = true;
  let named = true;
  let modes = true;
  for (const [series, list] of bySeries) {
    const [mode, prefix, fy] = series.split("|");
    if (!list.every((r, i) => r.seq === i + 1) || counters.get(series) !== list.length) unbroken = false;
    if (!list.every((r) => r.number === formatInvoiceNumber(prefix, fy, r.seq) && r.number.length <= 16 && /^[A-Za-z0-9/-]+$/.test(r.number))) named = false;
    if (!list.every((r) => r.mode === mode) || (mode === "test") !== (prefix === TEST_INVOICE_PREFIX)) modes = false;
  }
  check("D2", "numbers run 1, 2, 3… with no gaps in every series, matching its counter", unbroken, `${bySeries.size} series`);
  check("D2", "every number is prefix + year + sequence, at most 16 characters", named);
  check("D2", "test payments never use the real series", modes);

  // The database's own guards, tried inside a transaction that's rolled back.
  const anyInvoice = rows[0];
  const guard = async (sql: string) => {
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query(sql, anyInvoice ? [anyInvoice.number] : []);
      return "allowed";
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  if (anyInvoice) {
    check("D3", "an issued invoice can't be changed", /never changes/.test(await guard(`update invoices set doc = '{}'::jsonb where number = $1`)));
    check("D3", "an invoice can't be deleted", /never deleted/.test(await guard(`delete from invoices where number = $1`)));
    check("D3", "an order can't be deleted", /never deleted/.test(await guard(`delete from payment_orders where id = (select order_id from invoices where number = $1)`)));
  } else console.log("SKIP  D3  no invoices yet to try the guards on");
}

/* ---------------- I: issuing, on two throwaway orders ---------------- */

const testEmail = process.env.LOCAL_TEST_EMAIL ?? "";
const [tu] = testEmail ? await q<{ id: string; name: string }>(`select id, name from "user" where lower(email) = lower($1)`, [testEmail]) : [];
if (!tu) {
  console.log("SKIP  I  no local test user (LOCAL_TEST_EMAIL)");
} else {
  const countersBefore = await q(`select series, last_seq, updated_at from invoice_counters`);
  const [billingBefore] = await q<{ invoice_terms: unknown }>(`select invoice_terms from billing_config limit 1`);
  const made: string[] = [];
  try {
    const buyer = { fullName: "Check Buyer", mobile: "9876543210", addressLine: "1 Check Lane", city: "Pune", stateCode: "27", pin: "411045", country: "IN", gstin: "", businessName: "", pan: "" };
    const seller = { gstRegistered: false, companyName: "Check Co", companyAddress: "1 Seller Street\nGurugram", pan: "ABCDE1234F", gstin: null, sacCode: null, taxRate: 0, pricesIncludeTax: false, invoicePrefix: "JT/", businessState: "06" };
    const make = async (status: string) => {
      const [o] = await q<{ id: string }>(
        `insert into payment_orders (receipt_prefix, user_id, user_name, user_email, plan_name, period, kind, status, base_amount, tax_amount, total_amount, tax_rate, prices_include_tax, gateway, mode, paid_at, term_starts_at, term_ends_at, billing_snapshot, buyer_snapshot, gateway_payment_id)
         values ('JT/', $1, $2, $3, 'Check', 'monthly', 'new', $4::order_status, 49900, 0, 49900, 0, false, 'razorpay', 'test', case when $4::text = 'paid' then now() end, now(), now() + interval '30 days', $5, $6, 'pay_CHECK_' || substr(md5(random()::text), 1, 14))
         returning id`,
        [tu.id, tu.name, testEmail, status, JSON.stringify(seller), JSON.stringify(buyer)],
      );
      made.push(o.id);
      return o.id;
    };
    const a = await make("paid");
    const b = await make("paid");
    const unpaid = await make("created");

    const [x1, x2] = await Promise.all([ensureInvoice(a), ensureInvoice(a)]);
    check("I1", "two calls at once issue one invoice", !!x1 && !!x2 && x1.id === x2.id && (await q(`select 1 from invoices where order_id = $1`, [a])).length === 1);
    const y = await ensureInvoice(b);
    const seqs = await q<{ seq: number; series: string }>(`select seq, series from invoices where order_id = any($1::uuid[]) order by seq`, [[a, b]]);
    check("I1", "the next order gets the very next number", seqs.length === 2 && seqs[1].seq === seqs[0].seq + 1 && seqs[0].series === seqs[1].series && !!y);
    check("I1", "a test-mode order is numbered in the TEST/ series", !!x1?.number.startsWith(TEST_INVOICE_PREFIX));
    check("I1", "an unpaid order gets no invoice", (await ensureInvoice(unpaid)) === null);
    check("I1", "asking again returns the same invoice", (await ensureInvoice(a))?.id === x1?.id);

    const [doc] = await q<{ doc: { buyer: { name: string; pin: string }; seller: { name: string; state: { code: string } }; terms: string[]; totals: { total: number }; declarations: string[] } }>(`select doc from invoices where order_id = $1`, [a]);
    check("I2", "the invoice copies the buyer and seller as the order froze them", doc.doc.buyer.name === "Check Buyer" && doc.doc.buyer.pin === "411045" && doc.doc.seller.name === "Check Co" && doc.doc.seller.state?.code === "06");
    check("I2", "amounts come from the order", doc.doc.totals.total === 49900);
    check("I2", "a test payment says so on the invoice", doc.doc.declarations.some((d) => /test mode/i.test(d)));

    // Later changes never reach an issued invoice.
    await q(`update billing_config set invoice_terms = $1`, [JSON.stringify({ plan: ["Changed after the fact."], ai_interview: [] })]);
    await q(`update payment_orders set buyer_snapshot = jsonb_set(buyer_snapshot, '{fullName}', '"Someone Else"') where id = $1`, [a]);
    await ensureInvoice(a);
    const [after] = await q<{ doc: typeof doc.doc }>(`select doc from invoices where order_id = $1`, [a]);
    check("I3", "an invoice reads the same after Billing and the order change", JSON.stringify(after.doc) === JSON.stringify(doc.doc));
  } catch (e) {
    check("I0", "issuing ran", false, e instanceof Error ? e.message : String(e));
  } finally {
    const c = await db.connect();
    try {
      await c.query("begin");
      await c.query("set local session_replication_role = replica");
      await c.query(`delete from invoices where order_id = any($1::uuid[])`, [made]);
      await c.query(`delete from payment_orders where id = any($1::uuid[])`, [made]);
      await c.query(`delete from invoice_counters`);
      for (const r of countersBefore) await c.query(`insert into invoice_counters (series, last_seq, updated_at) values ($1, $2, $3)`, [r.series, r.last_seq, r.updated_at]);
      await c.query(`update billing_config set invoice_terms = $1`, [billingBefore?.invoice_terms == null ? null : JSON.stringify(billingBefore.invoice_terms)]);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      console.error("Cleanup failed (needs a local superuser database account):", e instanceof Error ? e.message : e);
    } finally {
      c.release();
    }
    const left = await q(`select 1 from payment_orders where id = any($1::uuid[])`, [made]);
    const countersAfter = await q(`select series, last_seq from invoice_counters order by series`);
    check(
      "I4",
      "test orders removed; counters and Billing terms put back",
      left.length === 0 && JSON.stringify(countersAfter) === JSON.stringify(countersBefore.map((r) => ({ series: r.series, last_seq: r.last_seq })).sort((x, y) => String(x.series).localeCompare(String(y.series)))),
    );
  }

  // Deleting an account keeps its invoices (tried in a rolled-back transaction).
  const c = await db.connect();
  try {
    await c.query("begin");
    const [owner] = (await c.query(`select user_id from invoices where user_id is not null limit 1`)).rows as { user_id: string }[];
    if (owner) {
      const before = (await c.query(`select count(*)::int as n from invoices where user_id = $1`, [owner.user_id])).rows[0].n as number;
      const ids = (await c.query(`select id from invoices where user_id = $1`, [owner.user_id])).rows.map((r) => r.id);
      await c.query(`delete from "user" where id = $1`, [owner.user_id]);
      const kept = (await c.query(`select count(*)::int as n from invoices where id = any($1::uuid[]) and user_id is null`, [ids])).rows[0].n as number;
      check("I5", "deleting an account keeps its invoices (link to the account cleared)", kept === before && before > 0, `${before} invoice(s)`);
      const profile = (await c.query(`select 1 from billing_profiles where user_id = $1`, [owner.user_id])).rows.length;
      check("I5", "and removes its billing details", profile === 0);
    } else console.log("SKIP  I5  no invoice with an account to try");
  } finally {
    await c.query("rollback");
    c.release();
  }
}

/* ---------------- H: signed out (APP_URL only) ---------------- */

if (!APP) {
  console.log("SKIP  H  signed-out HTTP checks (set APP_URL to run them)");
} else {
  const [inv] = await q<{ order_id: string }>(`select order_id from invoices limit 1`);
  const id = inv?.order_id ?? "00000000-0000-4000-8000-000000000000";
  const page = await fetch(`${APP}/api/invoices/${id}`, { headers: { accept: "text/html" }, redirect: "manual" });
  const to = page.headers.get("location") ?? "";
  check("H1", "a signed-out browser is sent to the sign-in page, not given the PDF", page.status === 303 && to.includes("/invoice-unavailable?reason=signin") && to.includes(encodeURIComponent(`/api/invoices/${id}`)));
  const script = await fetch(`${APP}/api/invoices/${id}`);
  check("H1", "a signed-out script gets 401", script.status === 401);
  const admin = await fetch(`${APP}/api/admin/invoices/${id}`, { redirect: "manual" });
  check("H2", "the admin invoice route refuses signed-out visitors", admin.status >= 300 && admin.status < 400 && (admin.headers.get("location") ?? "").includes("/jmp-admin/login"));
  const orders = await fetch(`${APP}/orders`, { redirect: "manual" });
  check("H2", "Orders & payments needs sign-in", orders.status >= 300 && orders.status < 400);
  const unavailable = await fetch(`${APP}/invoice-unavailable?reason=signin&next=${encodeURIComponent("//evil.com")}`);
  // Where the Sign in button points (the page data also echoes the visited URL, which is harmless).
  const signIn = [...(await unavailable.text()).matchAll(/href="(\/login[^"]*)"/g)].map((m) => m[1]);
  check("H3", "the sign-in link never carries an outside address", unavailable.ok && signIn.length > 0 && signIn.every((h) => !h.includes("evil")), signIn.join(", "));
}

await db.end();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
