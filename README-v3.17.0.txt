ICS v3.17.0 — STEP 8 QA REPAIR

The first full QA run found four genuine hard-fix classes:
1. internal/commercial wording in reader-facing support
2. selected Master Articles ending mid-sentence/mid-word
3. a Partner Tip with no named partner
4. a duplicate Opening Note used as the closing block

This build fixes the workflow rather than asking the operator to repair 27 blocks manually.

NEW STEP 8 ACTION
-----------------
Final QA Results now has one visible button:
  Fix QA Exceptions

It repairs hard fixes only, then the operator reruns Final QA.

MASTER COMPLETENESS
-------------------
- Truncated selected Masters are identified deterministically.
- Repair keeps the saved Research Pack and reruns only the writer.
- Writer/package checkpoints are invalidated so the same clipped writer output cannot be reused.
- Repaired copy is checked again for a complete sentence ending and wrong-publication geography.
- Server-side writer publishability now rejects article bodies that appear clipped or end mid-sentence,
  so future Master production should catch this BEFORE READY.

SUPPORT HARD FIXES
------------------
- Orphan Partner Tip -> converted to an editorial Quick Local Check and rewritten.
- Duplicate final Opening Note -> converted to Before You Go and rewritten as a real closing.
- Internal/commercial reader-facing wording -> rewritten out.
- No partner commitment, Master selection, evidence pack or issue structure is silently changed.

WARNINGS
--------
Warnings are deliberately not all auto-fixed in this pass.
After hard fixes, rerun Final QA. Then judge remaining warnings as issue-level editorial improvements.

Current CBS action:
1. Deploy v3.17.0.
2. Open Step 8.
3. Click Fix QA Exceptions once.
4. Let the Master repairs and support fixes finish.
5. Run Final QA again.
