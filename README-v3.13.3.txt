ICS v3.13.3 — STEP 3 STATE HYDRATION

The screenshot proved that the underlying research state was correct:
15 researched · 11 verified.

The remaining defect was that the workflow shell rebuilt generic Step 3 guidance
whenever the screen opened, so the top panel/button ignored the saved article state.

This build fixes that at the state-model level:
- Step 3 derives its header and primary action from saved Master Article records every time it opens.
- 0 researched -> Research All 15 Masters.
- partial -> Research Remaining N.
- 15 researched with unverified evidence -> shows counts and names the evidence exceptions.
- 15 researched / 15 verified -> Step 3 complete and next action is Step 4 Produce.
- Existing Research Packs are never discarded.
- No evidence verification rule has been disabled.
- Step 2 remains frozen.

Current CBS should reopen as:
15/15 researched · 11/15 verified · 4 evidence exceptions
and the top action should become Review Evidence Exceptions.
