---
title: How online plan payments work
category: Plans and billing
summary: Users pay through Razorpay only when a gateway is on in Settings → Payments and Billing is complete; otherwise plans show "Request this plan". Each payment is confirmed on the server before the plan changes and listed in Orders & payments.
keywords: checkout, razorpay, pay, buy plan, payment failed, payment not showing, request this plan, fallback, receipt, orders, webhook, upgrade credit, renew
---

Two things have to be true before users see a **Pay** button: a gateway is turned on in admin **Settings → Payments**, and admin **Settings → Billing** shows **Ready**. If either is missing, checkout quietly falls back to **Request this plan**, which opens a support ticket so you can sort the payment out by hand. Settings → Payments warns you when Billing is the thing holding it up.

Razorpay is the only gateway for now.

## Setting up Razorpay

In Settings → Payments, enter the key ID, the key secret and the webhook secret, then **Save changes**. The key ID has to match the mode: rzp_test_ keys in Test, rzp_live_ keys in Live. Changing the key ID or the mode asks for its key secret again, because a secret only works with its own key.

Copy the **Webhook URL** shown on the card into Razorpay's dashboard under Webhooks, with the events payment.captured, payment.failed and order.paid, and use the same webhook secret you saved here. Skipping the webhook is the mistake to avoid: if a user closes the tab right after paying, the webhook is what still gives them their plan.

**Test connection** checks the keys with Razorpay. **Turn on** needs all three values saved. Secrets are stored encrypted and never shown again, only "Saved".

In Test mode nothing is charged, and only Razorpay's test cards and test UPI work. Switch to Live only with live keys.

## What the user sees

In Settings → Plan a user gets **Renew** for their own plan plus only the plans above it. Upgrade Plan shows every paid plan. Picking one opens a summary with the dates and the total, then **Pay** opens Razorpay's window.

What they pay for:

| Situation | What happens |
|---|---|
| Same plan, still running | Renewal. The new term starts when the current one ends, so no days are lost |
| Another plan while a paid one is running | Upgrade. Starts today, and the unused value of the old plan becomes extra days on the new one |
| Expired, or coming from the free trial | Starts today. Free-trial days carry no credit |

GST follows Billing as it was when the order was created. Each order keeps a copy of those Billing details, so changing Billing later never alters a past payment.

## How a payment is confirmed

The amount is worked out on the server, never taken from the browser. When Razorpay reports success, the server checks the signature, fetches the payment from Razorpay, and only applies the plan if the amount and currency match the order. The checkout window and the webhook both do this, and whichever arrives second changes nothing.

The paid user gets a "Payment received" email with the receipt. A user can start at most 10 payments an hour.

## Orders & payments

Admin **Orders & payments** lists every attempt: Paid, Pending (window opened, not paid), Failed (with the reason), and Cancelled (window closed). The details window has **Resend receipt** for paid orders, **Open in Razorpay** and **View user**. An order keeps the user's name and email even if the account is deleted later.

If a user says they paid but their plan didn't change, find the order here first. A Paid order means the plan was applied. A Pending one with a payment in Razorpay usually means the webhook isn't set up or its secret doesn't match.
