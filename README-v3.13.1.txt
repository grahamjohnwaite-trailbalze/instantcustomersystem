ICS v3.13.1 — STEP 3 RESEARCH WORKSPACE

Problem exposed
---------------
After Step 2 locked, "Open Research Workspace" showed 0 records because the locked
15-candidate plan had not yet been materialised into Master Article briefs.

That was a workflow defect: the operator was being asked to know that a hidden
"Create / Update 15 Briefs" bridge step existed.

Step 3 contract
---------------
1. Locked Step 2 slate is the source of truth.
2. Open Research Workspace automatically creates/updates the 15 approved Master briefs
   when they do not already exist.
3. The queue is reconciled and must be 15/15 clean before research starts.
4. The Step 3 screen exposes one main batch action:
   "Research All Approved Masters".
5. Batch research skips any Master that already has a saved Research Pack.
6. Research Packs are saved article-by-article, so a stopped run preserves completed work.
7. No writer runs during Step 3. Writing belongs to Step 4.
8. Exceptions are surfaced; the operator should not manually research all 15.

Step 2 remains unchanged/frozen.

Current CBS test
----------------
After deploy:
1. Open CBS Issue #46.
2. Click Step 3 / Open Research Workspace.
3. Expected: ICS automatically materialises the locked 15 candidates and the Content
   Library shows 15 active Master briefs instead of 0.
4. Click "Research All Approved Masters".
5. Let the batch run. Completed Research Packs should remain saved even if one article
   blocks or a technical error occurs.
