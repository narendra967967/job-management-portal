---
title: Why a lead moved stage on its own after the user did something
category: Leads and automation
summary: With "Update status automatically" on, some actions move a lead forward, such as saving a description (to Shortlisted) or sending cold outreach (to Applied). The card says why for 7 days, and the move can be undone.
keywords: auto status, moved automatically, shortlisted, applied, undo, update status automatically, pinned
---

When "Update status automatically" is on in Settings → Follow-ups, which it is by default, these actions move a lead forward:

| What the user did | Moves the lead to |
|---|---|
| Marked it as a Top Choice | Shortlisted |
| Saved its job description | Shortlisted |
| Added a contact | Shortlisted |
| Marked a referral request as sent | Shortlisted |
| Marked cold outreach or a follow-up as sent | Applied |
| Scored their resume against it, 80 or above | Shortlisted |

The score line depends on the Strong fit cleanup rule. While that rule is on, only a score at or above its number moves the lead (80 unless the user changed it), and lower scores leave it where it is. With Strong fit off, any score moves it.

## What never happens

- Moves only go **forward**. A lead is never moved back by these rules.
- **Closed and discarded** leads are never touched.
- If the user moves a lead **back by hand**, these moves leave it alone until they move it forward themselves.

## How the user knows

Each move shows a toast with **Undo**. The card also says why, such as "Moved to Shortlisted automatically because you saved the job description", for 7 days, and the lead's Timeline keeps it for good. When the user changes the stage themselves, the message goes away.

## Getting a reply

When a follow-up is marked "Response received" on a lead that hasn't reached Interview, the user is asked whether to move it to Interview. It isn't moved without that.
