// Job ↔ resume "fit score" — display helpers.
//
// Scores are now real AI values computed on demand (actions/ai.scoreFitAction)
// and cached per (lead, resume). This module just maps a numeric score to a
// label/colour band; a lead with no cached score shows "NC" in the UI.

export interface FitBand {
  label: string;
  /** Tailwind classes reusing the status palette for a colored pill. */
  chip: string;
  text: string;
  advice: string;
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
