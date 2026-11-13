# Admin dashboard revamp: approved scope

Approved by the owner on November 14, 2026, after a block-by-block review of `/jmp-admin/dashboard`.
The dashboard answers two questions: **is anything waiting on me or broken**, and **is the business
growing**. Every number on it opens the page that holds those rows, already filtered.

## Blocks

| Block | Decision | Links to |
|---|---|---|
| Needs attention | New. Top of the page, always shown, can't be hidden. Lines appear only when something needs the admin; a quiet day shows "All clear". | The page that fixes each item, filtered |
| Total users (tile) | Keep | Users, joined in period |
| Signed in (tile) | Replaces "Active users": people who signed in during the period. Deactivated accounts move to Needs attention. | Users, signed in during period |
| Paid users (tile) | New: users on a paid plan now, and the share of the period's sign-ups who paid | Users, paid plans |
| Revenue (tile + block) | New: paid orders in the period, net of GST, test-mode orders excluded, and the screen says so. Compared with the previous period, by month and by plan. Refunds shown separately once refunds exist. | Orders & payments, paid in period |
| Orders that didn't complete | New: created but unpaid, and failed | Orders & payments, filtered |
| New users (chart) | Keep, plus a line for paid sign-ups; Daily / Monthly / Yearly switch stays | Users, joined that day or month |
| Active users (chart) | Keep (distinct users who signed in) | Users, signed in that day or month |
| Plan distribution | Keep, with expired paid plans as their own slice | Users, filtered by plan |
| Onboarding funnel | Signed up → Verified email → Set up forwarding → Added AI key → Added a résumé → Saved 5+ leads → Paid | Users who reached a step but not the next |
| Support | SLA, tickets donut (Open and In progress only) and "Waiting on you" (open and in progress, oldest first) in one block. First response counts the first admin reply only. | Support tickets, filtered; each row opens its ticket |
| Renewals | Replaces Plan expiry: due in 7 days, due in 30 days, expired in the last 30 days, next five due. Fixes the oldest-first sort. | Renewals, filtered |
| Forwarding health | Keep | Inbound email log, filtered by status and time |
| Gmail health | Keep, shown only while Gmail sign-in sync is on | |
| Broadcasts | New: next scheduled, sending now with progress, last sent with delivered and failed | Broadcasts, or the broadcast |
| Email delivery | New: service in use and whether it's ready, SES quota, emails sent and failed in the period by channel | Settings → Email delivery, the sent-email log |
| System | Environment, deployed commit, real database size, résumé and asset storage, last run of each scheduled job | Matching settings page |

**Removed:** Résumés stored tile, AI scores tile and chart (all user AI runs on the user's own key),
Users by status donut, Recent activity feed, the app version and "Database: Connected" rows.
The Add with AI monthly-limit signal is not tracked.

## Page controls

- One period switch: Today, Last 7 days, Last 30 days (default), Last 90 days, This month, Last month,
  Custom. Counts and averages follow it; charts keep their own Daily / Monthly / Yearly switch.
- The data loads fresh on each visit, with an "Updated" time and a Refresh button. No background polling.

## New data (approved)

- **Sent-email log.** One row per email the app sends: recipient, which email (template key or
  broadcast or test), channel, sent or failed, error. No email content. Recorded at
  `sendMailWith` in `lib/mailer.ts`, the one function every outgoing email passes through, so every
  channel is covered. The channel is stored as text, so a future channel needs no migration. Kept
  30 days under Settings → Data retention. Recording never blocks or delays sending. The Privacy
  Policy gets one line about it.
- **Job runs.** One row per scheduled job: last run, OK or failed, error. Also the base for the
  "Scheduled jobs" page marked coming soon.
- **Deployed commit.** Passed into the image at build time.
- **Layout.** Saved per admin account (phase 6).

A future Google Workspace channel should send through its SMTP server with the existing SMTP option.
The Gmail API send scope stays off limits (CLAUDE.md hard rule 3).

## Customizing (phase 6)

Edit dashboard mode: drag and drop with dnd-kit on laptops (new dependency, approved), up and down
buttons on phones, hide and unhide through a tray, Reset to default. Layout saved per admin in the
database. Block sizes are fixed. Needs attention can't be hidden.

## Roadmap

1. Screens on sample data, checked at 375px and 768px.
2. Filters in links on Users, Support tickets, Orders & payments, Renewals and Broadcasts.
3. Real data: counting in the database, period switch, fixes.
4. Sent-email log.
5. Job runs and deployed commit.
6. Customizable layout.
7. Check script, knowledge-base articles, preprod, prod.
