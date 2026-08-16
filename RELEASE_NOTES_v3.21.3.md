# ICS v3.21.3 — REUSE-Aware Research Queue

## Fixed
- Direct REUSE articles remain part of the locked 20-article plan and later Step 5 selection, but are not duplicated into the current issue research/production queue.
- Research queue integrity now expects only non-REUSE article orders, so a valid 19-new + 1-REUSE plan no longer reports the REUSE order as missing.
- Repair Approved Queue and Research Queue Repair use the same REUSE-aware expected-order set.
- Step 3 workflow progression now treats 19 researched new/localised articles + 1 already-complete REUSE article as a valid 20-article plan.

## Preserved
- Existing CBS #47 plan, signals, article bank assets and saved work are not reset.
- REUSE article #8 remains available from the Article Bank for Step 5 selection.
