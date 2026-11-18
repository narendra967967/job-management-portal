# R1.6: interview quality and cost

November 18, 2026. Practice runs on the local test setup, comparing **gpt-6-luna** and **gpt-6.1-terra**, the two current OpenAI models you picked (gpt-4.1-mini and gpt-4.1 are marked deprecated on OpenAI's model pages).

## The short version

**Use gpt-6-luna.** It costs about a tenth of terra, answers twice as fast, and keeps strong, average and weak candidates further apart in its scores. Terra probes harder and writes sharper reports, but a 30-minute interview costs ₹14 instead of ₹1.40, and its slowest replies took up to 12 seconds, which feels broken in a live conversation.

On luna, AI cost is about **₹0.03 to ₹0.06 a minute**. Even a 60-minute interview stays under ₹5.

## How the runs worked

Each run was a full interview through the real interviewer, start to report. A second AI played the candidate from one of five resumes (technical project manager, backend engineer, data analyst, product manager, customer success manager), told to answer as a **strong**, **average** or **weak** candidate. Time passed at a realistic speaking pace, so wrap-ups and endings happened as they would for a real candidate.

Each model ran the same 20 interviews: every length (15, 30, 45, 60 minutes), every level, nine kinds of interview, and the same 30-minute setup three times to check consistency. Neither model got the career profile, so both had exactly the same input.

## Cost

AI cost is what the interviewer, the question plan and the report cost. The simulated candidate isn't included. Prices are OpenAI's (₹93.42 to the dollar), with its cheaper rate for repeated input counted.

| Length | gpt-6-luna average | gpt-6-luna worst | gpt-6.1-terra average | gpt-6.1-terra worst |
|---|---|---|---|---|
| 15 min | ₹0.50 | ₹0.71 | ₹4.62 | ₹6.78 |
| 30 min | ₹1.38 | ₹2.09 | ₹13.88 | ₹19.88 |
| 45 min | ₹2.76 | ₹3.68 | ₹28.44 | ₹37.55 |
| 60 min | ₹3.89 | ₹4.35 | ₹38.16 | ₹43.57 |
| Per minute | ₹0.03 to ₹0.06 | | ₹0.31 to ₹0.64 | |

Weak candidates cost the most. Their short answers leave time on the clock, so the interviewer asks more follow-ups to use the time booked.

## Scoring

| Candidate | gpt-6-luna average (range) | gpt-6.1-terra average (range) |
|---|---|---|
| Strong | 77 (72 to 82) | 63 (52 to 80) |
| Average | 54 (46 to 68) | 52 (42 to 62) |
| Weak | 48 (36 to 60) | 46 (38 to 54) |
| Same setup, three runs | 50, 50, 46 | 52, 42, 46 |

Luna gives a clear gap between a strong candidate and the rest, and the same interview scores within 4 points across three runs. Terra is stricter: twice it put a strong candidate in the low 50s, next to the average ones, after catching it stretching the truth under follow-up questions. That's arguably sharper interviewing. But a report that scores a well-prepared candidate like an average one is hard to learn from.

The weakness both share: average and weak candidates sit close together (54 against 48 on luna). Part of that is the simulator. Even told to be weak, the second AI gives sensible, generic answers rather than really bad ones. One weak run (15-minute Coding) scored 60 on luna, which is too high. Real candidates will show whether this needs more work.

## Speed

| | gpt-6-luna | gpt-6.1-terra |
|---|---|---|
| Reply after an answer (average) | 1.6 s | 3.0 s |
| Slowest reply seen | 3.9 s | 11.8 s |
| Writing the question plan (before question 1) | 9 s | 18 s |
| Report ready after the interview ends | 22 s | 28 s |

## What the interviews read like

Both models ask questions tied to the resume and the job, keep to one question at a time, and don't give feedback mid-interview. Terra's questions are a little more varied ("Tell me about a time you pushed back on a date") where luna leans on "How do you…" questions, and terra's report advice is more pointed ("Separate fact from scenario"). Luna's reports are still specific and useful ("You repeated the five-month, 18% result in many answers. Use it selectively").

Read these to judge for yourself (all in this folder):

- `transcripts-gpt-6-luna.md`, runs **5, 6 and 7**: the same 30-minute Project management interview with a strong, an average and a weak candidate.
- `transcripts-gpt-6.1-terra.md`, the same runs **5, 6 and 7**, to compare.
- Either file, run **14**: a 60-minute Product management interview, to see how a long one holds up.

## Fixed along the way

- **Interviews ended early.** A 15-minute interview finished at 8 minutes once its planned questions ran out. The interviewer now keeps going with deeper follow-ups until the time is up.
- **Scores were too generous.** An average candidate scored 90. The report now follows a fixed scoring scale (an average answer is a 5; short, vague answers can't score above 4), whatever the admin prompt says.
- **A weak candidate got no report.** The AI listed more than 8 answers to work on and the reply was rejected. The report now keeps the 8 most important.
- **Newer models need different settings.** gpt-5 and gpt-6 models take a different output limit and no temperature, and run with "thinking" off so replies stay quick. The app handles both kinds.
- **Cheaper repeated input.** The interviewer's instructions were reordered so each call starts the same way, letting OpenAI charge its lower cached rate. Module settings has a box for that price.

## Follow-up test: scoring each answer separately

To pull average and weak candidates further apart, the report was changed to rate every answer on its own and build the skill scores from those ratings. Six of the interviews were run again on gpt-6-luna to test it:

| Run | Candidate | Before | After |
|---|---|---|---|
| 1 | strong | 76 | 82 |
| 5 | strong | 76 | 78 |
| 6 | average | 50 | 60 |
| 2 | weak | 46 | 50 |
| 7 | weak | 50 | 50 |
| 18 | weak (Coding) | 60 | 60 |

It didn't help. Strong candidates rose a little, the average one rose 10 points and the weak ones barely moved, so the gap that mattered got smaller. Run 18 also showed why its 60 isn't a scoring fault: the "weak" practice candidate wrote correct SQL and sensible validation answers, ignoring its instructions on technical questions. The simulator can't produce answers bad enough to test the low end.

So the change was not kept. The scoring stays as it was, and the spread between average and weak candidates gets judged on real interviews. The tried change is saved as `per-answer-scoring.patch` in this folder in case it's wanted later.

## What's left for you

1. **Read the transcripts above** and decide whether the quality is good enough to launch.
2. **Pick the model.** If it's luna, enter these in Module settings → AI service: model `gpt-6-luna`, input **₹9.34**, cached input **₹0.93**, output **₹46.71** (per million tokens). Then press Test connection.
3. **Set the prices per minute** (Module settings → Pricing). On luna the AI cost is tiny, so the price is a business decision rather than a cost one. Today's ₹3, ₹4 and ₹5 a minute put a 30-minute Medium interview at ₹120, against about ₹1.40 of AI cost plus Razorpay's fee.
4. **Set the plan allowances** (the plan editor's "AI mock interviews included"). A 60-minute included interview costs you under ₹5 on luna.

Release 1 doesn't roll out until you're happy with the interview quality.

## Spend

About ₹470 in total: ₹36 on luna, ₹362 on terra, ₹61 for the simulated candidate, and about ₹10 on earlier test runs. That's slightly over the ₹450 stop I set: terra's batch checks its budget before each run, and its 60-minute runs cost about ₹40 each. I didn't run the four planned gpt-4.1-mini comparison runs because of that, and because gpt-4.1-mini is deprecated.

The raw results (`gpt-6-luna.json`, `gpt-6.1-terra.json`) stay on this machine and aren't committed. `scripts/mock-interviews/practice-report.mts` rebuilds `tables.md` and the transcripts from them.
