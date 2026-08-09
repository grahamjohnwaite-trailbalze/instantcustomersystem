ICS Issue Canvas v3.17.3 — Step 8 Repair Convergence
Build date: 2026-08-09

Purpose
Stop Step 8 hard-fix churn and make repaired supporting copy persist to the real Step 6 source-of-truth.

Changes
1. Old v3.17.2 QA reports are treated as stale. After deployment, run Final QA again before using Fix QA Exceptions.
2. AI whole-issue QA may no longer promote ordinary repetition, overlap, generic support, rhythm, theme concentration, duplicated prompts, localisation strength or human-voice concerns to hard FIX. These remain WARNING-level editorial judgement. Hard FIX is reserved for genuine publication blockers such as internal/commercial leakage, incomplete copy, orphan Partner Tip, and unsupported factual-format failures.
3. Fix QA Exceptions now prepares support repairs on a temporary copy first.
4. A fresh whole-issue QA is run against that temporary repaired issue before persistence.
5. The repair batch is rejected if the hard-fix count does not fall or if a new hard-fix class appears. Rejected repairs never touch persistent Step 6 records.
6. Accepted support repairs are PATCHed back into the persistent Airtable Issue Section records used by Step 6, including updated component metadata when a support format is reclassified.
7. Browser assembly is updated only after the upstream support records are successfully persisted.
8. Paid/named partner assignments are preserved during support repair. A factual format is only reclassified to editorial when no partner is attached and the supplied material cannot honestly support the claimed format.

Expected CBS #46 proof path
- Deploy v3.17.3.
- Confirm sidebar says Issue Canvas v3.17.3 / Step 8 Repair Convergence.
- Open CBS #46. The old v3.17.2 QA report is not actionable.
- Run Final QA fresh.
- Ordinary support overlap/generic-cluster concerns should now appear as WARNING, not FIX.
- If a genuine hard FIX remains, click Fix QA Exceptions once.
- v3.17.3 tests the proposed repair against the whole issue before persistence.
- If it converges, the status reports the hard-fix reduction and confirms persistent Step 6 records were updated.
- Run Final QA again. Target: 0 Fix before Step 9.
