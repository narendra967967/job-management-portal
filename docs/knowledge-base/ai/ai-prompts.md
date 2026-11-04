---
title: How AI prompts are chosen: user, admin default or built-in
category: AI
summary: For summaries, outreach drafts and fit scores, the user's own prompt is used if their plan allows custom prompts. Otherwise the admin default from admin Settings → AI is used, and if that's empty, the built-in prompt.
keywords: prompts, custom prompt, default prompt, ai prompts, instructions, summarize prompt, draft prompt, fit score prompt
---

Three AI features use a prompt that can be changed: **summarizing a job description**, **drafting outreach** and the **fit score**. For each one, the prompt is chosen in this order:

1. **The user's own prompt**, from Settings → AI prompts, but only if their plan has custom prompts switched on. If their plan loses the switch, their saved prompt is ignored, not deleted.
2. **The admin default**, set in admin Settings → AI. Admins write these to improve results for everyone without users doing anything.
3. **The built-in prompt** in the code, when neither exists.

Users without custom prompts on their plan can't save their own. They still benefit from the admin defaults.

The other AI features, such as reading alerts, structuring contacts, Add with AI, salary insight and the ATS check, use fixed prompts in the code.
