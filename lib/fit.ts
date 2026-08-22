// Job ↔ resume "fit score".
//
// PHASE 1 PLACEHOLDER: a deterministic pseudo-score derived from the lead +
// resume ids so the UI has something stable to render. Phase 3 replaces
// `computeFitScore` with a real Server Action that scores the pasted job
// description against the selected resume via the configured AI provider.

export interface FitBand {
  label: string;
  /** Tailwind classes reusing the status palette for a colored pill. */
  chip: string;
  text: string;
  advice: string;
}

/** Stable 0–100-ish score for a (lead, resume) pair. Range ~45–95. */
export function computeFitScore(leadId: string, resumeId: string): number {
  const s = `${leadId}::${resumeId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 45 + (Math.abs(h) % 51); // 45..95
}

export function fitBand(score: number): FitBand {
  if (score >= 80)
    return {
      label: "Strong fit",
      chip: "bg-status-applied text-status-applied-foreground",
      text: "text-status-applied-foreground",
      advice: "Strong match — worth pursuing.",
    };
  if (score >= 65)
    return {
      label: "Good fit",
      chip: "bg-status-new text-status-new-foreground",
      text: "text-status-new-foreground",
      advice: "Solid match — good to proceed.",
    };
  if (score >= 55)
    return {
      label: "Fair fit",
      chip: "bg-status-reviewing text-status-reviewing-foreground",
      text: "text-status-reviewing-foreground",
      advice: "Partial match — consider a more tailored resume.",
    };
  return {
    label: "Weak fit",
    chip: "bg-status-discarded text-status-discarded-foreground",
    text: "text-muted-foreground",
    advice: "Weak match — a different resume may score better.",
  };
}
