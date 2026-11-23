// "Other" answers (admin Customers → Other answers). When a user picks Other in
// a dropdown, they type what they meant; admins see those answers grouped and
// mark each one once it's been dealt with. Safe for browser code.
//
// To add another dropdown: give it a key here, keep the typed text on its own
// record (so it goes with the account), and add its query to SOURCES in
// actions/admin-other-answers.ts.

/** Longest "Other" answer a user can type. */
export const OTHER_MAX = 60;

export const OTHER_FIELDS = {
  interview_industry: { label: "AI interview: Industry", ask: "Which industry?" },
} as const;

export type OtherField = keyof typeof OTHER_FIELDS;
export const OTHER_FIELD_KEYS = Object.keys(OTHER_FIELDS) as OtherField[];

export type OtherStatus = "new" | "added" | "not_adding";
export const OTHER_STATUS_LABELS: Record<OtherStatus, string> = {
  new: "New",
  added: "Added to the list",
  not_adding: "Not adding",
};

/** A typed answer as it's kept: control characters out, spaces collapsed, trimmed. */
export function cleanOther(v: string): string {
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, OTHER_MAX);
}

/** How answers are grouped: "Renewable  Energy " and "renewable energy" are one. */
export const otherKey = (v: string) => cleanOther(v).toLowerCase();

/** Problem with a typed answer, or "" when it's fine. */
export function otherError(v: string, field: OtherField): string {
  const c = cleanOther(v);
  if (c.length < 2) return `${OTHER_FIELDS[field].ask} Type it in.`;
  return "";
}
