ICS v3.16.4 — STEP 7 CLEAN REASSEMBLY

What the screenshot proved
--------------------------
Step 7 was showing the old localStorage running order, including stale Peterborough Masters
and the older Master selection. That list was not evidence that current assembly had run.

Root cause
----------
smartAssembleIssue() asked whether to replace an existing Canvas and otherwise allowed the
old browser assembly to remain visible. Step 7 therefore had two competing sources of truth:
- current Step 5 / Step 6 state
- old localStorage running order

Fix
---
- Step 7 is now always rebuilt from current saved state:
  1. current Step 5 selection
  2. current live Issue Master records
  3. current persistent Step 6 support records
- Old localStorage running order is discarded during assembly.
- No replace-confirmation is used.
- Each selected Master is checked for current READY state and produced geography integrity.
- Support target is checked before assembly.
- Visible Step 7 progress/status shows:
  Checking Masters -> Rebuilding Running Order -> Running Order Ready.
- Final Master titles receive another geography sanity check.
- If assembly integrity fails, the running order is cleared rather than left looking valid.

Current CBS:
After deploy, go to Step 7 and click Assemble Selected Issue once.
Do not trust the old visible running order until the status says Running Order Ready.
