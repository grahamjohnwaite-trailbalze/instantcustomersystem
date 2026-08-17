# ICS v3.23.1 — READY-State Continuity

Focused correction to v3.23.0.

- Preserves Step 5 once an issue already has persisted READY bank assets.
- Prevents deploy/refresh from bouncing an in-progress READY-bank build back to Step 4 merely because the legacy targetMasters threshold is not met.
- Keeps Step 5 as the yield orchestrator: repair/research/write only the non-READY shortfall toward 20 READY banked articles.
- Preserves all existing READY articles.
- Normalises Step 4 operator wording from Master to Article.
- Makes Step 5 heading explicit: weekly READY bank first, then issue selection.
