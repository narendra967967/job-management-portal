---
title: How invoices work (numbers, billing details, downloading and sending)
category: Plans and billing
summary: Every paid plan or AI mock interview gets one invoice, issued when the payment is confirmed and never changed. Users and admins download them from Orders & payments. Billing details are required before any payment.
keywords: invoice, tax invoice, bill, invoice number, receipt, download invoice, send invoice, email invoice, billing details, address, GSTIN, PAN, invoice terms, financial year, TEST invoice, missing invoice, wrong address on invoice
---

Each paid order gets exactly one invoice, for plans and AI mock interviews alike. It's issued as soon as the payment is confirmed, and its number replaced the old receipt number everywhere: in the payment email, in Orders & payments, and on the PDF. Failed, pending and canceled attempts have no invoice.

## An invoice never changes

Everything printed on it is copied when the invoice is issued: your business details and terms from Settings → Billing, the customer's billing details, the item, the amounts and tax, and your logo. Changing any of those later only affects invoices issued afterwards. The database itself refuses to edit or delete an invoice, and it refuses to delete an order. When a customer deletes their account, their orders and invoices stay (tax law needs them), just no longer linked to an account.

So if a customer says their invoice has an old address, the invoice is right: it shows the address they had when they paid. They can update their billing details for next time.

## Numbers

A number is the prefix, the financial year and a five-digit count, for example `JT/26-27/00001`. It restarts at 1 every April 1 and never skips a number, even if two people pay at the same moment. Set the prefix in **Settings → Billing → Invoice number prefix**: up to 5 characters, letters, digits, `-` and `/`, so the whole number stays within the legal 16 characters. `JT/` reads best. The field shows what the next number will look like.

Payments made with Razorpay **test** keys get their own series, `TEST/26-27/00001` and up, and the invoice says no money was taken. They never use up numbers from the real series.

## Billing details come first

Nobody can pay without complete billing details: name, Indian mobile number, address, city, state and PIN code, plus an optional GSTIN with business name, and an optional PAN. If they're missing, **Pay** opens a short form first and carries on to the payment after it's saved. The server checks again, so skipping the form doesn't get round it. Customers can change the details any time in **Settings → Profile → Billing details**.

Your side has the same kind of rule. Settings → Billing counts as complete only once the business **State** is chosen, because it's printed on every invoice and decides the tax: with GST on, a buyer in your state is charged CGST plus SGST (UTGST in Chandigarh, Ladakh and the other union territories without a legislature), and anyone else IGST. If online payment suddenly shows "Request this plan" after an update, check that State is set.

## Where invoices live

Customers get the PDF attached to their payment email. Any time after that they can open **Orders & payments** in the sidebar, which lists every payment they've tried, and use **Download invoice**, **View invoice** or **Email me the invoice** on any paid one. Picking several and using **Email me the invoices** sends them together, up to 20 in one email and up to 10 of these emails an hour. A paid AI mock interview also has **Download invoice** in its menu on the AI interviews page.

In admin **Orders & payments**, paid orders show their invoice number. The row menu and the order window have **Download invoice** and **Send invoice**, which emails it to the customer using the **Invoice copy** template in Email templates. **Resend payment email** sends the original payment email again, with the invoice attached.

PDFs are drawn fresh each time someone downloads or sends one, from the stored invoice, and never saved as files.

## Terms printed on the invoice

Up to 5 short points go under each invoice, set in **Settings → Billing → Invoice terms**, with one set for plans and one for AI mock interviews (up to 300 characters each). Plans start with five points taken from the Terms and the Refund & cancellation policy. AI mock interviews start with five points: what was bought, the date it must be started by, no refund once paid (even unused) except for payment errors, a fresh interview at no charge if one stops because of a problem on our side, and how to get help. They match the AI mock interviews section of the Refund & cancellation policy, so if you change one, change the other. Each invoice keeps the terms it was issued with, so interview invoices issued before November 22, 2026 have none.

## No signature

Invoices carry no signature, and adding a scanned one isn't recommended: it isn't a valid digital signature, and every customer would get a copy of it. While you're not GST registered, no rule asks for one. Once registered, GST rules let an electronic invoice go without a signature; whether to add a digital signature certificate is a question for your CA.

## If a paid order shows no invoice

Invoices are issued straight after payment, and every server start issues any that are still missing, oldest payment first. Downloading the invoice also issues it if needed. So a missing one usually fixes itself; if it doesn't, the server log will say why.

A link to someone else's invoice, or to an unpaid order, opens a "We can't find this invoice" page. A signed-out customer who opens their own invoice link is asked to sign in, then taken straight to it.
