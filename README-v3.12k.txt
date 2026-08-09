ICS v3.12k — Publication Hits Fix

Root cause
----------
v3.12i added a publication contamination guard that referenced `publicationHits`
during the planner decision, but that variable was not actually declared in the
runtime path. That caused planning to stop immediately with:
`publicationHits is not defined`.

Fix
---
- Declares and calculates publicationHits immediately after duplicate checks.
- Keeps the publication guard, reset control, saved signals and existing workflow unchanged.
- No other planner behaviour changed.

Acceptance test
---------------
1. Deploy.
2. CBS #46 remains reset with collected signals preserved.
3. Click Build / Resume 15-Candidate Plan once.
4. The planner should proceed instead of throwing `publicationHits is not defined`.
