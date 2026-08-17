ICS v3.15.2 — STEP 6 LIVE PROGRESS

What was wrong
--------------
The Step 6 batch worked (18 READY / 0 failed), but the operator only saw the result at
the end. During the run there was no reliable indication of whether ICS was still working.

Fix
---
- Adds a live Step 6 progress panel.
- Shows:
  * current component being produced
  * processed / total
  * ready count
  * failed count
  * percentage progress
  * progress bar
- Updates after EVERY component, not only at batch completion.
- Mirrors the live counts/current action into the persistent top workflow status.
- Browser is explicitly yielded between components so progress paints while the batch runs.
- Final success/failure remains visible and copyable.
- Existing 18 READY components are preserved.

This is a visibility fix only; component production rules are unchanged.
