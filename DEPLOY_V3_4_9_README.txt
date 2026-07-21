ICS Issue Canvas v3.4.9 — Publication-aware production patch

Base: stable v3.4.7
Purpose: unblock Peterborough Spotlight production without reopening the full Canvas redesign.

What changed
1. Dashboard production card is no longer hard-coded to Norfolk.
   - Choose an active publication from a dropdown.
   - Click “Open selected production”.
2. Peterborough Spotlight now has an approved 10-Master-Article editorial plan built in.
   - Open PBS production.
   - Click “Apply current editorial plan”.
   - Missing PBS article briefs are created; matching titles are updated.
   - The PBS issue is marked BUILDING and given a working theme.
3. Build/section intelligence now uses the current publication/location rather than automatically inserting Norfolk into generic reader/proof fields.
4. Produced Article library diagnostic is publication-aware.
5. Sidebar version label updated to v3.4.9.
6. Norfolk’s existing locked 25-publish/6-park plan is retained.

Immediate PBS workflow
Dashboard → choose Peterborough Spotlight → Open selected production → Apply current editorial plan → Build issue → run production.

Important
- This patch deliberately does NOT implement the larger Canvas UX improvements already logged (save confirmation, colour coding, partner dropdown automation, smoother drag/drop, richer auto-completion). Those remain in the fix vault until PBS/CBS production proof is complete.
- Cambridgeshire can be opened through the publication-aware production selector, but a locked CBS editorial plan has not yet been added. The app will say so rather than applying Norfolk/PBS data accidentally.
