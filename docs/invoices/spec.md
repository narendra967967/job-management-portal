# Invoices, billing details and payment history: spec

Status: **owner's answers in (November 18, 2026); PDF design under review.** The layout exists with sample
data (section 10a); nothing else is built. Decisions marked "owner" were given on November 18.

This covers every sale on Jobtiva (plans, AI mock interviews, and anything sold later). It works with GST off
(today) and on. The bigger GST work (the GST panel, reports, thresholds, credit notes) stays in
`docs/gst/spec.md`; section 9 says where the line is.

This is a design for software, not tax advice. Wording and treatments marked "CA" are confirmed by the owner's
CA before GST is switched on.

## 1. Decisions

| # | Decision | Source |
|---|---|---|
| I1 | **One invoice per successful payment**, for every kind of sale. A failed, pending or cancelled order gets no invoice. No separate "order slip": the invoice is the document. | owner |
| I2 | **Works with GST on or off.** Off: an "Invoice" with no tax and a not-registered line. On: a "Tax Invoice" with the tax split. Which one is decided at the moment of payment. | owner |
| I3 | **An invoice never changes.** Everything printed on it (Jobtiva's details, the buyer's details, the item, amounts, tax, GST status, numbers, dates) is copied into the invoice record at payment. Later changes to GST settings, Billing, the buyer's profile or their address never alter it. | owner |
| I4 | **Billing details are required before any payment**, GST on or off. If anything required is missing, checkout stops and asks for it first. Nothing is charged until the details are complete. | owner |
| I5 | **The invoice number replaces the receipt number everywhere** (emails, admin, user screens), for every kind of sale. | owner |
| I6 | **Money records are never deleted**: orders, invoices and (later) credit notes survive account reset and account deletion. They keep the copied buyer details; the link to the account is cleared on deletion. No data retention setting may ever include them. | owner |
| I7 | **Payment history is its own tab in user Settings** ("Payments"), not under Plan. A table with an Action column. | owner |
| I8 | **PDFs are made on request and never stored** (see section 6). | proposed, replaces the owner's two options |
| I9 | **PDF library: `@react-pdf/renderer` 4.9.0** (MIT), installed November 18. | owner approved "any suitable library" |

## 2. Billing details (required before paying)

Asked once, in a short form that opens when the user clicks **Pay** with details missing, and editable any
time in Settings → Profile, in their own Billing details box. Each invoice keeps its own copy (I3), so editing changes only future invoices.

| Field | Required | Notes |
|---|---|---|
| Full name (as it should appear on invoices) | Yes | Prefilled from the account name |
| Email | Yes | The account email, already verified at sign-up. Shown, not editable here |
| Mobile number | Yes | Indian 10-digit mobile. Prefilled from the account if already there |
| Address line | Yes | |
| City | Yes | |
| State | Yes | Dropdown of states and UTs. Decides the place of supply when GST is on (CBIC Circular 242/36/2024-GST: the buyer's state must be on the invoice for every online service) |
| PIN code | Yes | 6 digits, not starting with 0 |
| Country | Yes | India only for now (GST spec G8) |
| Buying as a business? (GSTIN) | Optional | If given: 15-character format, state code must match the chosen state. Makes it a business (B2B) invoice and adds the registered business name |
| PAN | Optional | Owner, November 18: not needed for a consumer invoice, and sensitive personal data |

Server checks the same rules with Zod; checkout refuses to start an order while the profile is incomplete, so
the rule holds even if the form is skipped.

## 3. What's frozen on each invoice

One `invoices` row per paid order, written in the same transaction that marks the order paid (both the
checkout handler and the webhook go through it; a unique key on the order makes the second a no-op).

- **Number and dates**: invoice number, invoice date, financial year, payment date and ID, gateway.
- **Seller**: business name, address, state and state code, PAN, GSTIN (when registered), support email, the
  app name, and a copy of the logo as it was (a few KB, so a later logo change doesn't alter old invoices).
- **Buyer**: everything from section 2 as entered at payment.
- **Item lines**: description (for example "Pro plan, monthly, December 1, 2026 to December 31, 2026" or "AI
  mock interview: 30 min, Medium"), SAC code, quantity, amounts.
- **Money** (paise): taxable value, CGST, SGST/UTGST, IGST, rate, total, amount in words.
- **Tax status**: GST on or off, place of supply (state and code), B2B or B2C, and the exact declaration lines
  printed.
- **Template version**: which layout drew it. The content never changes. Layout fixes can be applied to old
  invoices only by keeping the old version available, so we keep each version's renderer.

## 4. Numbering

- One series for the whole platform, separate from order numbers (orders have gaps; invoices must not).
- Format: `prefix` + financial year + `/` + sequence, for example `JT/26-27/00001`. At most 16 characters,
  only letters, digits, `-` and `/` (CGST Rule 46(b)). The prefix is set in admin and checked so the full
  number always fits.
- Restarts at 1 every April 1. Assigned at payment inside the transaction, so two payments at the same moment
  can never share or skip a number.
- **Test-mode payments** (gateway test keys, no real money) get invoices from a separate `TEST/` series and are
  marked as test, so they never use up or leave gaps in the real series (decided November 18, 2026).
- The prefix is at most 5 characters (checked on screen and on the server). `JT/` reads best: `JT/26-27/00001`.

## 5. The two layouts

| | GST off: "Invoice" | GST on: "Tax Invoice" |
|---|---|---|
| Seller | Name, address, PAN | Name, address, GSTIN, state and code |
| Buyer | Name, address, state, contact | Same, plus GSTIN and business name for B2B |
| Lines | Description, amount | Description, SAC, taxable value, rate, tax |
| Tax | None | CGST + SGST (or UTGST) when the buyer's state matches Jobtiva's, IGST otherwise |
| Place of supply | Not shown | Buyer's state name and code |
| Declaration | "Not registered under GST. No GST charged." (wording: CA) | As required (CA) |
| Footer | Paid on, payment ID | Same |
| Signature | CA: how a computer-generated PDF meets the signature requirement (Rule 46 lists the supplier's signature or digital signature for a tax invoice) | Same question |

## 6. PDFs: made on request, never stored (proposed)

The owner suggested either deleting each PDF right after use, or keeping it one or two days with an admin
setting. Proposed instead: **never write the file at all.** The PDF is drawn in memory from the frozen
invoice record, sent straight to the browser (download) or attached to the email, and discarded. Drawing one
takes a fraction of a second.

This saves the same space as both options, with nothing to clean up: no files on disk, no cleanup job, no
setting, and no stale copy if something fails halfway. The cost is a little server work per download, which
at our volume is nothing. If volume ever grows a lot, a short cache can be added then.

## 7. What the user gets

- **Email on payment**: the existing "Payment received" and AI interview receipt emails, now with the invoice
  number and the PDF attached. Their wording stays editable in Email templates.
- **Settings → Profile**: billing details in their own box below the general profile, with **Edit** (owner,
  November 18: all personal details together, billing kept in a separate box).
- **Orders & payments** (`/orders`), its own page in the sidebar's account group just above the profile, with
  Settings below it, also in the phone menu (owner, November 18). Open in limited mode, so invoices
  stay reachable and renewals possible after a plan ends.
  - A payments table: Date, Invoice number, Item, Amount, Status (Paid, Failed, Pending, Cancelled), and an
    Action column: **Download invoice**, **Email me the invoice** (paid only), **View details**.
  - Filters by status and date, pagination, and the multi-select the table rule asks for (bulk download as
    one ZIP is proposed for later, not now). Date range defaults to the **last 6 months** (owner, November
    18; an exception to the 7-day table rule).
- Failed or cancelled attempts show in the table without an invoice, so users can see what happened.

## 8. What admin gets

- **Orders & payments**: invoice number on each paid order, and **Download invoice** and **Send invoice** in the
  row menu and the details window (approved November 8).
- **Settings → Billing**: Jobtiva's state (new, a dropdown: it decides CGST/SGST vs IGST), the invoice prefix
  with a live preview of the next number, and a check that the seller details an invoice needs are complete.
  Online payment stays off until they are (existing rule).
- Users: an admin can view a user's billing details (personal data, admin only).

## 9. Where this ends and the GST spec begins

**In this build:** billing details, the invoice record and numbering, both layouts, the tax split by state
(needed for a correct Tax Invoice), PDFs, emails, the user Payments tab, admin actions, Jobtiva's state in
Billing.

**Stays in `docs/gst/spec.md`:** the GST panel (effective date, per-product SAC and rate, states table),
credit notes for refunds, GST reports, the turnover and e-invoicing threshold tracker. Until the GST panel
exists, GST on/off, rate and SAC come from today's Billing fields.

## 10. Answered questions (owner, November 18, 2026)

1. **PAN:** optional for buyers.
2. **Payments table:** defaults to the last 6 months.
3. **Existing paid orders** get invoices, numbered from 1 in date order, using the details copied on the order.
   Only local and preprod have paid orders today (prod has no real customers yet), so this changes nothing a
   customer has seen.

## 10a. The PDF design (owner reviewing, November 18, 2026)

Built as the real layout (`lib/invoices/pdf.tsx`) with sample data (`lib/invoices/sample.ts`); samples are
drawn with `scripts/invoices/render-samples.mts`.

- **A4**, one page for a normal order. A thin brand-colored band at the top; logo and app name left; "INVOICE"
  or "TAX INVOICE" right with a green **PAID** mark.
- A row of key facts: invoice number, invoice date, order number, and place of supply (tax invoice only).
- **From** and **Billed to** side by side: address and tax ID in body text, email and mobile smaller underneath.
  A business buyer shows the business name with "Attn:" and the person.
- The item table (SAC and taxable value columns only on a tax invoice), amount in words, and the totals: the
  CGST and SGST lines for a same-state buyer, IGST for another state.
- A payment box: paid on, method, payment ID, processed by.
- The declaration line, then **Terms and conditions** (up to 5 points).
- Footer on every page: links to Terms & conditions, Privacy policy and Refund & cancellation policy (full
  `https://jobtiva.in/...` addresses, clickable), the app name, site, support email, "This is a
  computer-generated invoice.", and page numbers.
- **Amounts read "INR 499.00"**: the built-in PDF font (Helvetica, which matches the app's own font) has no
  rupee sign. Showing "₹" means bundling a font file; possible later if wanted.
- **Terms are per kind of sale and frozen.** Plans use the 5 points in `DEFAULT_INVOICE_TERMS`, taken from the
  current Terms and Refund & cancellation policy. AI mock interviews need their own set once their refund rules
  are published (interview-prep spec D57); until then an interview invoice must not print the plan terms.
  Admin edits the terms in Settings → Billing (phase 3), and each invoice keeps the copy it was issued with.
- **Signature:** no handwritten or scanned signature is printed. While Jobtiva isn't GST-registered, no GST
  invoice rule applies. After registration, CGST Rule 46 says a signature isn't required on an electronic
  invoice issued under the IT Act (proviso added by Notification 74/2018). Whether a plain PDF qualifies, or
  a digital signature certificate is better, is on the CA list. A scanned signature image isn't a valid digital
  signature and would let anyone copy it from any invoice.

## 11. Build plan (UI first)

| Phase | Work |
|---|---|
| 1. Screens | Billing details form (checkout and Settings → Profile), the Orders & payments page with its table, the two invoice layouts as PDFs on sample data, admin Billing additions, at 375px and 768px |
| 2. Database | Billing details on the profile, `invoices` table with the frozen copy, the numbering series, Jobtiva's state in Billing |
| 3. Wiring | The checkout gate (I4), invoice creation at payment for plans and AI interviews, tax split, PDF on request, email attachments, invoice number replacing the receipt number, admin actions, existing orders (question 3) |
| 4. Safety | Check script: no paid order without exactly one invoice, numbers unbroken per financial year and at most 16 characters, an invoice reads the same after every setting and profile change, PDFs never touch disk, money tables untouched by reset, deletion and retention, signed-out and other-user access refused |
| 5. Content and rollout | Knowledge-base articles, Privacy Policy lines (billing details collected; money records kept by law after deletion), preprod, then prod with the payment module |

Progress: phase 1 done (screens, November 18, 2026). Phase 2 done (database, November 18). Phase 3 done (wiring, November 22): billing details saved and required, buyer + split frozen on orders, invoices issued at payment and backfilled at startup, real downloads, Invoice copy email, PDFs attached to payment emails, invoice number replaces the receipt number, the Plan and AI-booking links. Phase 4 done (scripts/security/invoices-checks.mts, 58 checks). Phase 5 content done (Privacy, Terms, Refunds, Pricing, knowledge base, November 22); what remains is the owner's deploy to preprod, then prod with the payment module.

## 12. The database (phase 2)

Migrations 0067 (tables) and 0068 (guards).

| Table or column | Holds |
|---|---|
| `billing_profiles` | One row per user: the section 2 details. Deleted with the account (personal data) |
| `payment_orders.buyer_snapshot` | The buyer's details when checkout starts. Tax is worked out when the order is created, so the buyer's state is fixed then too |
| `payment_orders.cgst_amount`, `sgst_amount`, `igst_amount`, `place_of_supply` | The split, fixed with the amount. UTGST is kept in `sgst_amount`. A check makes the three add up to the tax, or all be 0 |
| `invoices` | One per paid order: number, series, sequence, financial year, live or test, issue time, layout version, total, and `doc`, the frozen InvoiceDoc the PDF is drawn from. Unique per order, per number, and per series position; number at most 16 characters |
| `invoice_counters` | The last number used per series (`live|JT/|26-27`, `test|TEST/|26-27`). Taken with an upsert in the same transaction as the invoice, so a rolled-back payment leaves no gap |
| `billing_config.business_state`, `invoice_terms` | The business's GST state code; the terms per kind of sale (null means the defaults) |

**Guards in the database (0068):** an invoice can't be changed or deleted; the only change allowed is
`user_id` becoming empty when the account is deleted. A payment order can't be deleted. Deleting an account
keeps its orders and invoices (their link to the account is cleared) and removes the billing profile.
Local check scripts clean up their own test rows through a superuser session
(`session_replication_role = replica`); the server's app database users aren't superusers, so the live app
never can.
