// R1.6 practice runs: complete AI mock interviews through the real interviewer
// (lib/mock-interviews/engine.ts), with a second AI playing the candidate at a
// set strength. Saves transcripts, reports, tokens, cost and reply times for
// the quality and cost report. LOCAL DATABASES ONLY; uses the module key saved
// in Module settings and spends real money on it.
//
//   node --env-file=.env.local --require ./scripts/security/server-only-stub.cjs --import tsx \
//     scripts/mock-interviews/practice-runs.mts --model gpt-6-luna --set full [--only 1,5] [--budget 450]
//
// --set baseline (4 runs) or full (20 runs). Module settings are read first and
// every changed column is put back exactly; the practice interviews are deleted
// once saved. Output: docs/interview-prep/r1.6/<model>.json

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { decryptSecret } from "../../lib/crypto.ts";

const args = new Map<string, string>();
for (let k = 2; k < process.argv.length; k += 2) args.set(process.argv[k].replace(/^--/, ""), process.argv[k + 1] ?? "");
const MODEL = args.get("model") ?? "";
const SET = args.get("set") ?? "baseline";
const ONLY = args.get("only")?.split(",").map(Number);
const BUDGET_PAISE = Number(args.get("budget") ?? 45_000); // ₹450 across everything spent so far
const CANDIDATE_MODEL = "gpt-6-luna";
const USD_INR = 93.42; // owner, November 18, 2026

// $ per million tokens from OpenAI's pricing page (November 18, 2026): input, cached input, output.
const PRICES_USD: Record<string, [number, number, number]> = {
  "gpt-4.1-mini": [0.4, 0.1, 1.6],
  "gpt-6-luna": [0.1, 0.01, 0.5],
  "gpt-6.1-terra": [1, 0.05, 5],
};
if (!PRICES_USD[MODEL]) throw new Error(`--model must be one of ${Object.keys(PRICES_USD).join(", ")}`);
const paise = (usd: number) => Math.round(usd * USD_INR * 100);

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) throw new Error("Local databases only.");
const db = new pg.Client({ connectionString: url });
await db.connect();

/* ---------------- scenarios ---------------- */

type Persona = "strong" | "average" | "weak";
interface Scenario {
  n: number;
  minutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  pack: keyof typeof PACKS;
  persona: Persona;
  note?: string;
}

const PACKS = {
  tpm: {
    role: "Technical Project Manager",
    industry: "Information technology",
    topics: ["Risk management", "Stakeholder management", "Estimation"],
    resume:
      "Technical project manager, 8 years. Led the migration of a payments platform to a new provider (8 engineers, 5 months, transaction costs down 18%, no downtime). Runs two distributed Scrum teams (Bengaluru and Berlin), owns the release calendar, reports to the head of engineering. Before that: business analyst at a retail bank, card platform requirements and UAT. PMP certified.",
    jd: "We're hiring a Technical Project Manager to run delivery for our payments products. You'll plan and track cross-team releases, manage dependencies and risks, keep stakeholders aligned, and work with engineering leads on estimates and scope. 6+ years of delivery experience in software, comfort with Agile and Scrum, and clear written communication.",
  },
  swe: {
    role: "Backend Software Engineer",
    industry: "E-commerce and retail",
    topics: ["APIs", "Databases", "Debugging"],
    resume:
      "Backend engineer, 5 years, Java and Go. Built the order service for an online grocery app (40k orders a day), moved it from a monolith to three services, cut p95 latency from 900 ms to 220 ms with caching and query fixes. On-call lead for 2 years. Postgres, Redis, Kafka, AWS.",
    jd: "Backend Software Engineer for our checkout team. Design and build reliable APIs, own services in production, improve performance, and take part in on-call. Strong in one of Go, Java or Kotlin; SQL databases; distributed systems basics; good debugging habits.",
  },
  analyst: {
    role: "Data Analyst",
    industry: "Banking and finance",
    topics: ["SQL", "Metrics", "Dashboards"],
    resume:
      "Data analyst, 3 years at a lending startup. Built the collections dashboard in Power BI used by 40 agents, wrote the SQL behind the weekly risk report, ran an A/B test on reminder messages that lifted on-time repayments by 6%. Python for cleaning data, some dbt.",
    jd: "Data Analyst for our retail banking team. Turn questions from product and risk teams into analyses, build and maintain dashboards, define metrics, and explain findings to non-technical people. Strong SQL, a BI tool, and basic statistics.",
  },
  pm: {
    role: "Product Manager",
    industry: "Information technology",
    topics: ["Prioritization", "Metrics", "User research"],
    resume:
      "Product manager, 4 years, B2B SaaS. Owned onboarding for an HR software product: redesigned the setup flow, cut time-to-first-payroll from 9 days to 3, and raised activation by 21%. Runs discovery interviews every week, writes PRDs, works with design and 6 engineers.",
    jd: "Product Manager for our small-business HR suite. Own a product area end to end: discovery, prioritization, roadmap, launch and measuring results. Work closely with design, engineering and sales. 3+ years of product experience in B2B software.",
  },
  csm: {
    role: "Customer Success Manager",
    industry: "Information technology",
    topics: ["Customer retention", "Difficult conversations", "Onboarding"],
    resume:
      "Customer success manager, 6 years. Manages 35 mid-market accounts worth ₹4 crore a year, gross retention 94%. Rebuilt the onboarding playbook, cutting time to first value from 30 to 12 days. Handled escalations for the top 10 accounts.",
    jd: "Customer Success Manager for mid-market accounts. Own onboarding, adoption and renewals for a book of customers, handle escalations, spot expansion opportunities and work with product on feedback. 4+ years in SaaS customer success.",
  },
};

const FULL: Scenario[] = [
  { n: 1, minutes: 15, difficulty: "Easy", category: "HR interview", pack: "csm", persona: "strong" },
  { n: 2, minutes: 15, difficulty: "Easy", category: "Behavioral interview", pack: "analyst", persona: "weak" },
  { n: 3, minutes: 15, difficulty: "Medium", category: "Technical interview", pack: "swe", persona: "average" },
  { n: 4, minutes: 15, difficulty: "Hard", category: "System design", pack: "swe", persona: "strong" },
  { n: 5, minutes: 30, difficulty: "Medium", category: "Project management", pack: "tpm", persona: "strong", note: "calibration: same setup as 6 and 7" },
  { n: 6, minutes: 30, difficulty: "Medium", category: "Project management", pack: "tpm", persona: "average", note: "calibration" },
  { n: 7, minutes: 30, difficulty: "Medium", category: "Project management", pack: "tpm", persona: "weak", note: "calibration" },
  { n: 8, minutes: 30, difficulty: "Easy", category: "Product management", pack: "pm", persona: "average" },
  { n: 9, minutes: 30, difficulty: "Hard", category: "Data analytics", pack: "analyst", persona: "strong" },
  { n: 10, minutes: 30, difficulty: "Medium", category: "Behavioral interview", pack: "csm", persona: "weak" },
  { n: 11, minutes: 45, difficulty: "Medium", category: "Technical interview", pack: "swe", persona: "average" },
  { n: 12, minutes: 45, difficulty: "Hard", category: "Managerial interview", pack: "tpm", persona: "strong" },
  { n: 13, minutes: 45, difficulty: "Easy", category: "HR interview", pack: "analyst", persona: "average" },
  { n: 14, minutes: 60, difficulty: "Medium", category: "Product management", pack: "pm", persona: "strong" },
  { n: 15, minutes: 60, difficulty: "Hard", category: "System design", pack: "swe", persona: "average" },
  { n: 16, minutes: 30, difficulty: "Medium", category: "Project management", pack: "tpm", persona: "average", note: "repeat of 6 (consistency)" },
  { n: 17, minutes: 30, difficulty: "Medium", category: "Project management", pack: "tpm", persona: "average", note: "repeat of 6 (consistency)" },
  { n: 18, minutes: 15, difficulty: "Medium", category: "Coding", pack: "swe", persona: "weak" },
  { n: 19, minutes: 45, difficulty: "Medium", category: "Leadership", pack: "tpm", persona: "weak" },
  { n: 20, minutes: 60, difficulty: "Easy", category: "Behavioral interview", pack: "csm", persona: "average" },
];
const BASELINE = FULL.filter((s) => [3, 5, 7, 11].includes(s.n));
const scenarios = (SET === "full" ? FULL : BASELINE).filter((s) => !ONLY || ONLY.includes(s.n));

const PERSONA: Record<Persona, string> = {
  strong:
    "You are a strong, well-prepared candidate. Answer the question asked, directly. Use one specific real example from your resume with the situation, what you did and a measurable result. 90 to 160 words. Sound natural and confident, not scripted.",
  average:
    "You are an average, somewhat underprepared candidate. Follow these habits in every answer: stay general rather than specific; mention at most one concrete detail; never give a measurable result or a number; when a question has two or more parts, answer only the first; keep to basic knowledge, without technical depth or trade-offs; 50 to 90 words in plain everyday wording, with an 'I think' or 'basically' now and then. Your answers should be clearly weaker than a polished candidate's.",
  weak:
    "You are a weak, unprepared candidate. Hard rules for every answer: at most 35 words; no examples, names or numbers from your resume; generic claims only; on technical or design questions say something shallow that misses the main point or is partly wrong; about one answer in three, say you're not sure or drift to another topic. When pushed for detail, stay vague. Example of the style: 'I just make sure the data is right and I check it, basically. I'm good with communication so people usually understand the reports.' Never break character.",
};

/* ---------------- the candidate (a second AI) ---------------- */

const { rows: [cfgRow] } = await db.query("select * from mock_interview_config where id='app'");
if (!cfgRow?.ai_key_ciphertext) throw new Error("Save the module key in Module settings first.");
if (cfgRow.ai_provider !== "openai") throw new Error("These runs expect the OpenAI provider in Module settings.");
const KEY = decryptSecret(cfgRow.ai_key_ciphertext);
let candidateCostPaise = 0;

async function candidateAnswer(persona: Persona, pack: (typeof PACKS)[keyof typeof PACKS], convo: { from: "ai" | "you"; text: string }[]): Promise<string> {
  const [pin, , pout] = PRICES_USD[CANDIDATE_MODEL];
  const system = `${PERSONA[persona]}\n\nYou're interviewing for: ${pack.role}.\nYour resume:\n${pack.resume}\n\nReply with your spoken answer only: no labels, no stage directions, no Markdown.`;
  const messages = [
    { role: "system", content: system },
    ...convo.map((m) => ({ role: m.from === "ai" ? "user" : "assistant", content: m.text })),
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: CANDIDATE_MODEL, max_completion_tokens: persona === "weak" ? 80 : 400, reasoning_effort: "none", messages }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`  candidate AI ${res.status}: ${(await res.text()).slice(0, 160)}`);
      continue;
    }
    const data = await res.json();
    candidateCostPaise += (Number(data.usage?.prompt_tokens ?? 0) * paise(pin) + Number(data.usage?.completion_tokens ?? 0) * paise(pout)) / 1e6;
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    if (text) return text;
  }
  return "Sorry, I'm not sure how to answer that one.";
}

/* ---------------- settings for this model, restored afterwards ---------------- */

const TEST_COLS = ["ai_state", "ai_model", "ai_input_cost_per_mtok_paise", "ai_cached_input_cost_per_mtok_paise", "ai_output_cost_per_mtok_paise", "updated_at"];
const [pin, pcached, pout] = PRICES_USD[MODEL];
await db.query(
  "update mock_interview_config set ai_state='open', ai_model=$1, ai_input_cost_per_mtok_paise=$2, ai_cached_input_cost_per_mtok_paise=$3, ai_output_cost_per_mtok_paise=$4 where id='app'",
  [MODEL, paise(pin), paise(pcached), paise(pout)],
);

const E = await import("../../lib/mock-interviews/engine.ts");
const C = await import("../../lib/mock-interviews/config.ts");

// A temporary practice user with no career profile, so every run gets only the
// scenario's own resume and job description (and ui-test's data is untouched).
// Deleted at the end, with its practice interviews.
const userId = "practice-r16";
await db.query(
  `insert into "user" (id, name, email, email_verified) values ($1, 'Practice Candidate', 'practice-r16@jobtiva.test', true) on conflict (id) do nothing`,
  [userId],
);

const outDir = path.join("docs", "interview-prep", "r1.6");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${MODEL}.json`);
const results: Record<string, unknown>[] = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : [];
const created: string[] = [];
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

async function spentSoFar(): Promise<number> {
  const { rows } = await db.query("select coalesce(sum(ai_cost_paise),0)::float s from ai_interviews where id = any($1)", [created]);
  return Number(rows[0].s) + candidateCostPaise;
}

try {
  for (const sc of scenarios) {
    if ((await spentSoFar()) > BUDGET_PAISE) {
      console.log(`Budget reached (₹${((await spentSoFar()) / 100).toFixed(2)}); stopping before run ${sc.n}.`);
      break;
    }
    const pack = PACKS[sc.pack];
    const settings = C.settingsSnapshot(await C.getModuleSettings(), sc.difficulty);
    const { rows: [b] } = await db.query(
      `insert into ai_interviews (user_id,status,role,industry,category,difficulty,duration_min,topics,resume_source,resume_label,resume_text,
         job_description_source,job_description,coverage,valid_until,settings)
       values ($1,'ready',$2,$3,$4,$5,$6,$7,'paste','Practice resume',$8,'paste',$9,'plan',now()+interval '1 day',$10) returning id`,
      [userId, pack.role, pack.industry, sc.category, sc.difficulty, sc.minutes, pack.topics, pack.resume, pack.jd, JSON.stringify(settings)],
    );
    const id: string = b.id;
    created.push(id);
    console.log(`Run ${sc.n}: ${sc.minutes} min ${sc.difficulty} ${sc.category}, ${pack.role}, ${sc.persona} candidate`);

    const t0 = Date.now();
    const start = await E.startInterview(userId, id);
    const planMs = Date.now() - t0;
    if (!start.ok) {
      console.log(`  start failed: ${start.error}`);
      results.push({ run: sc.n, model: MODEL, scenario: sc, error: start.error });
      continue;
    }
    const turnMs: number[] = [];
    for (let turn = 0; turn < 150; turn++) {
      const { rows: msgs } = await db.query("select sender, text from ai_interview_messages where interview_id=$1 order by seq", [id]);
      const { rows: [st] } = await db.query("select status from ai_interviews where id=$1", [id]);
      if (st.status !== "in_progress") break;
      const convo = msgs.map((m: { sender: string; text: string }) => ({ from: (m.sender === "ai" ? "ai" : "you") as "ai" | "you", text: m.text }));
      const answer = await candidateAnswer(sc.persona, pack, convo);
      // Realistic time on the clock: reading the question, thinking, then
      // speaking at about 130 words a minute.
      const seconds = Math.round(12 + words(answer) / 2.2);
      await db.query("update ai_interviews set active_seconds = active_seconds + $2, last_active_at = now() where id=$1", [id, seconds]);
      const t = Date.now();
      const r = await E.submitAnswer(userId, id, answer.slice(0, 4000));
      turnMs.push(Date.now() - t);
      if (!r.ok) {
        console.log(`  answer refused: ${r.error}`);
        break;
      }
      if (r.state.phase === "ended") break;
    }
    // The report is written right after the end; wait for it.
    let ev: Record<string, unknown> | undefined;
    const tEval = Date.now();
    for (let k = 0; k < 90 && !ev; k++) {
      ({ rows: [ev] } = await db.query("select * from interview_evaluations where ai_interview_id=$1", [id]));
      if (!ev) await new Promise((res) => setTimeout(res, 2000));
    }
    const { rows: [i] } = await db.query("select * from ai_interviews where id=$1", [id]);
    if (!i) {
      // Removed from outside (another tool working on the same database).
      console.log("  the practice interview disappeared mid-run; skipped");
      results.push({ run: sc.n, model: MODEL, scenario: sc, error: "interview removed mid-run" });
      continue;
    }
    const { rows: msgs } = await db.query("select sender, kind, question_no, text, clock_seconds from ai_interview_messages where interview_id=$1 order by seq", [id]);
    const { rows: events } = await db.query("select kind, detail, clock_seconds from ai_interview_events where interview_id=$1 order by created_at", [id]);
    const result = {
      run: sc.n,
      model: MODEL,
      scenario: { ...sc, role: pack.role },
      status: i.status,
      endReason: i.end_reason,
      planned: i.question_plan?.length ?? 0,
      questionsAsked: i.questions_asked,
      followUps: msgs.filter((m: { kind: string }) => m.kind === "follow_up").length,
      answers: msgs.filter((m: { sender: string }) => m.sender === "candidate").length,
      clockSeconds: i.active_seconds,
      tokensIn: i.tokens_in,
      tokensOut: i.tokens_out,
      costPaise: Math.round(i.ai_cost_paise * 100) / 100,
      planMs,
      turnMsAvg: turnMs.length ? Math.round(turnMs.reduce((a, b) => a + b, 0) / turnMs.length) : 0,
      turnMsMax: turnMs.length ? Math.max(...turnMs) : 0,
      reportWaitMs: Date.now() - tEval,
      report: ev
        ? {
            overall: ev.overall,
            scores: { communication: ev.communication, technical: ev.technical, confidence: ev.confidence, problemSolving: ev.problem_solving, relevance: ev.relevance },
            writing: ev.writing,
          }
        : null,
      plan: i.question_plan,
      transcript: msgs.map((m: { sender: string; kind: string; question_no: number | null; text: string; clock_seconds: number }) => ({
        from: m.sender,
        kind: m.kind,
        q: m.question_no,
        at: m.clock_seconds,
        text: m.text,
      })),
      errors: events.filter((e: { kind: string }) => e.kind.includes("error") || e.kind === "evaluation_failed"),
    };
    results.push(result);
    writeFileSync(outFile, JSON.stringify(results, null, 1));
    console.log(
      `  ${result.status} after ${result.questionsAsked}/${result.planned} questions, ${result.followUps} follow-ups, ${Math.round(result.clockSeconds / 60)} min on the clock; ` +
        `overall ${ev?.overall ?? "none"}; ₹${(result.costPaise / 100).toFixed(2)}; turn ~${result.turnMsAvg} ms`,
    );
  }
} finally {
  if (created.length) await db.query("delete from ai_interviews where id = any($1)", [created]);
  await db.query('delete from "user" where id = $1', [userId]);
  await db.query(`update mock_interview_config set ${TEST_COLS.map((c, k) => `${c} = $${k + 1}`).join(", ")} where id='app'`, TEST_COLS.map((c) => cfgRow[c]));
  const { rows: [now] } = await db.query("select * from mock_interview_config where id='app'");
  const same = TEST_COLS.every((c) => JSON.stringify(now[c]) === JSON.stringify(cfgRow[c]));
  console.log(`Candidate AI cost: ₹${(candidateCostPaise / 100).toFixed(2)}. Settings restored exactly: ${same}. Practice interviews removed: ${created.length}.`);
  await db.end();
}
