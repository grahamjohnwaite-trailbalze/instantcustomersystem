ICS v3.16.1 — PRODUCED GEOGRAPHY DETECTION

What v3.16.0 missed
-------------------
The Step 5 screenshot proved the geography repair button was present, but no candidates
were marked GEOGRAPHY REVIEW even though Article 4's editorial rationale explicitly said
it used "four named Peterborough examples".

The detector was too narrow. It scanned Section Final Copy and several package fields,
but it did NOT scan:
- editorial_readiness.rationale
- suggested edits
- related questions
- social copy
- article_title / some package metadata

Step 7 can use those package fields for the displayed Master block, so contamination could
survive even when the narrow detector passed.

Fix
---
- Produced geography scanning now covers all reader-visible/editorial-output package fields.
- Source metadata/URLs are deliberately excluded to avoid false blockers from source titles.
- Step 5 status names the detected foreign geography:
    GEOGRAPHY REVIEW — peterborough
- A bold row note shows:
    Wrong-Publication Geography Detected: peterborough
- Repair Produced Masters now keys directly from the detected leakage, not a fragile status label.
- READY recommendation still excludes geography-review Masters.
- Step 7 hard gate remains in place.

Current CBS expectation
-----------------------
After deploy and opening Step 5, at least the contaminated Masters exposed in Step 7
should now be visibly marked GEOGRAPHY REVIEW — peterborough.
Then click Repair Produced Masters once.
