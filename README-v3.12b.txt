ICS v3.12b — Clean Step-Based Interface
Build date: 2026-08-09

Purpose
- One production stage at a time instead of one enormous operator page.
- Universal publishing terminology: Step 9 is Production Ready, not Letterman.
- Keeps the existing working backend functions intact while simplifying the operator shell.

Workflow
1 Plan
2 Approve
3 Research
4 Produce
5 Select
6 Components
7 Assemble
8 QA
9 Production Ready

UI changes
- Nine-step workflow stays visible while moving between planning and Master production.
- Planning screen hides component/canvas clutter.
- Research and Produce use a focused Master workspace.
- Select shows the Master selection panel only.
- Components shows the component workspace.
- Assemble shows the Issue Running Order as the main working area.
- QA focuses on QA output.
- Production Ready uses universal output terminology.
- Component Library renamed Content Library.
- This Week's Issue renamed Issue Running Order.
- Component Inspector renamed Selected Section.
- Old command-centre metrics/diagnostics hidden from normal operation.

Acceptance check
1. Deploy the CONTENTS of this folder to Netlify.
2. Open Issue Canvas / Issue Workflow.
3. Click each numbered step. Only the work relevant to that step should dominate the screen.
4. Step 3 and Step 4 should open the focused Master production workspace while keeping the nine-step bar visible.
5. Step 7 should show a large Issue Running Order without the library/inspector clutter by default.
6. Existing PBS data should remain unchanged.

This build is UI/workflow cleanup. It does not yet add one-click batch research, automatic partner profiles, Source Inbox, archive recovery, or direct publishing integrations.
