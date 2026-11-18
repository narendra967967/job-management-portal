// Draws the three sample invoices (lib/invoices/sample.ts) as PDFs for review.
// Writes only to the folder given; the app itself never writes invoice PDFs to disk.
//
// tsx can't run this: it rewrites the PDF library's ES modules as CommonJS, and
// the library's import-only sub-packages then fail to resolve. So bundle it
// with esbuild (already installed with tsx) and run the bundle. The app is
// bundled by Next.js and isn't affected. From the repo root (bash):
//
//   echo 'export {};' > node_modules/.cache/empty.mjs
//   npx esbuild scripts/invoices/render-samples.mts --bundle --platform=node --format=esm \
//     --jsx=automatic --packages=external --alias:server-only=./node_modules/.cache/empty.mjs \
//     --outfile=node_modules/.cache/invoice-samples.mjs
//   node --env-file=.env.local node_modules/.cache/invoice-samples.mjs <out-dir>

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logoForInvoice } from "../../lib/invoices/logo.ts";
import { renderInvoicePdf } from "../../lib/invoices/pdf.tsx";
import { sampleInvoiceGstInterB2b, sampleInvoiceGstIntra, sampleInvoiceGstOff } from "../../lib/invoices/sample.ts";

const out = process.argv[2];
if (!out) {
  console.error("usage: render-samples.mts <out-dir>");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

// The logo uploaded in admin Branding, as an invoice keeps it.
const logo = await logoForInvoice();
console.log(logo ? "Using the logo uploaded in admin Branding." : "No logo uploaded in admin Branding: the name only.");

for (const [name, doc] of [
  ["invoice-gst-off.pdf", sampleInvoiceGstOff(logo)],
  ["tax-invoice-same-state.pdf", sampleInvoiceGstIntra(logo)],
  ["tax-invoice-other-state-business.pdf", sampleInvoiceGstInterB2b(logo)],
] as const) {
  const t = Date.now();
  const pdf = await renderInvoicePdf(doc);
  writeFileSync(join(out, name), pdf);
  console.log(`${name}: ${(pdf.length / 1024).toFixed(1)} KB in ${Date.now() - t} ms`);
}

process.exit(0); // the database pool would keep the process open
