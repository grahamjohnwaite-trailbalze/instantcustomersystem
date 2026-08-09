ICS v3.16.5 — STEP 7 ACTION WIRING

What was wrong
--------------
v3.16.4 correctly contained the clean Step 7 rebuild function, but the visible top
"Assemble Selected Issue" button did not call it.

The button only reopened Step 7 and displayed:
"Step 7 — Ready To Rebuild"

That is why the old cached 27-block running order stayed on screen and appeared unchanged.

Fix
---
- Clicking "Assemble Selected Issue" now directly calls smartAssembleIssue().
- The visible status immediately changes to "Step 7 — Assembly Starting…".
- The clean rebuild then:
  * refreshes current Step 5 selection
  * checks each selected Master
  * checks persistent Step 6 support
  * discards the old cached running order
  * rebuilds the current running order
  * finishes with "Running Order Ready — N/N"
- No Step 5 or Step 6 data is changed.

Current CBS action
------------------
Deploy v3.16.5, open Step 7, click Assemble Selected Issue once.
You should now see the status move through Checking Master... / Rebuilding Running Order...
instead of simply returning to the same screen.
