ICS v3.15.3 — STEP 6 PERSISTENT COMPONENTS

ROOT CAUSE
----------
The previous Step 6 batch generated 18 READY components but stored them only in browser/localStorage state.
A new Netlify Deploy Preview uses different browser storage, so the next deployment reported 0/18.

The previous batch code also wrote to S.canvas while the actual Canvas engine reads getCanvas()/localStorage.

FIX
---
Supporting components are now persisted as Airtable Issue Section records.

Each record stores:
- Issue link
- Section Title / Type
- Section Order
- final component copy
- Section Status
- life lane
- an ICS SUPPORT COMPONENT marker in Notes

Step 6 status now refreshes from Airtable before reporting its counts.
Batch Resume skips already-persisted READY components.
Failed components remain saved as Needs Production and can be retried.
Step 7 assembles these persistent support records instead of creating fresh placeholder support.

CURRENT CBS
-----------
The 18 components produced by v3.15.1/2 existed only in the old Deploy Preview browser storage.
They cannot be recovered from the new deploy. They need one final re-run after v3.15.3.
That re-run is the migration to persistent state.

Acceptance test:
1. Run Step 6 to 18/18 READY.
2. Refresh the page: still 18/18.
3. Deploy a later build: still 18/18.
Only then freeze Step 6.
