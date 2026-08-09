ICS v3.17.1 — STEP 8 QA STABILISATION

Scope: Step 8 only. Steps 1–7 unchanged.

Fixes:
1. Final AI QA now receives the complete reader-facing block content instead of silently clipping every block at 1,800 characters. This removes false Master truncation hard-fixes caused by the QA transport itself.
2. Internal/commercial leakage detection now checks reader-facing title/content/CTA/button only, rather than purpose/proof/category metadata. Loose phrase “for now” removed from the hard-fix detector.
3. Fix QA Exceptions now consumes new AI FIX findings marked safeFix=true for supporting components. It rewrites and persists the actual support copy.
4. If News Brief / What’s On claims a factual format but contains no actual news/listings and no evidence is available, the repair pass reclassifies it as an editorial Quick Local Check and rewrites it rather than inventing facts.

Expected CBS #46 test:
- Deploy v3.17.1.
- Open the saved issue/current Step 7 assembly.
- Run Final QA once.
- The false Master truncation FIX should disappear without regenerating Masters.
- Click Fix QA Exceptions for any remaining safe supporting hard fixes.
- Run Final QA again.
- Gate for Step 9 remains 0 Fix.
