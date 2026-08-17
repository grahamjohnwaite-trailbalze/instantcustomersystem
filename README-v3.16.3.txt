ICS v3.16.3 — RESUME INCOMPLETE REPAIRS

What the screenshot exposed
---------------------------
Articles 4, 5, 9, 10, 11 and 12 now show NOT PRODUCED.

That is because the previous repair correctly cleared their contaminated old article/research state,
but the clean replacement did not complete. v3.16.2's Repair button only targeted records that still
contained detectable foreign geography, so once the bad copy had been cleared those six could fall
out of the repair queue.

Fix
---
- Repair Produced Masters now targets BOTH:
  1. current geography-contaminated Masters, and
  2. Masters marked by the integrity reset/canonical repair that are still not complete.
- Those second records show REPAIR PENDING in Step 5.
- The repair again starts from the canonical clean brief, fresh-researches, checks the new Research Pack,
  then writes and checks the produced article.
- Completed clean Masters are not touched.
- The 18/18 persistent support components are preserved.

Current CBS action
------------------
Deploy v3.16.3, open Step 5 and click Repair Produced Masters.
The six NOT PRODUCED records should now be picked up as REPAIR PENDING and resumed.
