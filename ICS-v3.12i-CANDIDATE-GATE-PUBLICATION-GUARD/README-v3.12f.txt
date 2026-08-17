ICS v3.12f — Planner Timeout Recovery

Purpose
-------
Fix the CBS Step 1 blocker where decision 14 repeatedly timed out/rejected after many attempts.

Changes
-------
- plan-issue-batch now tries the normal full planner prompt once.
- If that call times out, it automatically switches to a much smaller fallback prompt
  using the strongest unused candidates, current leads and already-selected titles.
- The UI no longer hammers the same planning decision with long repeated attempts.
- Duplicate replacement retries are capped at four.
- Planner blocker messages stay in the persistent top panel instead of disappearing in alerts.
- Copy Status now has a browser-safe fallback and leaves the exact text visible/selectable if
  clipboard permission is unavailable.
- Existing saved 13/15 CBS decisions are preserved.

Acceptance test
---------------
1. Deploy over v3.12e1.
2. Open CBS Issue #46.
3. Click Build / Resume 15-Candidate Plan once.
4. Decision 14 should either complete normally or show that the compact timeout-recovery route was used.
5. Planning should continue toward 15/15 without ten repeated attempts.
