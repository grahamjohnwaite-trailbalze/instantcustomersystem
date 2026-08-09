ICS v3.12g — Deterministic Planner Fallback

Root problem fixed
------------------
The previous builds still asked the model to invent another replacement after a duplicate.
For CBS decision 14, the model kept returning a concept that the recent-history guard rejected.
Retrying the same generative step four times did not change the underlying problem.

v3.12g changes the recovery model:
- One normal planner decision is attempted.
- Timeout still gets one compact AI fallback.
- If the resulting candidate is still a duplicate, ICS no longer asks the model again.
- It deterministically selects the first unused archive/idea-bank candidate that:
  * is not similar to recent target-publication history,
  * is not on the rejected list,
  * is not similar to any Master already chosen in the current 15.
- That safe candidate is explicitly marked as requiring fresh research/localisation.
- The operator does not need to keep pressing Resume because of one duplicate.

This preserves the editorial guard while making the planner capable of finishing.

Acceptance test
---------------
1. Deploy over v3.12f/e1.
2. Open CBS Issue #46 (13/15 saved).
3. Click Build / Resume 15-Candidate Plan once.
4. Decision 14 should save either the normal choice or a deterministic safe fallback.
5. Planning should then move to decision 15 and reach 15/15 unless a genuinely different backend failure occurs.
