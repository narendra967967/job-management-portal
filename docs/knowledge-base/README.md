# Admin knowledge base

These files are the admin knowledge base. When the server starts, every `.md` file in
this folder (and its subfolders) is synced into the database, and the agent in admin →
Knowledge base answers from them. They're admin only and never shown to users.

**Keep them current.** When a change alters how something works, update the matching
article in the same commit. Each environment answers from the files it was deployed
with, so the docs and the code always match.

## Format

```markdown
---
title: Nobody can sign in because of reCAPTCHA
category: Runbooks
summary: One or two sentences. The agent leads with this.
keywords: captcha, login, locked out
status: published
---

The article, in Markdown.
```

- **category** must be one of: Leads and automation, Email forwarding, AI, Plans and
  billing, Users and support, Settings and data, Runbooks.
- **status** is optional. `draft` keeps the article out of answers.
- The file path is the article's id. Renaming a file replaces the article.
- This README and any file or folder starting with `_` are skipped.

## Rules

- **Never write secrets here:** no keys, passwords, tokens or connection strings.
  Anything in an article can end up in an answer.
- Facts come from the code, not memory. Write the way you'd explain it to a colleague,
  and follow the project's human-writing rules.
- After editing locally, use **Sync from repo** on the Articles tab, or restart the
  dev server.
