import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fitScores, jobLeadDetails, jobLeads } from "@/db/schema";
import { aiComplete, userHasAiKey } from "@/lib/ai";
import { DEFAULT_TOPICS, TOPIC_SUGGESTIONS } from "./model";

// "Suggest topics" on the booking form, for an interview booked from a lead
// (docs/lead-interview-link/roadmap.md, item 9). Owner decision (November 24,
// 2026): use the candidate's own AI key when they have one; match keywords
// when they don't, or when the AI call fails.

export const SUGGEST_MAX = 6;
const TOPIC_MAX_CHARS = 40;

/** Topics an interviewer might probe, and the words in a job description that point to each. */
const VOCAB: { topic: string; words: RegExp }[] = [
  { topic: "Stakeholder management", words: /\bstakeholders?\b|\bclient[- ]facing\b|\bexecutive\b|\bsteering\b/gi },
  { topic: "Risk management", words: /\brisks?\b|\bissues? log\b|\bmitigat/gi },
  { topic: "Agile and Scrum", words: /\bagile\b|\bscrum\b|\bsprints?\b|\bkanban\b|\bsafe\b/gi },
  { topic: "Estimation", words: /\bestimat\w*|\bplanning\b|\bscheduling\b|\btimelines?\b/gi },
  { topic: "Budget tracking", words: /\bbudgets?\b|\bcost control\b|\bp&l\b|\bforecast/gi },
  { topic: "Delivery and release", words: /\bdelivery\b|\breleases?\b|\bgo-live\b|\bdeploy\w*/gi },
  { topic: "Team leadership", words: /\blead(ing)? (a )?teams?\b|\bpeople management\b|\bmentor\w*|\bmanag(e|ing) (a )?team/gi },
  { topic: "Conflict", words: /\bconflicts?\b|\bnegotiat\w*|\bescalat\w*/gi },
  { topic: "Communication", words: /\bcommunicat\w*|\bpresentations?\b|\breporting\b/gi },
  { topic: "Prioritization", words: /\bprioriti[sz]\w*|\bbacklog\b|\btrade-?offs?\b/gi },
  { topic: "Roadmaps", words: /\broadmaps?\b|\bproduct strategy\b|\bvision\b/gi },
  { topic: "Metrics", words: /\bmetrics?\b|\bkpis?\b|\bokrs?\b|\banalytics\b/gi },
  { topic: "User research", words: /\buser research\b|\bcustomer interviews?\b|\busability\b|\bpersonas?\b/gi },
  { topic: "Go-to-market", words: /\bgo-to-market\b|\bgtm\b|\blaunch\w*/gi },
  { topic: "Architecture", words: /\barchitect\w*|\bmicroservices?\b|\bdistributed\b/gi },
  { topic: "System design", words: /\bsystem design\b|\bscalab\w*|\bhigh availability\b/gi },
  { topic: "APIs", words: /\bapis?\b|\brest(ful)?\b|\bgraphql\b|\bintegrations?\b/gi },
  { topic: "Databases", words: /\bdatabases?\b|\bpostgres\w*|\bmysql\b|\bmongo\w*|\bnosql\b/gi },
  { topic: "SQL", words: /\bsql\b/gi },
  { topic: "Cloud", words: /\baws\b|\bazure\b|\bgcp\b|\bcloud\b|\bkubernetes\b|\bdocker\b/gi },
  { topic: "Testing", words: /\btesting\b|\bqa\b|\bquality assurance\b|\btest automation\b|\bunit tests?\b/gi },
  { topic: "Debugging", words: /\bdebug\w*|\btroubleshoot\w*|\broot cause\b|\bincidents?\b/gi },
  { topic: "Performance", words: /\bperformance\b|\blatency\b|\boptimi[sz]\w*/gi },
  { topic: "Security", words: /\bsecurity\b|\bcompliance\b|\biso 27001\b|\bgdpr\b|\bsoc ?2\b/gi },
  { topic: "Data structures", words: /\bdata structures?\b|\balgorithms?\b/gi },
  { topic: "A/B testing", words: /\ba\/b\b|\bexperiment\w*/gi },
  { topic: "Dashboards", words: /\bdashboards?\b|\btableau\b|\bpower ?bi\b|\blooker\b/gi },
  { topic: "Data cleaning", words: /\bdata quality\b|\bdata cleaning\b|\betl\b|\bpipelines?\b/gi },
  { topic: "Vendor management", words: /\bvendors?\b|\bsuppliers?\b|\bprocurement\b|\bcontracts?\b/gi },
  { topic: "Process improvement", words: /\bprocess improvement\b|\blean\b|\bsix sigma\b|\bautomation\b/gi },
  { topic: "Customer focus", words: /\bcustomer (success|experience|satisfaction)\b|\bcsat\b|\bnps\b/gi },
  { topic: "Sales and targets", words: /\bsales\b|\bquotas?\b|\brevenue targets?\b|\bpipeline\b/gi },
];

/** Plain matching: the vocabulary topics the text mentions most, then the kind's usual ones. */
export function keywordTopics(text: string, category: string, max = SUGGEST_MAX): string[] {
  const scored = VOCAB.map((v) => ({ topic: v.topic, n: (text.match(v.words) ?? []).length }))
    .filter((v) => v.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((v) => v.topic);
  const fill = TOPIC_SUGGESTIONS[category] ?? DEFAULT_TOPICS;
  const out: string[] = [];
  for (const t of [...scored, ...fill]) {
    if (out.length >= max) break;
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Clean an AI reply into short, distinct topics, or [] if it isn't usable. */
export function parseTopics(raw: string, max = SUGGEST_MAX): string[] {
  let list: unknown;
  try {
    const json = raw.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1)) as { topics?: unknown };
    list = parsed.topics;
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const t = item.replace(/^[-*•\d.\s]+/, "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > TOPIC_MAX_CHARS) continue;
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export type TopicSuggestion = { ok: true; topics: string[]; source: "ai" | "keywords" } | { ok: false; error: string };

/** Topics for practicing this lead's interview. The lead must be the user's. */
export async function suggestTopicsForLead(userId: string, leadId: string, category: string): Promise<TopicSuggestion> {
  const [lead] = await db
    .select({ title: jobLeads.title, company: jobLeads.company })
    .from(jobLeads)
    .where(and(eq(jobLeads.id, leadId), eq(jobLeads.userId, userId)));
  if (!lead) return { ok: false, error: "That lead isn't available." };
  const [detail] = await db
    .select({ jd: jobLeadDetails.jdText, summary: jobLeadDetails.aiSummary })
    .from(jobLeadDetails)
    .where(and(eq(jobLeadDetails.leadId, leadId), eq(jobLeadDetails.userId, userId)));
  const jd = (detail?.jd?.trim() || detail?.summary?.trim() || "").slice(0, 12_000);
  if (!jd) return { ok: false, error: "This lead has no job description saved, so there's nothing to suggest from." };
  // Why the resume fits or falls short: worth practicing the gaps.
  const fits = await db
    .select({ rationale: fitScores.rationale })
    .from(fitScores)
    .where(and(eq(fitScores.leadId, leadId), eq(fitScores.userId, userId)))
    .orderBy(desc(fitScores.updatedAt))
    .limit(2);
  const fitText = fits.map((f) => f.rationale?.trim()).filter(Boolean).join(" ");

  if (await userHasAiKey(userId)) {
    try {
      const system = [
        "You help a job seeker prepare for a real interview.",
        `Suggest up to ${SUGGEST_MAX} topics the interviewer is most likely to probe, drawn from the job description${fitText ? " and the notes on how the candidate's resume fits it (gaps are worth practicing)" : ""}.`,
        `Each topic is 1 to 4 words, under ${TOPIC_MAX_CHARS} characters, like "Stakeholder management" or "SQL".`,
        `The kind of interview is "${category || "general"}": lean towards topics that fit it.`,
        'Reply with ONLY minified JSON: {"topics": ["..."]}. No other text.',
      ].join("\n");
      const user = [`Role: ${lead.title} at ${lead.company}`, `Job description:\n${jd}`, ...(fitText ? [`How the resume fits:\n${fitText}`] : [])].join("\n\n");
      const topics = parseTopics(await aiComplete(userId, system, user, 300, { timeoutMs: 25_000 }));
      if (topics.length) return { ok: true, topics, source: "ai" };
    } catch {
      // A bad key, a timeout or a provider error: fall back to matching.
    }
  }
  return { ok: true, topics: keywordTopics(`${lead.title}\n${jd}\n${fitText}`, category), source: "keywords" };
}
