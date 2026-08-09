ICS v3.14.0 — STEP 5 STABILISATION

What the screenshot exposed
---------------------------
Step 4 had produced all 15 Masters, but Step 5 showed 0/15 READY / NOT PRODUCED.
The reason was that Step 5 was reading the older Article Library cache instead of the
active Issue production records that Step 4 had just written.

The "Review Master Selection" action also called show('assemble'), which refreshed the
workflow shell. Because the stale Step 5 state said 0 produced, the automatic workflow
calculated Step 3 and bounced the operator backwards.

Fixes
-----
- Step 5 now uses the active 15 Issue production records as its primary source of truth.
- Entering Step 5 refreshes those records from Airtable before rendering.
- READY / WRITTEN REVIEW / BLOCKED / FAILED states reflect the actual Step 4 result.
- Editorial Readiness + A/B/C grade are displayed when present in the Master package.
- ICS automatically recommends a shortlist from READY Masters:
    grade first (A, then B, then C),
    lane spread second,
    then fills to the midpoint of the publication's 8–10 target.
- WRITTEN REVIEW candidates are not auto-selected while enough READY Masters exist.
- Old pre-production checkbox defaults are replaced when they do not form a valid READY selection.
- Review Master Selection stays on Step 5 and cannot bounce back to Step 3.
- Save Selection reports persistently in the top workflow panel.
- No Step 2, Step 3 or Step 4 evidence/production logic was weakened.

Expected current CBS state
--------------------------
After Article 11 retry:
approximately 12 READY + 3 WRITTEN REVIEW.
Step 5 should recommend 9 READY Masters and leave the others bankable/reviewable.
