ICS v3.15.5 — STEP 6 SINGLE ACTION

What was wrong
--------------
Step 6 displayed two apparent "Build Components" actions:
1. the global workflow primary button at the top
2. the dedicated Step 6 status-card button

Only the dedicated lower button was correctly wired to the persistent Step 6 batch.
That violates the "one obvious action per screen" rule.

Fix
---
- The global workflow primary button is hidden while Step 6 is active.
- The Step 6 status-card button is the only visible action.
- While incomplete it says:
    Build / Resume Supporting Components
- When 18/18 are READY it becomes:
    Go To Step 7 — Assemble
- Completion status explicitly says 0 remaining.
- No content/persistence logic changed.
- Existing 18/18 persistent components are preserved.
