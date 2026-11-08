---
title: Sending email through SMTP or Amazon SES (email delivery)
category: Settings and data
summary: Settings → Email delivery picks the service every email goes out through, SMTP or Amazon SES, and holds the settings for both. Switching takes effect right away. There's no automatic fallback, so test before switching.
keywords: amazon ses, aws ses, smtp, email provider, email service, switch email, sandbox, production access, sending quota, send rate, access key, iam, email not sending, bounce, which mail server
---

Everything the app emails goes out through one service, picked in **Settings → Email delivery** under **Send emails with**: SMTP or Amazon SES. That includes sign-in links, codes, receipts, plan reminders, support emails and broadcasts. Switching takes effect for the very next email.

You can only pick a service that has its settings saved. The other one keeps its settings, so switching back is one click.

## The two tabs

**SMTP** is a normal mail server, such as the one that comes with your domain's mailbox. Its settings are unchanged from before. If **Send emails via SMTP** is off, the app uses the server's own SMTP settings from its environment, when it has any. Its **Send a test email** always goes through SMTP, whichever service is in use.

**Amazon SES** needs the region your domain is verified in (for example ap-south-1), an access key ID and secret access key, and a from email on a domain or address verified in SES. The secret is stored encrypted and never shown again. Type a new one to replace it. Changing the access key ID needs its secret too, and changing the region or keys clears the old Test connection result.

## Checking SES before you switch

**Test connection** asks AWS about the account and shows four things:

| Line | What it means |
|---|---|
| Sending | Allowed, or paused by AWS (check the SES console for why) |
| Account | Production access, or Sandbox. In the sandbox SES only delivers to addresses you've verified, so real users won't get email |
| Daily limit | How many emails SES allows in 24 hours, and how many went out in the last 24 |
| Send rate | How many emails a second SES accepts |

**Send a test email** on the SES tab goes through SES even while SMTP is in use. Do both before choosing Amazon SES, and don't switch while the account still says Sandbox.

## When an email doesn't go out

There's no automatic fallback between the services. If the one in use can't send an email, that email fails. Broadcasts try a failed email again after 5 minutes, up to 3 times, and plan reminders try again on the next day's run. If a service is down for longer, switch to the other one.

The SES tab turns AWS errors into plain messages:

| Message starts with | What to do |
|---|---|
| AWS doesn't recognize that access key ID | The key is wrong, deleted or deactivated. Make a new access key in IAM |
| The secret access key doesn't match | Paste the secret again; it's easy to lose a character |
| This access key isn't allowed | The IAM user's policy needs ses:SendEmail, ses:SendRawEmail and ses:GetAccount |
| SES refused it because an address isn't verified | The account is in the sandbox, or the from address isn't verified |
| AWS has paused sending | Look in the SES console; usually too many bounces or complaints |
| Couldn't reach Amazon SES | The region is wrong, or the server can't reach AWS |

## Setting up SES in AWS

In short: verify your domain in SES (it gives you DNS records to add), request production access from the SES console and wait for AWS to approve it, then create an IAM user that can only send email and make an access key for it. Use the same region throughout.

Addresses that bounce or complain go onto SES's own suppression list, and SES stops sending to them. The app doesn't see those yet, so a user whose address bounced simply stops getting email until it's removed from that list in the SES console.

## Testing on a developer's machine

As with SMTP, emails to test addresses such as `.test` are never sent locally. For trying SES without AWS, the `SES_ENDPOINT` variable points the app at a stand-in. Production ignores it.
