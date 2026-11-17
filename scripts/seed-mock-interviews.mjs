// Local test data for the Mock interviews screens (roadmap R1.4): a few AI
// interviews for the LOCAL_TEST_EMAIL account (ui-test) so History,
// Performance, the report and the bookings list have something to show before
// the real interviewer exists (R1.5). Local databases only.
//
//   node --env-file=.env.local scripts/seed-mock-interviews.mjs           # adds, if ui-test has none
//   node --env-file=.env.local scripts/seed-mock-interviews.mjs --replace # deletes ui-test's AI interviews first
//
// It doesn't touch Module settings: switch AI interviews to Open in admin
// (Mock interviews → Module settings) to see the candidate screens locally.

import pg from "pg";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error("Refusing: DATABASE_URL isn't a local database.");
  process.exit(1);
}
const email = process.env.LOCAL_TEST_EMAIL;
if (!email) {
  console.error("Set LOCAL_TEST_EMAIL in .env.local.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: url });
await db.connect();

const { rows: users } = await db.query("select id from \"user\" where email = $1", [email]);
if (!users[0]) {
  console.error(`No user ${email}.`);
  process.exit(1);
}
const userId = users[0].id;

const { rows: existing } = await db.query("select count(*)::int as n from ai_interviews where user_id = $1", [userId]);
if (existing[0].n > 0 && !process.argv.includes("--replace")) {
  console.log(`${email} already has ${existing[0].n} AI interviews. Run with --replace to start over.`);
  await db.end();
  process.exit(0);
}
if (process.argv.includes("--replace")) {
  await db.query("delete from ai_interviews where user_id = $1", [userId]);
}

const DAY = 86_400_000;
const now = Date.now();
const weights = { communication: 20, technical: 20, confidence: 20, problemSolving: 20, relevance: 20 };
const settings = (difficulty) => ({
  minutesPerQuestion: 2,
  wrapUpMinutes: 10,
  resumeWindowMinutes: 15,
  paceGraceMinutes: 5,
  bookingValidDays: 30,
  pricing: { Easy: { ratePerMinutePaise: 300, discountOn: false, discountPercent: 0 }, Medium: { ratePerMinutePaise: 400, discountOn: false, discountPercent: 0 }, Hard: { ratePerMinutePaise: 500, discountOn: false, discountPercent: 0 } }[difficulty],
  weights,
});
const resume =
  "Project manager with eight years in payments and e-commerce. Led a five-month migration of the payments service to a new provider with a team of eight engineers, cutting transaction costs by 18% with no downtime. Runs Scrum for two distributed teams, owns the release calendar and reports to the head of engineering. Earlier: business analyst at a retail bank, writing requirements for the card platform and running user acceptance testing.";
const writing = {
  strengths: [
    { headline: "Clear answer structure", detail: "Clear structure in most answers: you set the context, said what you did and finished with the result." },
    { headline: "Real numbers", detail: "Good use of real numbers when describing the payments migration (team size, timeline, cost saved)." },
    { headline: "Calm under pressure", detail: "You stayed calm on the conflict question and owned your part of the problem." },
  ],
  improvements: [
    { headline: "Make risk stories specific", detail: "Risk management answers stayed general. Name a real risk, how you spotted it and what you changed." },
    { headline: "Get to the point sooner", detail: "Several answers ran past two minutes before reaching the point. Lead with the outcome, then explain." },
  ],
  missed: [
    {
      question: "How do you decide when to escalate a delayed dependency?",
      headline: "No escalation trigger",
      note: "You described the follow-ups but not the trigger: what date or signal makes you escalate, and to whom.",
    },
  ],
  betterAnswers: [
    {
      question: "How do you decide when to escalate a delayed dependency?",
      answer:
        "Set the escalation point when the dependency is agreed, for example two working days of slip on a critical-path item. When it's hit, raise it with the other team's lead first with the impact in dates, then with your sponsor if there's no plan within a day.",
    },
  ],
  nextSteps: [
    { headline: "Two risk stories", detail: "Prepare two risk stories with a clear trigger, action and result." },
    { headline: "Answers under 90 seconds", detail: "Practice answering in under 90 seconds: outcome first." },
  ],
};
const chat = [
  ["ai", "question", 1, 5, "Thanks for joining. Let's start with an overview: tell me about a project you led from start to finish, and what it delivered."],
  ["candidate", "answer", null, 78, "I led the migration of our payments service to a new provider. Eight engineers, five months. We cut transaction costs by about 18% and had no downtime during the switch."],
  ["ai", "follow_up", null, 84, "What was the biggest risk in that migration, and how did you handle it?"],
  ["candidate", "answer", null, 161, "Double charging during the cutover. We ran both providers in parallel for two weeks with a reconciliation job and a kill switch."],
  ["ai", "question", 2, 168, "Good. Next one: how do you decide when to escalate a delayed dependency from another team?"],
  ["candidate", "answer", null, 240, "I follow up with the other team's lead, and if it keeps slipping I raise it in our weekly sync with the sponsor."],
];

// [daysAgo, role, category, industry, difficulty, minutes, status, coverage, scores?]
const plan = [
  [40, "Project Manager", "Behavioral interview", "E-commerce and retail", "Easy", 15, "completed", "free", [5, 4, 4, 5, 5]],
  [33, "Project Manager", "Project management", "E-commerce and retail", "Medium", 30, "completed", "plan", [5, 5, 4, 5, 5]],
  [26, "Technical Project Manager", "System design", "Information technology", "Hard", 45, "completed", "plan", [6, 5, 5, 6, 6]],
  [18, "Scrum Master", "Behavioral interview", "Banking and finance", "Easy", 15, "stopped", "plan", [6, 6, 5, 6, 6]],
  [9, "Delivery Manager", "Leadership", "Consulting", "Hard", 45, "completed", "plan", [7, 6, 7, 6, 7]],
  [3, "Technical Project Manager", "Behavioral interview", "Information technology", "Medium", 30, "completed", "plan", [8, 7, 7, 7, 8]],
  [2, "Technical Project Manager", "Project management", "Information technology", "Medium", 30, "failed", "plan", null],
  [0, "Technical Project Manager", "Project management", "Information technology", "Medium", 30, "interrupted", "plan", null],
  [1, "Delivery Manager", "Leadership", "Consulting", "Medium", 45, "ready", "plan", null],
  [27, "Scrum Master", "Behavioral interview", "Banking and finance", "Easy", 15, "ready", "plan", null], // expires in 3 days
  [45, "Product Owner", "Product management", "E-commerce and retail", "Medium", 30, "ready", "plan", null], // already expired
];

const { rows: planRows } = await db.query("select p.name, u.plan_expires_at from \"user\" u left join plans p on p.id::text = u.plan_id where u.id = $1", [userId]);
const planName = planRows[0]?.name ?? "Premium";

let made = 0;
for (const [daysAgo, role, category, industry, difficulty, minutes, status, coverage, s] of plan) {
  const booked = new Date(now - daysAgo * DAY - 3_600_000);
  const started = ["ready"].includes(status) ? null : new Date(booked.getTime() + 20 * 60_000);
  const ended = ["completed", "stopped", "failed"].includes(status) ? new Date(started.getTime() + (minutes + 2) * 60_000) : null;
  const questions = status === "completed" ? Math.floor(minutes / 2) : status === "stopped" ? 4 : 2;
  const tokensIn = Math.round((9000 + minutes * 900) * (status === "completed" ? 1 : 0.4));
  const tokensOut = Math.round((1800 + minutes * 160) * (status === "completed" ? 1 : 0.4));
  const { rows } = await db.query(
    `insert into ai_interviews (user_id, status, role, industry, category, difficulty, duration_min, topics,
       resume_source, resume_label, resume_text, job_description_source, job_description, coverage, plan_name,
       valid_until, settings, question_plan, questions_asked, active_seconds, started_at, interrupted_at, ended_at, end_reason,
       ai_provider, ai_model, tokens_in, tokens_out, ai_cost_paise, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'paste','Pasted resume',$9,'none','',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
       'openai','gpt-4o-mini',$21,$22,$23,$24) returning id`,
    [
      userId, status, role, industry, category, difficulty, minutes, ["Risk management", "Stakeholder management"],
      resume, coverage, coverage === "plan" ? planName : null,
      new Date(booked.getTime() + 30 * DAY), JSON.stringify(settings(difficulty)),
      started ? JSON.stringify([
        { no: 1, question: "Tell me about a project you led from start to finish.", topic: "Stakeholder management", tip: "Lead with the outcome, then explain how you got there." },
        { no: 2, question: "How do you decide when to escalate a delayed dependency?", topic: "Risk management", tip: "Name the trigger: what date or signal made you act, and who you told." },
      ]) : null,
      started ? questions : 0, started ? (status === "interrupted" ? 230 : Math.min(minutes * 60, 4 * 60 + questions * 110)) : 0,
      started, status === "interrupted" ? new Date(now - 4 * 60_000) : null, ended,
      status === "completed" ? "time_up" : status === "stopped" ? "not_resumed" : status === "failed" ? "ai_error" : null,
      started ? tokensIn : 0, started ? tokensOut : 0, started ? Math.round(tokensIn * 0.012 + tokensOut * 0.048) : 0, booked,
    ],
  );
  const id = rows[0].id;
  if (started) {
    let seq = 0;
    for (const [sender, kind, qno, at, text] of chat) {
      await db.query(
        "insert into ai_interview_messages (interview_id, seq, sender, kind, question_no, text, clock_seconds, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [id, ++seq, sender, kind, qno, text, at, new Date(started.getTime() + at * 1000)],
      );
    }
    const events = [["start", `Started: ${category}, ${difficulty}, ${minutes} min`, 0], ["question", "Question 1 asked", 5], ["answer", "Answer received", 78]];
    if (status === "failed") events.push(["error", "AI service didn't respond (timeout), retried", 250], ["error", "AI service didn't respond (timeout); interview stopped", 280]);
    if (status === "interrupted") events.push(["disconnect", "Connection lost; clock paused", 230]);
    if (status === "stopped") events.push(["disconnect", "Connection lost; clock paused", 400], ["end", "Not resumed within 15 minutes; closed with the answers so far", 400], ["evaluation", "Report generated", 400]);
    if (status === "completed") events.push(["wrapup", "Time up; wrap-up started", minutes * 60], ["end", `Interview ended after ${questions} questions`, minutes * 60 + 90], ["evaluation", "Report generated", minutes * 60 + 110]);
    for (const [kind, detail, at] of events) {
      await db.query("insert into ai_interview_events (interview_id, kind, detail, clock_seconds, created_at) values ($1,$2,$3,$4,$5)", [
        id, kind, detail, at, new Date(started.getTime() + at * 1000),
      ]);
    }
  }
  if (s && ended) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    const overall = Math.round(((s[0] + s[1] + s[2] + s[3] + s[4]) * 20 / total) * 10);
    await db.query(
      `insert into interview_evaluations (user_id, source, ai_interview_id, status, communication, technical, confidence, problem_solving, relevance,
         weights, overall, writing, submitted_at)
       values ($1,'ai',$2,'submitted',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [userId, id, ...s, JSON.stringify(weights), overall, JSON.stringify(writing), new Date(ended.getTime() + 60_000)],
    );
  }
  made++;
}

console.log(`Added ${made} AI interviews for ${email}.`);
await db.end();
