ICS v3.17.2 — STEP 8 QA STABILISATION

Purpose: make the live Step 8 build unmistakable and make the hard-fix action visible in the main workflow action.

Changes from v3.17.1:
1. App sidebar/version now correctly identifies v3.17.2 Step 8 QA Stabilisation.
2. After Final QA returns one or more hard FIX items, the main Step 8 workflow button changes from “Run Final QA” to “Fix QA Exceptions”.
3. Clicking that main action runs the existing targeted QA repair.
4. After repair, the saved QA report is cleared and the main action returns to “Run Final QA” so the operator verifies persisted copy.
5. Retains v3.17.1 fixes: full Master copy is sent to QA; reader-facing leakage check is narrowed; safe AI support fixes persist actual copy.

Deploy and verify the sidebar says Issue Canvas v3.17.2. If it does not, the live site is not serving this package.
