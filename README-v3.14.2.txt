ICS v3.14.2 — ASSEMBLY SOURCE + COPY STATUS

What was wrong
--------------
1. Step 7 used the stale Article Library to decide whether selected Masters were complete.
   Step 4 had written the current Issue records, so READY articles could still be reported
   as "approved plan not ready yet".

2. Some blockers were browser alerts. Those are not reliably selectable/copyable.
   Copy Status only copied the top workflow line and could omit the detailed blocker list.

Fix
---
- Step 7 now uses the active Issue production records first (same source-of-truth rule as Step 5).
- REUSE articles still fall back to the Article Library when appropriate.
- Assembly blocker lists are written into the persistent workflow/status panels, not alerts.
- Copy Status now includes:
  * You Are Here
  * workflow instruction/status
  * detailed smart/status blocker text
  * save-state text
  * production-progress text
- Operator-facing status/audit/note areas are explicitly selectable text.
- Assembly success is also persistent/copyable.
- No content/evidence standards were bypassed.

Current CBS work is preserved.
