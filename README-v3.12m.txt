ICS v3.12m — Duplicate Gate Recalibration

Root cause of the '38 same-issue duplicate pairs'
-------------------------------------------------
The same-issue similarity checker included each candidate's `why_now` field.
Many fallback candidates contain the same planner metadata phrase, e.g.
'Deterministic saved-signal fallback used so a duplicate cannot stop the 15-candidate plan.'
The checker therefore measured shared planner boilerplate rather than shared editorial topics.

Fix
---
- Same-issue similarity now compares only title + question + problem.
- Generic geography/publication words are removed from similarity tokens.
- Hard duplicate at Step 2 now means:
  * same source Lead, or
  * effectively identical title/question.
- Fuzzy topic overlap is advisory only for the 15-candidate pool.
- Step 5 is where the final 8–10 should avoid selecting overlapping candidates.
- Lock blocker messages now stay in the persistent top panel rather than browser alerts.
- Compact 15-title Copy/Download review remains available.

No research/writer/component logic changed.
