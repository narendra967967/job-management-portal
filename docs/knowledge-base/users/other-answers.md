---
title: Other answers, what users type when a dropdown has no match
category: Users and support
summary: When a user picks Other in a dropdown, they have to type what they meant. Customers → Other answers groups those typed answers, most common first, so you can decide what to add to the list and mark each one Added to the list or Not adding.
keywords: other, custom answer, not in the list, missing option, industry, typed answer, user feedback, product ideas, please specify
---

A dropdown never covers everyone. When a user picks **Other**, a box appears under it and they have to say what they meant before they can carry on. Those answers are how you find the options people actually need.

## Which dropdowns ask

Only one so far: **Industry** on the AI mock interview booking form. Picking Other there shows a "Which industry?" box. It needs at least 2 characters and takes up to 60. The typed industry is what the candidate then sees on their bookings, the prep page and Interview history, and it's what the AI interviewer is told, so the questions fit "Renewable energy" rather than a generic "Other". Give interview back copies it to the new booking.

Changing a booking with Edit setup works the same way. Picking a listed industry instead drops the typed text.

## Reading the page

**Customers → Other answers** has one row per answer. Answers that differ only in capital letters or extra spaces count as one, so "Renewable energy" and "renewable  Energy" are a single row. The row shows the spelling most people used, how many times it was given and by how many users, and when it was first and last seen. The most common answers come first.

There's no date window. It's a running tally, so an answer from months ago still counts toward what people want.

## Marking answers

Each answer starts as **New**. Once you've decided, mark it from the row's menu, or pick several and use the bar above the table:

| Status | Use it when |
|---|---|
| Added to the list | The option is now in the dropdown |
| Not adding | You've looked at it and won't add it |
| New | Back to New clears the mark |

The boxes above the table count each status and filter to it when clicked. Export CSV downloads the selected rows.

Marking an answer doesn't change the dropdown. Adding an option is a code change (the industry list is `INDUSTRIES` in `lib/mock-interviews/model.ts`). Bookings made before keep Other with their typed text, so the old answer stays on the page. That's expected; marking it Added to the list is the record that it's handled.

## When an account is deleted

The typed text lives on the user's own booking, so it's deleted with their account, and the counts drop. If every answer behind a mark is gone, the mark is removed the next time anyone opens the page.

## Adding Other to another dropdown

For whoever builds it: add the field to `OTHER_FIELDS` in `lib/other-answers-model.ts`, keep the typed text on the record itself (so it's deleted with the account), and add one query to `SOURCES` in `actions/admin-other-answers.ts`. The page picks it up from there, with its own entry in the Field filter.
