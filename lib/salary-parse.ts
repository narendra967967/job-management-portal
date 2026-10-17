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

/**
 * Coerce the model's JSON into a safe SalaryInsight, or throw. When the app has
 * fixed the market (`expected`), the answer MUST use that currency — otherwise
 * its numbers are in the wrong unit, so it's rejected — and the market label
 * is ours, not the model's.
 */
export function toSalaryInsight(
  raw: string,
  resumeLabel: string | null,
  expected?: { market: string; currency: string } | null,
): SalaryInsight {
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const p = JSON.parse(json) as Record<string, unknown>;
  const [low, typical, high] = [num(p.low), num(p.typical), num(p.high)].sort((a, b) => a - b);
  if (!low || !typical || !high) throw new SyntaxError("missing figures");
  const said = str(p.currency, 3).toUpperCase();
  if (expected && said !== expected.currency) {
    throw new SyntaxError(`currency mismatch: expected ${expected.currency}, got ${said || "none"}`);
  }
  const currency = expected?.currency ?? (/^[A-Z]{3}$/.test(said) ? said : "INR");
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
    basis: expected
      ? { country: expected.market, resumeLabel, marketSource: "location" }
      : { country: str(p.country, 80) || "Unknown", resumeLabel, marketSource: "inferred" },
    generatedAt: new Date().toISOString(),
  };
}
