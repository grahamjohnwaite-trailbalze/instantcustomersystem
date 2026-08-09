ICS v3.12j — Reset Plan Control

Fixes the regression exposed in CBS Step 2:
- The system could tell the operator to rebuild a contaminated 15-candidate plan
  but gave no explicit way to reset only that plan.
- Adds a persistent top-panel 'Reset 15-Candidate Plan' button on Steps 1–2
  whenever saved candidate decisions exist.
- Reset clears only:
  * saved 15-candidate plan,
  * partial planning batches,
  * current-run rejected-candidate list.
- Reset preserves the collected source signals so no discovery work is lost.
- If cross-publication contamination is detected on Step 2, the main top-panel
  action becomes 'Reset 15-Candidate Plan' instead of 'Lock Approved Plan'.
- After reset, ICS returns to Step 1 and the operator can rebuild immediately.

No research, writer, component or Airtable production logic changed.
