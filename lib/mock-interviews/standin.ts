// A stand-in interviewer for the interview screen until the real one is wired
// (roadmap R1.5): a generic opening question, canned follow-ups and tips.
// Nothing it says is saved. Delete this file in R1.5.

import type { ChatMessage } from "./model";

export function standInOpening(role: string): ChatMessage {
  return {
    id: "standin-open",
    from: "ai",
    questionNo: 1,
    at: 0,
    text: `Thanks for joining. Let's start with an overview: tell me about a project you led that's relevant to this ${role} role, and what it delivered.`,
  };
}

export const STANDIN_FOLLOW_UPS = [
  "Can you give me a specific example of when you did that?",
  "What would you do differently if you ran it again?",
  "How did you measure whether it worked?",
  "Thanks. Next question: walk me through how you'd plan your first month in this role.",
];

export const STANDIN_TIPS = [
  "Lead with the outcome, then explain how you got there.",
  "Name the trigger: what date or signal made you act, and who you told.",
  "Give a range, not one date, and say what would narrow it.",
  "Use one real example. Situation, what you did, and the result.",
];
