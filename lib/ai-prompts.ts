// Default AI instruction prompts, shared by the Server Actions (fallback when a
// user hasn't set a custom one) and the Settings UI (shown as placeholders).
// Pure module — safe to import from both server and client.
//
// These are INSTRUCTION prompts only. The app always appends the actual content
// (the pasted JD, or the lead/contact/resume context) as the user message, so a
// custom prompt never needs to include the data itself.

export const DEFAULT_SUMMARY_PROMPT =
  "You summarize job descriptions in 2–3 short lines for quick scanning — role, seniority, location, and key focus. No preamble, no bullet points.";

export const DEFAULT_DRAFT_PROMPT =
  "You draft short, professional LinkedIn outreach for a job seeker (120–160 words). Warm, specific to the role and recipient, no fluff or clichés. Start with a greeting using the recipient's first name. The user will review and edit before sending, so do not invent specific facts about the sender beyond the resume label.";

export const DEFAULT_SCORE_PROMPT =
  "You assess how well a candidate's resume fits a specific job. Weigh required skills, seniority, domain, and responsibilities. Give a 0–100 fit score (higher = stronger fit) and a one-sentence rationale naming the biggest match or gap. Be realistic and consistent.";
