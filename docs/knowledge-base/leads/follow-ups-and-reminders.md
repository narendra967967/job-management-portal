---
title: How follow-up reminders are scheduled
category: Leads and automation
summary: Marking a message as sent schedules a follow-up reminder 3 days later by default. Marking that reminder "Reminder sent" lines up the next one, up to 2 more by default, and any other outcome ends the chain.
keywords: reminder, follow-up, due, to-do, reminder interval, automatic follow-ups, reminder sent, response received, not responded
---

When the user marks a message as sent, a follow-up reminder is scheduled for later, at the same time of day, along with a to-do for that day. The gap is their **Reminder interval (days)** in Settings → Follow-ups, 3 by default.

When a reminder is due, the user records what happened:

| Outcome | What it means | What happens next |
|---|---|---|
| Reminder sent | They followed up | The next follow-up is scheduled the same interval later, until the limit |
| Response received | They got a reply | The chain stops. If the lead hasn't reached Interview, they're asked whether to move it there |
| Not responded | No reply | The chain stops |
| Closed | The job is over | The chain stops |

How many follow-ups come after the first is set by **Automatic follow-ups after the first**, from 0 to 5. It's 2 by default, so three follow-ups in all. 0 turns the chain off. The chain also stops on its own when the lead is closed or discarded.

Only follow-ups tied to a sent message form a chain. Reminders the user adds by hand don't.

## How reminders affect the rest

A lead with a pending reminder never goes stale, and the daily cleanup rules leave it alone. Once the follow-ups are used up with no reply, the "Follow-ups used up" rule can close it as No response after 14 quiet days.

## The To-do page

To-dos are grouped as Overdue, Today, Upcoming and No due date. Below them, under "Needs a next step", open leads with no to-do get a nudge, such as "Follow up or close this lead" for an Applied lead.
