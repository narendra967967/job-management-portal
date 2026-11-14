---
title: What the admin dashboard numbers mean
category: Settings and data
summary: The dashboard counts customers only, for the period picked at the top (Last 30 days by default), in your own time zone. Revenue is live payments before GST. Every number opens the matching list, already filtered.
keywords: dashboard, home, stats, metrics, kpi, numbers wrong, conversion, funnel, revenue, signed in, needs attention, period, edit layout, hide block, system, deployed commit, version, job failed, job late, layout other device, layout reset, layout not saved
---

Every number on the dashboard leaves admin accounts out, so it matches what customers did. Click any number and the list behind it opens with the same filter, including **Customers only** on the Users page.

## The period

The switch at the top sets the period: Today, Last 7 days, Last 30 days, Last 90 days, This month, Last month or Custom. Last 30 days is the default, and the dashboard remembers your last choice in this browser. Days follow your own time zone, which the browser sends the first time you open the page. Changes like "+12% vs previous period" compare against the same number of days just before.

The charts keep their own Daily, Monthly and Yearly switch, because growth needs a longer view than the counts.

## How the main figures are counted

| Figure | Counts |
|---|---|
| Total users | Every customer account; the line under it is who joined in the period |
| Signed in | Different people who signed in during the period |
| Paid users | People on a paid plan that hasn't ended. The percentage is how many of the period's new sign-ups have made a live payment |
| Revenue | Live payments received in the period, before GST. Test-mode payments never count |
| Unfinished orders | Live orders started in the period and never paid, and payments that failed |
| Plan distribution | Customers by plan. A paid plan that has ended shows as **Expired** |

## The onboarding funnel

It covers people who signed up in the period: Signed up, Verified email, Set up forwarding (a forwarded job alert has arrived), Added AI key, Added a résumé, Saved 5+ leads, and Paid. Each step shows how many reached it, and "stopped" is how many reached it but not the next step. Clicking a step lists exactly those people.

## Support averages

**Avg first reply** counts your first answer on each ticket opened in the period, not the user's own follow-ups. **Avg time to resolve** uses when a resolved ticket was last updated, so a reply after resolving makes it look longer than it was.

## Needs attention

This strip shows only what needs you, most urgent first, and says "All clear" otherwise. It covers email not set up, scheduled jobs that failed on their last run (urgent) or haven't run on schedule, tickets waiting more than 24 hours, failed payments in the last 7 days, forwarding switched off, paid plans that ended in the last 7 days without renewal, account deletion requests, job alerts stuck in the AI queue for over an hour, failing Gmail syncs, Amazon SES still in the sandbox, failed emails in the last broadcast, unanswered knowledge base questions, and accounts deactivated in the last 7 days. It can't be moved or hidden.

A job line opens the System block further down, where each job's error is shown. If you've hidden System with Edit dashboard, the line still appears but has nowhere to go, so show the block again from the tray. A job that has never run, as on a fresh setup, isn't flagged.

## Other blocks

**Renewals** counts paid plans and free trials, the same as the Renewals page. **Forwarding health** shows the period's job-alert emails, and **Accepted** is accepted ÷ (accepted + rejected). **Email delivery** reads the Amazon SES quota from AWS, at most every 5 minutes, and counts the period's sent and failed emails from Monitoring → Sent emails. Unlike the rest of the dashboard, those counts include admins and test emails, because they measure delivery.

**System** shows the commit the running app was built from (the first seven characters of the git commit, or **Unknown** on a local machine) and the last run of each scheduled job. A job is **Failed** when its last run stopped with an error, which shows under its name, **Late** when it should have run again by now, and **Not run** until its first run. The scheduled jobs article explains each one.

## Changing the layout

**Edit dashboard** lets you drag blocks (on a laptop), move them with the arrows, hide them, and bring hidden ones back from the tray at the bottom. **Reset to default** undoes everything. Changes save as you make them.

The layout belongs to your admin account, not the browser, so it follows you to your phone and any other device. Each admin has their own; changing yours never moves anything for another admin. Blocks added to the dashboard later appear in their usual place, even in a layout you've changed. If a change can't be saved, a message says so, and your next change saves the whole layout again.
