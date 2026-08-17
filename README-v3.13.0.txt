ICS v3.13.0 — STEP 2 STABILISATION

Purpose
-------
This is a consolidated Step 2 fix, not a bypass.

STEP 2 CONTRACT
---------------
Step 2 answers one question:
"Are these 15 sensible, distinct candidates for this publication?"

Hard blockers only:
1. Wrong publication / wrong geography.
2. True same-issue duplicate.
3. Broken candidate (missing title/question or wrong count).
4. Explicit source mismatch.
5. Weak REFRESH with no material change.
6. Confirmed recent-history duplicate.
7. Genuine freshness failure.

Advisory only at Step 2:
- 15 Masters versus final 8–10.
- projected final section count.
- food/reader-voice/mood concentration.
- commercial spread.
- discovery/fun balance.
Those are resolved after Step 5 selects the final Masters.

FIXES INCLUDED
--------------
- Publication guard is now family-aware:
  * Spotlight geography is compared only with other Spotlight geographies.
  * Taste Trail / Business Pulse / Pet Insider names cannot contaminate Spotlight.
  * Cambridge is treated as related geography to Cambridgeshire, not a foreign publication.
  * Hidden planner metadata is not scanned as editorial geography.
- Existing manually edited candidates with stale source leads are automatically reconciled.
  If an edited CREATE NEW concept no longer aligns with its old lead, the old lead is detached
  and fresh research is required.
- Manual Edit keeps the Life Lane field.
- Replace retries a malformed JSON/model response once instead of exposing a raw parser error.
- Replacement failures report in the persistent Step 2 status area.
- Lock blockers name the exact article(s) and reason.
- Step 2 never tells the operator to reset the whole candidate slate for a local guard failure.
- Copy Audit is now a Step 2 candidate check, not the obsolete final-issue 33-section audit.
- Existing saved CBS slate is preserved. Do not reset it.

CURRENT CBS TEST
----------------
After deploy:
1. Open the existing Cambridgeshire Spotlight issue.
2. Go to Step 2.
3. Click Lock Approved Plan once.
4. Expected: Article 14 stale Lead 13 is auto-repaired if still present; Cambridge/Cambridgeshire
   is not treated as contamination.
5. If any genuine blocker remains, the top panel must name the exact article(s) and reason.

If this passes, freeze Step 2 and move to Step 3 Research.
