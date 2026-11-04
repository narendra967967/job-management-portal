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
| They answer part of it | Answers that part and says what's missing |
| Nothing covers it | Says so and adds the question to **Unanswered**. Asking again counts up instead of adding a duplicate |
| No admin key saved | Shows the closest article's summary, with a note that AI isn't set up |
| The provider rejects the key or is out of credit | Shows the closest article's summary, with a note naming which |
| The AI provider fails another way | Shows the closest article's summary, with a note that AI couldn't answer |

Partly answered questions don't go to Unanswered, so it's worth reading the last line of a short answer.

Follow-up questions work. The agent sees the last four messages of the conversation, so "and how long does that take?" is read with the question before it. A new topic is better in **New chat**.

## Fixing an answer

A wrong answer nearly always means the article is wrong, thin or missing. Repo articles live in `docs/knowledge-base/` and change with the code, then arrive on the next deploy or through **Sync from repo** on the Articles tab. Anything else can be written with **New article**. Publishing one titled like an open Unanswered question marks it covered.

Never put keys, passwords or tokens in an article. The agent is told not to repeat them, but anything in an article can end up in an answer.

Conversations are kept for 60 days by default, set in **Settings → Data retention**.
