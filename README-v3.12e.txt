ICS v3.12e — Planner Auto-Recovery + Operator Progress

Fixes:
- Planner no longer stops and requires a manual Resume when the recent-history guard rejects a duplicate.
- Rejected duplicate concepts are immediately added to the current-run exclusion list and the same planning decision retries automatically.
- Up to 8 replacement attempts are allowed before a genuine blocker is surfaced.
- Top workflow panel now shows Publication + Issue + Step.
- Long-running planning progress is mirrored into the persistent top panel.
- Added Copy Status button so operator messages/progress are always easy to copy and paste.
- Existing completed planning decisions remain preserved.
- No research/writer/component production logic changed.

Acceptance test:
1. Open the current CBS issue.
2. Click Build / Resume Issue Plan once.
3. If the old What's On duplicate is proposed again, ICS should reject it and automatically choose a replacement without another click.
4. Watch progress in the top panel through to 15/15 or a genuine blocker.
