---
title: How a deploy works, and rolling one back
category: Runbooks
summary: Pushing to preprod deploys preprod. Pushing to prod deploys prod after an approval click. Each deploy builds the image in GitHub, runs its migrations, switches the container and rolls back by itself if the health check fails.
keywords: deploy, release, preprod, prod, migrations, rollback, roll back, github actions, ci, promote
---

Both environments run on one server, as separate containers with separate databases. Work happens on `narendra`; the owner merges and pushes.

| Push to | Workflow | Deploys |
|---|---|---|
| `preprod` | Deploy preprod | Preprod, right away |
| `prod` | Deploy prod | Prod, after the owner approves it in GitHub |

## What a deploy does

1. GitHub builds the image on an ARM runner, matching the server, unless that exact commit's image is already there.
2. The image is shipped to the server and `deploy.sh` runs.
3. **Database migrations run from the new image**, against that environment's database. A deploy with new migrations needs nothing extra.
4. The container switches to the new image.
5. It checks `/login` responds. If not, it switches back to the previous image and the deploy fails.
6. The newest 3 images are kept for rollback.

On start, the app also syncs the admin knowledge base from `docs/knowledge-base`. The container log shows a line like `knowledge base sync: 0 added, 2 updated, 0 removed, 29 unchanged`, plus a warning for any file it skipped.

## Before deploying knowledge base changes

Run the knowledge base checks locally, after a sync, from the repo root:

```bash
node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/kb-checks.mts
```

It confirms every knowledge base page and action needs an admin, that every article parses and holds nothing shaped like a secret, that odd search input is safe, and that a set of known questions still finds the right article. Add `APP_URL=http://127.0.0.1:3100` with a production build running there to also check the pages turn signed-out visitors away. It never calls the AI. When an article changes enough that a known question finds something else, update the list in the script.

## Before deploying changes to emails

Anything that touches an automatic email, its sender or Email templates gets its own check:

```bash
node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/email-templates-checks.mts
```

It fails if an email can't be filled in, if saving would let a broken placeholder through, if unsafe HTML survives cleaning, or if any code sends email without going through a template (broadcasts and the two test emails in Settings → Email delivery are the only ones allowed to). It also saves wording for one email for a moment to prove the fallback works, then puts back exactly what was there. Nothing is ever sent.

Changes to how email is sent (the mailer, SMTP or Amazon SES) have a second check:

```bash
node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/email-delivery-checks.mts
```

It never contacts AWS. It runs its own stand-in for the SES API and confirms that the chosen service is the one used, that requests are signed and never carry the secret key, that the admin screen never receives it, that unsubscribe headers survive, that AWS errors come out in plain words, and that an incomplete SES setup fails rather than quietly using SMTP. Its test SES details are made up and assembled when it runs, so secret scanners don't mistake them for real keys. They're saved for a moment and then removed, leaving the table exactly as it was.

## Before deploying Mock interviews changes

Anything that touches AI interviews (booking, the interviewer, reports, the allowance, AI interview payments or Module settings) gets its check. Run it with the app running locally; the dev server on port 3000 is fine:

```bash
APP_URL=http://localhost:3000 node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/mock-interviews-checks.mts
```

It confirms signed-out visitors and candidate accounts are turned away from every AI interview page and action, that nobody can open, answer or edit someone else's interview, and that the allowance can't be spent twice, even by bookings made at the same moment. Paid bookings must charge the level's rate for the length, with the discount only when it's switched on, and one payment confirmed three times must still give one booking, one order and one receipt. Unusable AI replies must never become a report, the module key must stay out of every page and browser script, and Coming soon must refuse the actions as well as hide the pages.

It never calls OpenAI, Razorpay or a mail server: inside the script those are stand-ins, and its HTTP requests are all ones that must be refused before any of that happens. It flips Module settings, the Razorpay row, the Free plan's allowance and ui-test's plan while it runs, then puts every one back exactly and deletes the bookings and orders it made. The price checks need Billing complete locally and fewer than 7 payment orders on ui-test in the last hour.

## Before deploying payment or invoice changes

Anything that touches checkout, billing details, orders or invoices gets the invoice check. Run it with the app running locally:

```bash
APP_URL=http://localhost:3000 node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx scripts/security/invoices-checks.mts
```

It confirms every paid order has exactly one invoice, the numbers in each series run without gaps, and test payments stay out of the real series. It also checks that the database refuses to change or delete an invoice or delete an order, that nobody can pay without billing details, and that one person can't open another's invoice. It issues invoices for two throwaway test orders to prove two requests at once still give one invoice, then removes them and puts the counters back. Nothing is emailed and Razorpay isn't contacted.

After a deploy that brings invoices for the first time, set the business **State** in Settings → Billing straight away. Until it's set, Billing counts as incomplete and online payment shows "Request this plan".

## Promote, don't rebuild

To release what preprod tested, fast-forward `prod` to it with `git merge --ff-only preprod`. The commit is the same, so the exact image that ran on preprod goes live without being rebuilt.

## Rolling back

As the deploy user in `/srv/jobtiva`, run `./deploy.sh prod <older-sha>`. `docker images jobtiva` lists the images still on the server. A rollback doesn't undo migrations, so a migration that changed data needs its own fix.
