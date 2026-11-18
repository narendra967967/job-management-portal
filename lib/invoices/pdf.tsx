import "server-only";

// The invoice PDF (docs/invoices/spec.md), A4. Drawn in memory from a frozen
// InvoiceDoc and returned as a Buffer; nothing is written to disk (I8). One
// layout serves both cases: "Invoice" when GST is off, "Tax Invoice" with the
// SAC, place of supply and tax split when it's on.
//
// Helvetica is built into every PDF reader and matches the app's own font, but
// it has no rupee sign, so amounts read "INR 499.00" and the total is also
// written out in words, as Indian invoices usually do.

import { Document, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { amountInWords, formatPaise, invoiceDate, invoiceTitle, type InvoiceDoc } from "@/lib/invoices/model";

const INK = "#111827";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const BRAND = "#4F46E5";
const BRAND_SOFT = "#EEF2FF";
const PAID = "#047857";
const PAID_SOFT = "#ECFDF5";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 72, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: BRAND },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 30, height: 30, objectFit: "contain" },
  appName: { fontFamily: "Helvetica-Bold", fontSize: 15 },
  titleBox: { alignItems: "flex-end" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, color: BRAND, letterSpacing: 0.5 },
  paid: { marginTop: 9, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, backgroundColor: PAID_SOFT, color: PAID, fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1 },

  meta: { flexDirection: "row", marginTop: 20, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  metaCell: { flex: 1 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  strong: { fontFamily: "Helvetica-Bold" },

  parties: { flexDirection: "row", gap: 24, marginTop: 18 },
  party: { flex: 1 },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 2 },
  small: { fontSize: 8.5, color: MUTED },

  table: { marginTop: 22, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tr: { flexDirection: "row", borderTopWidth: 1, borderColor: LINE },
  th: { flexDirection: "row", backgroundColor: BRAND_SOFT },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: BRAND, textTransform: "uppercase", letterSpacing: 0.4 },
  cell: { paddingVertical: 7, paddingHorizontal: 8 },
  cNo: { width: 26 },
  cDesc: { flex: 1 },
  cSac: { width: 58 },
  cQty: { width: 36, textAlign: "right" },
  cAmt: { width: 96, textAlign: "right" },

  below: { flexDirection: "row", gap: 24, marginTop: 14 },
  words: { flex: 1 },
  totals: { width: 220 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totFinal: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 7, paddingBottom: 7, paddingHorizontal: 8, backgroundColor: BRAND_SOFT, borderRadius: 4 },
  totFinalText: { fontFamily: "Helvetica-Bold", fontSize: 11 },

  payBox: { marginTop: 18, padding: 10, borderWidth: 1, borderColor: LINE, borderRadius: 4, flexDirection: "row" },

  section: { marginTop: 18 },
  h: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 5 },
  term: { flexDirection: "row", marginBottom: 3 },
  termNo: { width: 14, color: MUTED },
  termText: { flex: 1, color: "#374151", fontSize: 8.5 },

  foot: { position: "absolute", bottom: 26, left: 44, right: 44, borderTopWidth: 1, borderColor: LINE, paddingTop: 8 },
  footRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 12, fontSize: 8 },
  link: { color: BRAND, textDecoration: "none" },
});

const inr = (paise: number) => `INR ${formatPaise(paise)}`;

type PdfStyle = NonNullable<React.ComponentProps<typeof View>["style"]>;

function Field({ label, value, style }: { label: string; value: string; style?: PdfStyle }) {
  return (
    <View style={style ? [s.metaCell, style as never] : s.metaCell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.strong}>{value}</Text>
    </View>
  );
}

/** Address and tax ID in body text; contact details smaller underneath. */
function Party({ heading, name, sub, lines, contact }: { heading: string; name: string; sub?: string | null; lines: string[]; contact: string[] }) {
  return (
    <View style={s.party}>
      <Text style={s.label}>{heading}</Text>
      <Text style={s.partyName}>{name}</Text>
      {sub ? <Text>{sub}</Text> : null}
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
      <View style={{ marginTop: 3 }}>
        {contact.filter(Boolean).map((l, i) => (
          <Text key={i} style={s.small}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function InvoicePdf({ doc }: { doc: InvoiceDoc }) {
  const tax = doc.gst.registered;
  const half = doc.gst.rate / 2;
  const seller = doc.seller;
  const buyer = doc.buyer;

  const sellerLines = [
    ...seller.addressLines,
    seller.state ? `${seller.state.name} (${seller.state.code})` : "",
    tax && seller.gstin ? `GSTIN ${seller.gstin}` : seller.pan ? `PAN ${seller.pan}` : "",
  ];
  const buyerLines = [
    ...buyer.addressLines,
    `${buyer.state.name}${tax ? ` (${buyer.state.code})` : ""} ${buyer.pin}`,
    buyer.gstin ? `GSTIN ${buyer.gstin}` : buyer.pan ? `PAN ${buyer.pan}` : "",
  ];

  return (
    <Document title={`${invoiceTitle(doc)} ${doc.number}`} author={doc.appName} subject={`${invoiceTitle(doc)} ${doc.number}`} creator={doc.appName} producer={doc.appName}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />

        <View style={s.head}>
          <View style={s.brand}>
            {/* react-pdf's Image has no alt text; the app name sits right beside it. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {doc.logo ? <Image src={doc.logo} style={s.logo} /> : null}
            <Text style={s.appName}>{doc.appName}</Text>
          </View>
          <View style={s.titleBox}>
            <Text style={s.title}>{invoiceTitle(doc).toUpperCase()}</Text>
            <Text style={s.paid}>PAID</Text>
          </View>
        </View>

        <View style={s.meta}>
          <Field label="Invoice number" value={doc.number} />
          <Field label="Invoice date" value={invoiceDate(doc.issuedAt)} />
          <Field label="Order number" value={doc.payment.orderNumber} />
          {tax && doc.gst.placeOfSupply ? (
            <Field label="Place of supply" value={`${doc.gst.placeOfSupply.name} (${doc.gst.placeOfSupply.code})`} />
          ) : null}
        </View>

        <View style={s.parties}>
          <Party heading="From" name={seller.name} lines={sellerLines} contact={[seller.email]} />
          <Party
            heading="Billed to"
            name={buyer.businessName ?? buyer.name}
            sub={buyer.businessName ? `Attn: ${buyer.name}` : null}
            lines={buyerLines}
            contact={[buyer.email, `+91 ${buyer.mobile}`]}
          />
        </View>

        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.cell, s.cNo, s.thText]}>#</Text>
            <Text style={[s.cell, s.cDesc, s.thText]}>Description</Text>
            {tax ? <Text style={[s.cell, s.cSac, s.thText]}>SAC</Text> : null}
            <Text style={[s.cell, s.cQty, s.thText]}>Qty</Text>
            <Text style={[s.cell, s.cAmt, s.thText]}>{tax ? "Taxable value" : "Amount"}</Text>
          </View>
          {doc.lines.map((l, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.cell, s.cNo]}>{i + 1}</Text>
              <View style={[s.cell, s.cDesc]}>
                <Text style={s.strong}>{l.description}</Text>
                {l.detail ? <Text style={s.small}>{l.detail}</Text> : null}
              </View>
              {tax ? <Text style={[s.cell, s.cSac]}>{l.sac ?? ""}</Text> : null}
              <Text style={[s.cell, s.cQty]}>{l.quantity}</Text>
              <Text style={[s.cell, s.cAmt]}>{formatPaise(l.taxable)}</Text>
            </View>
          ))}
        </View>

        <View style={s.below} wrap={false}>
          <View style={s.words}>
            <Text style={s.label}>Amount in words</Text>
            <Text>{amountInWords(doc.totals.total)}</Text>
          </View>
          <View style={s.totals}>
            {tax ? (
              <>
                <View style={s.totRow}>
                  <Text style={s.small}>Taxable value</Text>
                  <Text>{inr(doc.totals.taxable)}</Text>
                </View>
                {doc.gst.split === "intra" ? (
                  <>
                    <View style={s.totRow}>
                      <Text style={s.small}>CGST at {half}%</Text>
                      <Text>{inr(doc.totals.cgst)}</Text>
                    </View>
                    <View style={s.totRow}>
                      <Text style={s.small}>SGST at {half}%</Text>
                      <Text>{inr(doc.totals.sgst)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={s.totRow}>
                    <Text style={s.small}>IGST at {doc.gst.rate}%</Text>
                    <Text>{inr(doc.totals.igst)}</Text>
                  </View>
                )}
              </>
            ) : null}
            <View style={s.totFinal}>
              <Text style={s.totFinalText}>Total paid</Text>
              <Text style={s.totFinalText}>{inr(doc.totals.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.payBox} wrap={false}>
          <Field label="Paid on" value={invoiceDate(doc.payment.paidAt)} />
          <Field label="Method" value={doc.payment.method ?? "Online"} />
          <Field label="Payment ID" value={doc.payment.paymentId} style={{ flex: 1.6 }} />
          <Field label="Processed by" value={doc.payment.gateway} />
        </View>

        {doc.declarations.length > 0 ? (
          <View style={s.section} wrap={false}>
            {doc.declarations.map((d, i) => (
              <Text key={i} style={s.small}>
                {d}
              </Text>
            ))}
          </View>
        ) : null}

        {doc.terms.length > 0 ? (
          <View style={s.section} wrap={false}>
            <Text style={s.h}>Terms and conditions</Text>
            {doc.terms.slice(0, 5).map((t, i) => (
              <View key={i} style={s.term}>
                <Text style={s.termNo}>{i + 1}.</Text>
                <Text style={s.termText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.foot} fixed>
          <View style={s.footRow}>
            <View style={s.links}>
              <Link src={doc.links.terms} style={s.link}>
                Terms &amp; conditions
              </Link>
              <Link src={doc.links.privacy} style={s.link}>
                Privacy policy
              </Link>
              <Link src={doc.links.refunds} style={s.link}>
                Refund &amp; cancellation policy
              </Link>
            </View>
            <Text style={s.small} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
          <Text style={[s.small, { marginTop: 4 }]}>
            {doc.appName} · {seller.website.replace(/^https?:\/\//, "")} · {seller.email} · This is a computer-generated invoice.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** The PDF as bytes, drawn in memory. Never written to disk. */
export function renderInvoicePdf(doc: InvoiceDoc): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf doc={doc} />);
}
