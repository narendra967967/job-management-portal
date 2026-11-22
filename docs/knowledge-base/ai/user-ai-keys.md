---
title: How users connect their own AI key
category: AI
summary: Every AI feature runs on the user's own key from OpenAI, Claude (Anthropic) or OpenRouter, added in Settings → AI provider. The key is encrypted, only its last 4 characters are ever shown, and Test key checks it works.
keywords: ai key, api key, openai, anthropic, claude, openrouter, test key, model, ai provider, no key, gpt-5, gpt-6, newer model, model not accepted
---

Users bring their own AI key. They add it in **Settings → AI provider**: pick a provider, optionally a model, paste the key and save.

| Provider | Default model |
|---|---|
| OpenAI | gpt-4o-mini |
| Claude (Anthropic) | claude-sonnet-5 |
| OpenRouter | openai/gpt-4o-mini |

Leaving the model blank uses the default. Any model the provider offers can go in the Model box, including OpenAI's newer ones (the gpt-5 and gpt-6 families and the o-series). Those take their settings differently, and the app sends them the way each model expects, with the least "thinking" it allows so answers stay quick and cheap.

If **Test key** says *"Your provider didn't accept this model"*, the name is usually mistyped, or the user's provider account doesn't have access to that model yet. Clearing the Model box falls back to the default, which works on every account.

## How the key is kept

The key is encrypted before it's stored and never sent back to the browser. Only its last 4 characters are shown, so the user can tell which key is saved. AI calls are made from our server with their key, and the cost goes on their account with the provider.

**Test key** sends a tiny request and says whether the provider accepted it. That's the first thing to try when an AI feature fails.

## Without a key

AI features say to add a key, with a link to Settings → AI provider. Forwarded alerts from sites without a built-in reader show "No jobs found" with an Add your AI key link. Nothing AI-related runs on our money.

## Admin's own key

admin Settings → AI has a separate admin provider, model and key. Only admin-side AI uses it, such as the knowledge base agent. It's never used for users' features.
