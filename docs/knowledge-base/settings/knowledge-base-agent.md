---
title: How the knowledge base agent answers
category: Settings and data
summary: The Ask tab finds the articles and How-to guides that match a question and has AI answer from them alone, on the admin key in Settings → AI. When nothing covers it, the agent says so and adds the question to Unanswered.
keywords: ask, agent, chatbot, assistant, wrong answer, ai answer, unanswered, sources, admin key, knowledge base
---

The agent only knows what's written down. Each question is matched against published articles and live How-to guides, up to four of them go to AI with the question, and AI has to answer from those alone. It can't see users, leads or any other live data, and it won't fall back on general knowledge.

It runs on the admin provider, model and key in **Settings → AI**. If the model field is blank, the provider's default is used, which for OpenRouter is a small, cheap model. Small models sometimes blur a condition, such as when something applies only in one case. If answers come out subtly wrong, try a stronger model there before rewriting the article.

## What you'll see

| Situation | What the agent does |
|---|---|
| The articles answer it | Answers, with the articles it used listed under **Sources** |
| They answer part of it | Answers that part, says what's missing, and adds the question to **Unanswered** marked Partly answered |
| Nothing covers it | Says so and adds the question to **Unanswered**. Asking again counts up instead of adding a duplicate |
| No admin key, a rejected key, no credit, or another AI failure | Says which, and shows the closest article's summary. If no article is a close enough match to show without AI, it links the nearest ones instead. Nothing goes to Unanswered, since the articles may well answer it |

Both kinds come with a **Write an article for this** link, which starts a new article titled with the question.

Follow-up questions work. The agent sees the last four messages of the conversation, so "and how long does that take?" is read with the question before it. A new topic is better in **New chat**.

## Fixing an answer

A wrong answer nearly always means the article is wrong, thin or missing. Repo articles live in `docs/knowledge-base/` and change with the code, then arrive on the next deploy or through **Sync from repo** on the Articles tab. Anything else can be written with **New article**. Publishing one titled like an open Unanswered question marks it covered.

Never put keys, passwords or tokens in an article. The agent is told not to repeat them, but anything in an article can end up in an answer.

## Limits and usage

Each admin can ask 30 questions an hour and 150 a day. It's there so a stuck tab or a stolen session can't run up the AI bill, and the message says when asking opens up again. Deleting conversations doesn't reset it.

The **History** tab opens with this month's numbers across all admins, counted from saved conversations: questions asked, and how many were answered, partly answered, not found, or answered without AI. That last one counts the fallbacks, and if it climbs, check the key and credit in **Settings → AI**.

Conversations are kept for 60 days by default, set in **Settings → Data retention**.
