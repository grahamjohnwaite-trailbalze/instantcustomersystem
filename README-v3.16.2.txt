ICS v3.16.2 — CANONICAL REPAIR BRIEF

The 0/6 repair result proved the repair was still starting from contaminated story intelligence.

Root cause:
v3.16.0/1 stripped old Research Pack / Writer / Package markers, but preserved the rest of the
old Notes and several old intelligence fields. The background researcher reads those fields,
so stale Peterborough signal/proof/evidence could seed Peterborough again.

Fix:
- Repair now rebuilds each affected Section record from the approved Step 2 candidate only.
- No old Notes/story intelligence survive the repair reset.
- Reader Hook, Reader Value, Local Proof Needed and Evidence Required are rebuilt for the active geography.
- After fresh research finishes, ICS checks the NEW Research Pack for foreign geography BEFORE the writer runs.
- If the Research Pack is contaminated, the error says that explicitly.
- If the Research Pack is clean but the writer reintroduces foreign geography, the existing produced-copy gate catches it.
- Existing clean Masters and the 18/18 persistent support components are preserved.

Current CBS action:
Deploy, go to Step 5, click Repair Produced Masters once.
