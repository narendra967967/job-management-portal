# GST: spec

Status: **scope agreed with the owner, November 13, 2026.** Nothing is built yet. This covers **all of
Jobtiva** (plans, AI interviews, human interviews, cancellation charges and anything sold later), not only the
Interview Preparation module. It's built **before Release 2** of that module, together with the invoice feature
already planned (see the invoice requirements in memory and `docs/interview-prep/spec.md`).

This is a design for software, not tax advice. Every rate, SAC code and treatment marked "CA" must be confirmed
by the owner's CA before GST is switched on.

## 1. Decisions

| # | Decision |
|---|---|
| G1 | **One GST switch for the whole system.** On: every sale follows GST rules (tax split, tax invoice, credit notes, reports). Off: no GST anywhere, a plain invoice, nothing GST-shaped on screen. |
| G2 | The switch has an **effective date**. It applies only to sales from that date. Every sale stores the tax treatment it was made under (the existing snapshot rule), so switching never changes past sales or invoices. |
| G3 | **Prices always include GST.** The price a customer sees is the total they pay. With GST on, the tax is worked out from inside the price (₹500 at 18% = ₹423.73 + ₹76.27). The current Billing option "Prices include tax" is retired; included is the only behavior. |
| G4 | **The rate doesn't vary by state; the split does.** Customer in the same state as Jobtiva's GST registration: CGST + SGST (half each). Same Union Territory without its own legislature (Andaman and Nicobar, Chandigarh, Dadra and Nagar Haveli and Daman and Diu, Lakshadweep, Ladakh): CGST + UTGST. Different state or UT: IGST. |
| G5 | **Place of supply = the customer's billing address on record** (state from their address). |
| G6 | **A new admin GST panel** (Settings → GST) takes over every tax field now in Settings → Billing: registered yes/no, GSTIN, tax rate, SAC code, prices include tax. Billing keeps the business identity: name, address and PAN. |
| G7 | **Billing address before the first payment,** of any kind (plan, AI interview, booking), and at interviewer onboarding. Not at sign-up. Name, address line, city, **state**, **PIN code**, country India. Saved to the profile, reused, editable; each sale keeps a copy. |
| G8 | **India only for now.** Billing addresses must be in India. Exports, SEZ supplies and LUT are out of scope. |
| G9 | **Buyers may add a GSTIN or PAN** (optional) for business invoices. A GSTIN makes it a business (B2B) invoice. |
| G10 | **Interviewers must give a GSTIN or PAN** at onboarding (plus their address). A GSTIN supplies the PAN. How a GST-registered interviewer's payout is treated is for the CA (section 7). |
| G11 | **Each product has its own tax row:** SAC code and rate. Products: plans, AI interviews, human interviews, candidate cancellation charges, and interviewer fees (withdrawal fee). Rates and codes come from the CA. |

## 2. How a sale is taxed

For a GST-inclusive price `P` (in paise) and rate `r`:

1. Taxable value `B = round(P × 100 / (100 + r))`; tax `T = P − B`. Rounding to the paisa happens once, so `B + T` always equals `P`.
2. Same state: CGST `= floor(T / 2)`, SGST (or UTGST) `= T − CGST`. Different state: IGST `= T`.
3. With GST off: `B = P`, `T = 0`.

Each order stores: price, taxable value, tax, the split (CGST, SGST or UTGST, IGST), rate, SAC, place of supply
(state and code), Jobtiva's registration state, the customer's billing details, and whether GST was on. That's
an extension of today's `orders` columns (`base_amount`, `tax_amount`, `total_amount`, `tax_rate`,
`billing_snapshot`).

**Refunds** reverse tax in proportion. The 50% candidate cancellation: the kept 50% stays a taxed sale; the
refunded 50% gets a credit note reversing its share of tax.

## 3. The admin GST panel (Settings → GST)

Mobile-first like every admin screen; every list is a table (project rule).

| Tab | What it holds |
|---|---|
| **Registration** | GST on/off with effective date (confirm dialog both ways); GSTIN (format-checked, PAN taken from it); legal name as registered; registered state (picked from the states list); registration date |
| **States** | Every state and UT with its GST state code (01 to 38), whether it's a UT using UTGST, and whether it's a special-category state (lower registration threshold). Preloaded; admin can edit |
| **Products and rates** | One row per product (G11): SAC code (with the common codes preloaded as choices: 998313, 998314, 998315, 998316, 998319, 999293), rate, active from date. Changes apply to new sales only |
| **Invoices** | Invoice series per financial year (April to March) with its prefix, next number and a preview; credit note series; the wording shown when GST is off |
| **Reports** | Per month or quarter: sales by state (taxable value, CGST, SGST/UTGST, IGST, total), B2B invoices one by one, B2C totals by state and rate, totals by SAC, credit notes, and the invoice number ranges used. Downloadable as spreadsheets laid out like the GST return (GSTR-1) sections, for the accountant |
| **Thresholds** | This financial year's turnover against the registration threshold (₹20 lakh, or ₹10 lakh for a special-category registered state) and the ₹5 crore e-invoicing line, with warnings as each gets close |

The Payments page keeps its existing rule: online payment stays off until Billing **and** GST settings are
complete.

## 4. Invoices and credit notes

- **GST off:** an "Invoice" showing Jobtiva's name, address and PAN, the buyer's name and address, the amount,
  and a line saying Jobtiva isn't registered under GST and no tax was charged.
- **GST on:** a "Tax Invoice" showing Jobtiva's GSTIN, the buyer's details (and GSTIN for B2B), place of supply
  (state name and code), SAC, taxable value, the tax split and rate, and the total.
- **Numbering:** strictly consecutive within each financial year, separate from order numbers, assigned at
  payment. Credit notes have their own series.
- Actions as already planned for invoices: email with a PDF attached, and download. (The PDF library needs the
  owner's approval as a new dependency.)

## 5. Customer and interviewer details

**Billing details form** (shown before the first payment, editable in Settings): full name, address line, city,
state (dropdown from the states list), PIN code (6 digits), optional GSTIN or PAN. Validation: PIN is six digits
and doesn't start with 0; GSTIN is the 15-character format with its state code matching the chosen state; PAN is
the 10-character format.

**Interviewers** add the same address plus GSTIN or PAN (required, one of them) during onboarding.

These are personal data: shown only to the person and to admin, never to the other side of a booking, and
covered by the Privacy Policy.

## 6. Out of scope (accounting, not app logic)

Input tax credit, reverse charge on Jobtiva's own purchases (AWS, AI providers, other foreign tools), OIDAR,
exports and LUT, SEZ supplies, e-way bills, filing returns through an API, and IRN e-invoicing (only a warning
at the ₹5 crore line). TDS on interviewer payouts is income tax, not GST, and gets its own short spec with
Release 2.

## 7. Questions for the CA (before switching GST on)

1. SAC code and rate for each product (G11), especially mock interviews (999293 or a 9983 code?).
2. Is GST due on the candidate's 50% cancellation charge, and on the withdrawal fee and penalties charged to
   interviewers?
3. Under Model B, how is a GST-registered interviewer's fee handled: do they charge GST to Jobtiva, and does
   Jobtiva claim it back?
4. Confirm place of supply is the customer's billing address for these online services.
5. Invoice wording and declarations required while unregistered.

## 8. Build plan

| Phase | Work |
|---|---|
| 1. Screens | GST panel tabs on sample data; the billing details form at checkout and in user Settings; interviewer address and GSTIN/PAN in onboarding |
| 2. Database | GST settings, states, product tax rows, invoice and credit note series; order columns for the split and place of supply; profile billing details |
| 3. Wiring | Tax calculation (section 2) for every sale type; switch with effective date; invoices and credit notes; reports and downloads; threshold tracker; move the Billing tax fields across |
| 4. Safety | Check script: split always adds up to the tax, tax plus taxable value always equals the price, numbering has no gaps, past sales never change when settings change, reports total to the orders |
| 5. Content and rollout | Knowledge-base articles, Privacy Policy line for billing details, owner deploys |

Until this ships, Release 1 purchases (AI interviews) go through the existing order and tax logic, which already
stores each order's tax details, with GST off.
