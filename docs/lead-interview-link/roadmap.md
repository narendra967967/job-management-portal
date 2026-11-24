# Linking leads and mock interviews: roadmap

Status: **draft for owner review** (November 24, 2026). Nothing here is built yet.

## Goal

Make interview practice reachable from the lead side wherever a lead appears, and let what
happens in practice flow back to the lead. Today the two meet in only three places:

- The lead page shows **Prepare for this interview**, and only at the Interview stage.
- The booking form can take a lead's job description, and `?lead=` pre-fills it.
- The AI interviews **Get ready** card suggests one Interview-stage lead.

Each booking already stores the lead it came from (`ai_interviews.lead_id`, set to null if the
lead is deleted, plus `lead_label`), but nothing on the lead side reads it.

## What the owner picked (November 24, 2026)

All twelve options, shipped in phases, smallest first:

| # | Item | Group |
|---|---|---|
| 1 | Practice panel on every lead (any stage), with the lead's past practices, scores and report links | On the lead |
| 2 | Practice badge on lead cards and table rows, plus a practiced / not practiced filter | On the lead |
| 3 | "Practice interview" in every lead's ⋯ menu (cards, table, lead page) | On the lead |
| 4 | Report and Interview history show the lead ("Open lead"); history filters by company | On the lead |
| 5 | Prompt when a lead moves to Interview: "Practice for it now?" | Nudges |
| 6 | Automatic to-do "Practice for <role> at <company>", ticked when a practice for that lead completes | Nudges |
| 7 | Optional interview date on the lead, with reminders that suggest a practice | Nudges |
| 8 | "Interviews coming up" section with each lead's practice status | Nudges |
| 9 | Smarter pre-fill from the lead, including suggested topics | Data both ways |
| 10 | Practice summary on the lead's timeline (score and top things to fix) | Data both ways |
| 11 | Company-aware interviewer (told the company and what the lead says about it) | Data both ways |
| 12 | Interview readiness per lead, from its practices | Data both ways |

## Ground rules for every phase

- **Only while AI interviews are open.** Everything on the lead side hides when Module settings
  say Coming soon, like today's Prepare box (`candidateAiOpen` / `aiInterviewsOpenAction`).
- **Per user.** Every read goes through the session user; a lead's practices are the user's own
  `ai_interviews` rows with that `lead_id`.
- **Limited mode.** Lead pages are locked when a plan ends, so the lead-side entry points are
  unreachable then. Mock interviews stay open, so items 4 and 8 must cope with a lead the user
  can't open (show the label, no link).
- **No LinkedIn automation.** Item 11 uses only what the user has saved on the lead.
- Mobile first (375 and 768px), the data-table rule for any list, KB articles in the same
  commit, and the mock interview checks script extended in each phase.

## Phase 1: see and start practice from any lead (no schema change)

The "small first release". Everything reads data that already exists.

- **Item 12, readiness (needed by 1 and 2).** A small helper in `lib/mock-interviews/data.ts`:
  for each lead, the number of completed practices, the latest score, and when. Loaded once
  per page for the user's leads (one grouped query), not per card.
- **Item 1, practice panel.** Replaces today's Interview-only Prepare box on the lead page.
  Shows at every open stage: a "Practice for this job" button and, if there are any, the
  lead's practices (date, level, length, score, View report). At the Interview stage the
  panel is highlighted, as the box is today.
- **Item 2, badge and filter.** A compact chip on cards and table rows ("Practiced · 72")
  and a filter in the lead filters (Practiced / Not practiced). No chip when there are none,
  to keep cards quiet.
- **Item 3, menu action.** "Practice interview" in the lead ⋯ menu everywhere it appears,
  opening the booking form with `?lead=`.
- **Item 4, links back.** The report page and Interview history show "For: <role> at
  <company>" with Open lead; history gets a company filter.

Checks: a lead's practices never show for another user; the panel hides when interviews are
Coming soon; the badge numbers match the reports.

## Phase 2: nudges from the pipeline (no schema change)

- **Item 5, prompt on moving to Interview.** After the stage change (drag on the board,
  the stage menu or the lead page), a toast-style prompt with "Practice now" and "Not now".
  Not shown again for the same lead once dismissed (per browser).
- **Item 8, interviews coming up.** A section on the AI mock interviews page (and a small
  block in Ready to action) listing Interview-stage leads with their practice status from
  phase 1. Until item 7 lands it has no dates, so it's ordered by when the lead reached
  Interview.
- **Item 10, timeline entry.** The lead timeline gets "Practiced: Medium, 30 min, scored
  72" with the report's top two things to fix and a link. Built from the existing interview
  and report rows, so nothing new is stored.

## Phase 3: smarter interviews from lead data (prompt changes, maybe one column)

- **Item 9, smarter pre-fill.** Booking from a lead fills the role, the job description and,
  where it can tell, the industry. "Suggest topics" offers topics drawn from the job
  description and the fit-score explanation. Open decision: plain matching (free, rougher)
  or one AI call on the module key (better, costs the platform a little per use).
- **Item 11, company-aware interviewer.** A new `{{company}}` placeholder for the admin
  prompts, filled from the lead. The company should be kept on the booking itself (a new
  `ai_interviews.company` column) so it survives the lead being deleted. That's a one-table
  change, flagged for sign-off when the phase starts.

## Phase 4: dates and to-dos (schema changes)

- **Item 7, interview date.** A new optional `job_leads.interview_at` (date and time),
  set on the lead page and asked for in the item 5 prompt. Reminders before it suggest a
  practice through the existing reminders, and any new email goes through Email templates.
  Item 8 then orders by date.
- **Item 6, automatic to-do.** Needs a new task kind ("practice") in the `task_kind` enum.
  Created when a lead moves to Interview, closed automatically when a practice for that lead
  completes, and left alone if the user deleted it.

Both touch the schema (two tables in total), so this phase needs sign-off before it starts.

## Open decisions for the owner

1. **Readiness (item 12):** show the latest score or the best one? Suggestion: the latest,
   with its date, because it reflects where the candidate is now.
2. **Topic suggestions (item 9):** plain matching or an AI call on the module key?
3. **Prompt on Interview (item 5):** once per lead, or every time a lead enters Interview?
4. **Interview date (item 7):** should it also stop a lead going stale until the date passes?

## Progress

| Phase | Status |
|---|---|
| 1 | Not started |
| 2 | Not started |
| 3 | Not started |
| 4 | Not started |
