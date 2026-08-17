ICS v3.12o — Publication Guard Word Boundary

Blocking bug fixed
------------------
The wrong-publication guard used substring matching.

That meant a forbidden geography such as:
  Cambridge
could incorrectly match:
  Cambridgeshire

So a valid title such as:
  Which Cambridgeshire Market Is Actually Worth Making A Trip For?
could be falsely blocked as publication contamination.

Fix
---
- Publication/geography contamination now uses exact word / phrase boundaries.
- "Cambridge" no longer matches "Cambridgeshire".
- Genuine wrong-publication names still block.
- v3.12n manual-edit source detachment and Life Lane field are preserved.
- No planner, research, writer or component behaviour otherwise changed.

Current CBS action
------------------
After deploying v3.12o, do not rebuild the 15 candidates.
Use the existing saved slate and click Lock Approved Plan again.
