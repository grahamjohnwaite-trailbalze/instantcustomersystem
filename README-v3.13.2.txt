ICS v3.13.2 — STEP 3 RESEARCH STATUS

What was wrong
--------------
The research batch itself worked: the Content Library showed 15 researched and 11 verified.
But after completion, the persistent top status was overwritten by the generic Step 3
instruction text. "Copy Status" therefore copied stale guidance instead of the actual
research result.

Fix
---
- Step 3 completion status is now written AFTER the workflow shell refresh, so it persists.
- The top status reports:
    X/15 researched · Y/15 verified
- Any researched-but-unverified Masters are named by article number/title and current
  Evidence Status.
- Completed Research Packs remain preserved.
- The operator is told to resolve only named exceptions.
- Once the 15 Master briefs are prepared, the top primary action becomes "Research All 15 Masters".
- Pressing the Step 3 primary action with a clean queue runs batch research directly.
- No Step 2 logic changed.
- No evidence guard was disabled or bypassed.

Current CBS state
-----------------
The existing research already completed. Deploying this build should not require
researching all 15 again. Reopen Step 3; the library state remains in Airtable.
If Research All is clicked, completed Research Packs are skipped.
