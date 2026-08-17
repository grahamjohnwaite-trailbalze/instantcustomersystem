ICS v3.12d — Step Content Isolation
Build date: 2026-08-09

Purpose
-------
Fix the v3.12c screen-isolation defect where the workflow header could show
Step 7 — Assemble while the body still displayed Step 1 planning content.

Root cause
----------
The workflow header could auto-advance after issue data loaded, but the body's
data-workflow-step attribute was not kept in sync. The navigation and the
content-visibility rules therefore used different workflow steps.

Changes
-------
- The active workflow step is now the single source of truth for both the
  workflow navigation and visible screen content.
- Step 7 hides Engine Profile, Smart Issue Plan, Planning Gate and other
  planning surfaces.
- Step 7 shows the Issue Running Order as the main workspace.
- Content Library and Selected Section remain optional/manual surfaces.
- Steps 6, 8 and 9 also explicitly prevent planning panels leaking into them.
- No research, writing, component-generation or Airtable backend logic changed.

Acceptance test
---------------
1. Open Issue Canvas.
2. Click 1 through 9.
3. Confirm the body changes with the active step.
4. On Step 7, confirm planning content is absent and the running order is visible.
5. Confirm existing PBS records remain unchanged.
