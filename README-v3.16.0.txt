ICS v3.16.0 — PRODUCED MASTER INTEGRITY

WHAT STEP 7 EXPOSED
-------------------
The Cambridgeshire running order contained at least two Peterborough-specific Master outputs:
- Four Peterborough Meals For Two That Start Under £40
- Peterborough Potholes: Why Reporting Them Can Feel So Pointless

The approved candidate slate itself was Cambridgeshire, so the remaining defect was downstream:
a produced Master could be marked READY without a final active-publication geography check.

FIX — NOT A BYPASS
------------------
1. Produced Master geography gate
   A completed Master is not READY if its produced title/body/package contains a foreign
   sibling Spotlight geography. It becomes GEOGRAPHY REVIEW.

2. Step 7 hard gate
   Assemble refuses a selected contaminated Master and names the exact article/geography.

3. Targeted repair
   Step 5 now has "Repair Produced Masters".
   It acts only on contaminated Masters:
   - clears stale Research Pack / writer checkpoints / article package / production traces
   - restores the approved plan title and question
   - clears stale source link/final copy/QA state
   - runs fresh research
   - runs fresh writing from that new Research Pack
   - checks the result again before accepting it

4. Future prevention
   Updating an approved plan brief explicitly invalidates all previous research/writing state,
   so an old story cannot survive inside a reused article slot.

PRESERVED
---------
- Current CBS 15-candidate plan
- the clean produced Masters
- Step 5 selection data (subject to removing contaminated READY status)
- 18/18 persistent Step 6 support components
- Step 2–6 workflow work

CURRENT CBS ACTION
------------------
After deploy:
1. Go to Step 5.
2. Contaminated Masters should show GEOGRAPHY REVIEW instead of READY.
3. Click Repair Produced Masters once.
4. It should fresh-research/rewrite only the contaminated Masters.
5. Review the READY shortlist and Save Selection.
6. Step 6 should remain 18/18.
7. Reassemble Step 7.

Do not rebuild the whole issue.
