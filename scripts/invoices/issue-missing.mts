// Issues invoices for paid orders that don't have one yet, oldest payment
// first (docs/invoices/spec.md). The app does this by itself at every start
// (instrumentation.ts); run this to do it without restarting:
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/invoices/issue-missing.mts
//
// Safe to run any number of times: an order that has an invoice is skipped.

const { issueMissingInvoices } = await import("../../lib/invoices/issue.ts");
const n = await issueMissingInvoices();
console.log(n ? `Issued ${n} invoice${n === 1 ? "" : "s"}.` : "Every paid order already has its invoice.");
process.exit(0);
