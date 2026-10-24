// Lead tag hygiene shared by every reader (built-in or AI). Pure.

/** One tag style for every reader (built-in or AI): no trailing "*" estimate
 *  marker, an en dash between numbers ("4–9 yrs", "$95K–$115K"). */
export function tidyTag(tag: string): string {
  return tag
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\*+$/, "")
    .replace(/(\d[kKmM+]?)\s*[-–—]\s*(?=[$₹€£]?\d)/g, "$1–")
    .trim();
}

/** Merge tag lists, dropping look-alikes (case, spacing, punctuation). */
export function mergeTags(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of lists.flat().map(tidyTag)) {
    const key = t.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
