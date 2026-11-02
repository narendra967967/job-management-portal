"use client";

// PHASE 1 ONLY: sample knowledge-base data kept in this browser's storage, so the
// screens can be reviewed end to end before the database exists. The answers are
// simple word matching, not AI. Phase 2 replaces this file with Server Actions;
// search for "PHASE 1" to find what to remove.

import { useSyncExternalStore } from "react";
import {
  kbHtmlToText,
  type KbArticle,
  type KbConversation,
  type KbMessage,
  type KbQuestion,
  type KbQuestionStatus,
} from "@/lib/kb-model";

const KEY = "jobtiva.mock.kb.v1";
const ME = "UI Admin";

interface KbState {
  articles: KbArticle[];
  conversations: KbConversation[];
  questions: KbQuestion[];
}

const daysAgo = (d: number, h = 10) => {
  const t = new Date(Date.UTC(2026, 10, 1, h));
  t.setUTCDate(t.getUTCDate() - d);
  return t.toISOString();
};

const article = (a: Omit<KbArticle, "versions" | "updatedBy"> & Partial<Pick<KbArticle, "versions">>): KbArticle => ({
  updatedBy: ME,
  versions: [],
  ...a,
});

const SAMPLE: KbState = {
  articles: [
    article({
      id: "a-lead-rules",
      title: "How automatic lead cleanup works",
      category: "Leads and automation",
      summary: "Once a day, rules close or discard leads that have gone quiet, and every move can be undone.",
      keywords: ["auto close", "stale", "cleanup", "rules", "discarded", "undo"],
      status: "published",
      updatedAt: daysAgo(1),
      contentHtml:
        "<p>Once a day the cron run moves leads that have gone quiet. Each user sets the rules in Settings → Follow-ups, under Automatic cleanup, and every rule is on by default.</p>" +
        "<ul><li><strong>Never touched:</strong> New, no activity for 30 days, closes as Job position closed.</li><li><strong>Shortlisted and forgotten:</strong> 45 days, closes as Job position closed.</li><li><strong>Applied, no outreach:</strong> 45 days, closes as No response.</li><li><strong>Follow-ups used up:</strong> no reply for 14 days, closes as No response.</li><li><strong>Low fit:</strong> score under 40, discarded after 7 quiet days.</li><li><strong>Strong fit:</strong> score 80 or more moves a New lead to Shortlisted.</li></ul>" +
        "<p>Top Choice jobs, jobs with a reminder or open to-do, Interview and Offer Received jobs, and jobs moved back by hand are never touched. Undoing a move stops that rule for the job for good.</p>",
      versions: [
        { id: "v1", savedAt: daysAgo(6), savedBy: ME, title: "How automatic lead cleanup works", contentHtml: "<p>First draft of the cleanup rules.</p>" },
      ],
    }),
    article({
      id: "a-recaptcha",
      title: "Nobody can sign in because of reCAPTCHA",
      category: "Runbooks",
      summary: "If an admin is still signed in, untick reCAPTCHA in Settings → Security. Otherwise use the server switch.",
      keywords: ["captcha", "login", "sign in", "locked out", "security check"],
      status: "published",
      updatedAt: daysAgo(7),
      contentHtml:
        "<p>reCAPTCHA fails closed, admin sign-in included, and there's no automatic bypass. Existing sessions keep working, so check for a signed-in admin first.</p>" +
        "<ol><li>If an admin is signed in: Settings → Security → Google reCAPTCHA, untick it and save.</li><li>Otherwise add <code>RECAPTCHA_FORCE_OFF=true</code> to the affected environment's env file and recreate that app container with <code>docker compose up -d --no-deps</code>. A plain restart doesn't reload env files.</li><li>Sign in, fix the keys, then remove the switch and recreate the container again.</li></ol>",
    }),
    article({
      id: "a-forwarding-trust",
      title: "Why a forwarded alert gets rejected",
      category: "Email forwarding",
      summary: "Alerts are accepted only from allowed senders, signed by the job site or sealed by Gmail.",
      keywords: ["rejected", "sender not allowed", "dkim", "arc", "hand forwarded", "email log"],
      status: "published",
      updatedAt: daysAgo(3),
      contentHtml:
        "<p>An alert is accepted when it comes from an allowed sender and is signed by that sender's domain, or by Gmail's forwarding seal when forwarding broke the original signature. Anything else is rejected, so nobody can fill a user's list by emailing their address.</p>" +
        "<p>A hand-forwarded alert is accepted when it comes from the user's own sign-in email and the original inside it is from an allowed sender. Users see the reason, and how to fix it, in Settings → Email log.</p>",
    }),
    article({
      id: "a-new-site",
      title: "Adding a new job site",
      category: "Email forwarding",
      summary: "Add the sender in admin, then build a reader from a real alert email so it works without AI.",
      keywords: ["parser", "reader", "allowed sender", "new site", "instahyre"],
      status: "published",
      updatedAt: daysAgo(9),
      contentHtml:
        "<p>Adding the sender with Reader set to None lets AI read its alerts, but only for users on a plan with AI email reading who have added their own key.</p>" +
        "<p>For everyone else the site needs a built-in reader: a parser file, a registry entry, a database enum value and a label, all built from a real alert email.</p>",
    }),
    article({
      id: "a-retention",
      title: "How long logs are kept",
      category: "Settings and data",
      summary: "Each log type has its own window in Settings → Data retention, applied by the daily cron run.",
      keywords: ["retention", "delete", "logs", "notifications", "days"],
      status: "published",
      updatedAt: daysAgo(2),
      contentHtml:
        "<p>Settings → Data retention sets how many days each kind of log is kept, and the daily cron run deletes anything older.</p>" +
        "<ul><li>Inbound email log: 30 days</li><li>Ingestion issues: 30 days</li><li>Processed-email ledger: at least 60 days, so re-sent alerts aren't read twice</li><li>Lead purge history: 365 days</li><li>Notifications: 90 days</li><li>Automatic move history: 365 days, except moves a user undid</li></ul>",
    }),
    article({
      id: "a-tickets",
      title: "Handling support tickets",
      category: "Users and support",
      summary: "Users write in from the help widget; replies show up live in their chat.",
      keywords: ["ticket", "support", "reply", "job site request", "resolve"],
      status: "draft",
      updatedAt: daysAgo(0, 8),
      contentHtml:
        "<p>Tickets arrive from the help widget, Settings → Help &amp; support, and buttons that open a prefilled request, such as Ask us to add it in the Email log.</p>" +
        "<p>Replies appear in the user's chat right away. Resolving a ticket emails them the whole conversation.</p>",
    }),
  ],
  conversations: [
    {
      id: "c-1",
      title: "Why was a lead closed on its own?",
      createdAt: daysAgo(1, 9),
      updatedAt: daysAgo(1, 9),
      messages: [
        { id: "m-1", role: "user", text: "Why was a lead closed on its own?", at: daysAgo(1, 9) },
        {
          id: "m-2",
          role: "assistant",
          text: "Once a day, rules close or discard leads that have gone quiet. A New lead with no activity for 30 days closes as Job position closed, and the card says why and has an Undo button.",
          at: daysAgo(1, 9),
          sources: [{ id: "a-lead-rules", title: "How automatic lead cleanup works" }],
        },
      ],
    },
    {
      id: "c-2",
      title: "How do I refund a yearly plan?",
      createdAt: daysAgo(4, 15),
      updatedAt: daysAgo(4, 15),
      messages: [
        { id: "m-3", role: "user", text: "How do I refund a yearly plan?", at: daysAgo(4, 15) },
        {
          id: "m-4",
          role: "assistant",
          text: "I couldn't find this in the knowledge base, so I won't guess. I've added it to Unanswered so an article can be written.",
          at: daysAgo(4, 15),
          unanswered: true,
        },
      ],
    },
  ],
  questions: [
    { id: "q-1", question: "How do I refund a yearly plan?", firstAskedAt: daysAgo(4, 15), lastAskedAt: daysAgo(4, 15), timesAsked: 1, status: "open" },
    { id: "q-2", question: "Can a user change their sign-in email?", firstAskedAt: daysAgo(8), lastAskedAt: daysAgo(2), timesAsked: 3, status: "open" },
    { id: "q-3", question: "What happens when a plan expires?", firstAskedAt: daysAgo(12), lastAskedAt: daysAgo(12), timesAsked: 1, status: "dismissed" },
  ],
};

/* ---------------- store ---------------- */

let state: KbState = SAMPLE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...SAMPLE, ...JSON.parse(raw) };
  } catch {
    // Unreadable or blocked storage: keep the sample.
  }
}

function commit(next: KbState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode etc.: changes last until reload.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => SAMPLE;

export function useKb(): KbState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const id = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

/* ---------------- articles ---------------- */

export type KbArticleInput = Pick<KbArticle, "title" | "category" | "summary" | "keywords" | "status" | "contentHtml">;

/** A published article titled like an open question covers it. Drafts don't count. */
function coverQuestions(input: KbArticleInput): KbQuestion[] {
  if (input.status !== "published") return state.questions;
  const norm = input.title.trim().toLowerCase();
  return state.questions.map((q) =>
    q.status === "open" && q.question.trim().toLowerCase() === norm ? { ...q, status: "covered" } : q,
  );
}

export function saveArticle(articleId: string | null, input: KbArticleInput): string {
  if (!articleId) {
    const created: KbArticle = { ...input, id: id("a"), updatedAt: now(), updatedBy: ME, versions: [] };
    commit({ ...state, articles: [created, ...state.articles], questions: coverQuestions(input) });
    return created.id;
  }
  commit({
    ...state,
    questions: coverQuestions(input),
    articles: state.articles.map((a) =>
      a.id !== articleId
        ? a
        : {
            ...a,
            ...input,
            updatedAt: now(),
            updatedBy: ME,
            // The version being replaced goes into history.
            versions: [
              { id: id("v"), savedAt: a.updatedAt, savedBy: a.updatedBy, title: a.title, contentHtml: a.contentHtml },
              ...a.versions,
            ].slice(0, 20),
          },
    ),
  });
  return articleId;
}

export function setArticleStatus(articleId: string, status: KbArticle["status"]) {
  commit({ ...state, articles: state.articles.map((a) => (a.id === articleId ? { ...a, status, updatedAt: now() } : a)) });
}

export function deleteArticle(articleId: string) {
  commit({ ...state, articles: state.articles.filter((a) => a.id !== articleId) });
}

/* ---------------- questions ---------------- */

export function setQuestionStatus(questionId: string, status: KbQuestionStatus) {
  commit({ ...state, questions: state.questions.map((q) => (q.id === questionId ? { ...q, status } : q)) });
}

function logUnanswered(question: string, at: string): KbQuestion[] {
  const norm = question.trim().toLowerCase();
  const existing = state.questions.find((q) => q.question.trim().toLowerCase() === norm);
  if (existing) {
    return state.questions.map((q) =>
      q.id === existing.id ? { ...q, timesAsked: q.timesAsked + 1, lastAskedAt: at, status: "open" } : q,
    );
  }
  return [{ id: id("q"), question: question.trim(), firstAskedAt: at, lastAskedAt: at, timesAsked: 1, status: "open" }, ...state.questions];
}

/* ---------------- asking ---------------- */

const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in is it its me my of on or so that the this to was what when where which who why will with you your".split(" "),
);
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];

/** Sample answer: the best-matching published articles, by shared words. */
function sampleAnswer(question: string): Pick<KbMessage, "text" | "sources" | "unanswered"> {
  const q = words(question);
  const scored = state.articles
    .filter((a) => a.status === "published")
    .map((a) => {
      const title = words(a.title);
      const keys = words(a.keywords.join(" "));
      const body = words(`${a.summary} ${kbHtmlToText(a.contentHtml)}`);
      const score = q.reduce(
        (n, w) => n + (title.includes(w) ? 3 : 0) + (keys.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0),
        0,
      );
      return { a, score };
    })
    .filter((s) => s.score >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, 2);
  if (!scored.length) {
    return {
      text: "I couldn't find this in the knowledge base, so I won't guess. I've added it to Unanswered so an article can be written.",
      unanswered: true,
    };
  }
  const best = scored[0].a;
  return {
    text: `${best.summary} ${kbHtmlToText(best.contentHtml).split(/(?<=\.)\s/).slice(0, 2).join(" ")}`,
    sources: scored.map(({ a }) => ({ id: a.id, title: a.title })),
  };
}

/** Ask a question; returns the conversation it went into. */
export async function ask(conversationId: string | null, question: string): Promise<string> {
  const at = now();
  const userMsg: KbMessage = { id: id("m"), role: "user", text: question.trim(), at };
  let convoId = conversationId;
  if (!convoId || !state.conversations.some((c) => c.id === convoId)) {
    convoId = id("c");
    const title = question.trim().length > 70 ? `${question.trim().slice(0, 67)}…` : question.trim();
    commit({ ...state, conversations: [{ id: convoId, title, createdAt: at, updatedAt: at, messages: [userMsg] }, ...state.conversations] });
  } else {
    commit({
      ...state,
      conversations: state.conversations.map((c) => (c.id === convoId ? { ...c, updatedAt: at, messages: [...c.messages, userMsg] } : c)),
    });
  }
  // Feels like a real round trip.
  await new Promise((r) => setTimeout(r, 900));
  const answer = sampleAnswer(question);
  const reply: KbMessage = { id: id("m"), role: "assistant", at: now(), ...answer };
  commit({
    ...state,
    conversations: state.conversations.map((c) =>
      c.id === convoId ? { ...c, updatedAt: reply.at, messages: [...c.messages, reply] } : c,
    ),
    questions: answer.unanswered ? logUnanswered(question, reply.at) : state.questions,
  });
  return convoId;
}

export function deleteConversation(conversationId: string) {
  commit({ ...state, conversations: state.conversations.filter((c) => c.id !== conversationId) });
}

/** Back to the sample data. */
export function resetSample() {
  commit(SAMPLE);
}
