// Admin → Mock interviews → AI interviews: the shapes the screen reads.

import type { Difficulty } from "./model";

export type AdminSessionStatus = "completed" | "stopped" | "in_progress" | "failed";

export interface AdminSession {
  id: string;
  startedAt: string; // ISO
  user: { name: string; email: string };
  role: string;
  category: string;
  difficulty: Difficulty;
  durationMin: number;
  status: AdminSessionStatus;
  questions: number;
  tokensIn: number;
  tokensOut: number;
  /** What the AI calls cost Jobtiva, in paise (fractions allowed). */
  costPaise: number;
  payment: { kind: "paid"; paise: number } | { kind: "plan" } | { kind: "free" } | { kind: "credit" };
  /** This interview was given back: the reason on the replacement booking. */
  credited?: { note: string };
}

export interface SessionEvent {
  kind: string;
  text: string;
  /** Seconds on the interview clock. */
  clockSeconds: number;
}

/** "m:ss" on the interview clock. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
