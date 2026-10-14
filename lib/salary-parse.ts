// Turns the AI's salary JSON into a safe SalaryInsight (pure — unit-testable).
// Bad numbers are rejected, the range is sorted, the suggested ask is kept
// within a sane band, and every text field is length-capped.

import type { SalaryInsight } from "@/lib/types";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const str = (v: unknown, max: number) => (v == null ? "" : String(v)).trim().slice(0, max);
const list = (v: unknown, n: number) =>
  Array.isArray(v) ? v.map((x) => str(x, 240)).filter(Boolean).slice(0, n) : [];

/** Coerce the model's JSON into a safe SalaryInsight, or throw. */
export function toSalaryInsight(raw: string, resumeLabel: string | null): SalaryInsight {
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const p = JSON.parse(json) as Record<string, unknown>;
  const [low, typical, high] = [num(p.low), num(p.typical), num(p.high)].sort((a, b) => a - b);
  if (!low || !typical || !high) throw new SyntaxError("missing figures");
  const currency = /^[A-Z]{3}$/.test(str(p.currency, 3).toUpperCase())
    ? str(p.currency, 3).toUpperCase()
    : "INR";
  // Keep the suggested ask inside a sane band around the range.
  const ask = Math.min(Math.max(num(p.suggestedAsk) || typical, low), Math.round(high * 1.2));
  const confidence = ["low", "medium", "high"].includes(String(p.confidence))
    ? (p.confidence as SalaryInsight["confidence"])
    : "low";
  return {
    currency,
    low,
    typical,
    high,
    suggestedAsk: ask,
    confidence,
    summary: str(p.summary, 600),
    factors: list(p.factors, 5),
    tips: list(p.tips, 4),
    basis: { country: str(p.country, 80) || "Unknown", resumeLabel },
    generatedAt: new Date().toISOString(),
  };
}
