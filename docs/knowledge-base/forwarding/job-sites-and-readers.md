---
title: Which job sites are accepted, and adding a new one
category: Email forwarding
summary: Built-in readers handle LinkedIn, Naukri, TimesJobs, Glassdoor and TheLadders. A new site can be allowed in admin with Reader set to None, which works only through AI, or given a built-in reader built from a real alert email.
keywords: supported sites, allowed senders, reader, parser, add a job site, job site request, instahyre, reader none, signing domain
---

Alerts are only accepted from senders on the allowed list in admin. Each sender has a **signing domain**, the domain that must sign its emails, and a **Reader** that turns the email into jobs.

## Built-in readers

| Reader | For |
|---|---|
| LinkedIn job alerts | LinkedIn |
| Naukri job alerts | Naukri |
| TimesJobs job alerts | TimesJobs |
| Glassdoor job emails | Glassdoor |
| TheLadders job alerts | TheLadders |
| None (logged as unsupported) | Any site without a reader |

A built-in reader needs no AI and works for every user on every plan.

## Adding a site

There are two levels:

1. **Allow the sender with Reader set to None.** Alerts are accepted, and AI reads them, but only for users whose plan includes AI email reading and who have added their own AI key. Everyone else sees "No jobs found" with a link to their plan or their key.
2. **Build a reader.** This needs a real alert email from the site, saved from Gmail with "Download message". The reader is a parser file plus a registry entry, a database value and a label, so it's a code change and a deploy.

Users ask for sites with **Ask us to add it** in their Email log, which creates a support ticket in the Job site request category.

## In public copy

Job sites are only named as examples, like "sites like LinkedIn, Naukri and many more", never as a full list.
