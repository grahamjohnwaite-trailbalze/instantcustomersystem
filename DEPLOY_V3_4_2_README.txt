ICS Issue Canvas v3.4.2 — Master Article Library Fix

Fixes the Produced Articles panel returning 0 available articles.

Changes:
- Adds /.netlify/functions/master-articles endpoint.
- Resolves publication membership server-side from the current issue.
- Loads produced articles across every issue belonging to that publication.
- Recognises ICS MASTER ARTICLE PACKAGE v1 in Notes as the primary produced-article marker.
- Keeps substantial Section Final Copy as a backwards-compatible fallback.

Test:
1. Deploy this zip over v3.4.1.
2. Hard refresh.
3. Open Norfolk Spotlight issue.
4. Canvas should remain at top.
5. Produced Articles should show the Norfolk Master Article pool instead of 0 available.
