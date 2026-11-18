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
//   node node_modules/.cache/invoice-samples.mjs <out-dir>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderInvoicePdf } from "../../lib/invoices/pdf.tsx";
import { sampleInvoiceGstInterB2b, sampleInvoiceGstIntra, sampleInvoiceGstOff } from "../../lib/invoices/sample.ts";

const out = process.argv[2];
if (!out) {
  console.error("usage: render-samples.mts <out-dir>");
  process.exit(2);
}
mkdirSync(out, { recursive: true });

// The logo as an invoice would keep it: small, so every PDF stays light.
const png = await sharp(readFileSync("public/logo.png")).resize(120, 120, { fit: "inside" }).png().toBuffer();
const logo = `data:image/png;base64,${png.toString("base64")}`;

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
