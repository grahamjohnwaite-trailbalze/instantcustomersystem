ICS v3.12n — Manual Edit Source Detach

Root cause fixed
----------------
Article 14 was manually changed from a takeaway story to a market story, but the saved
planner provenance still pointed to Lead 13, and its core question could remain from
the old story. The duplicate guard therefore correctly treated Articles 4 and 14 as
using the same source lead.

Changes
-------
- Adds Life Lane to the manual Edit form.
- If an editor materially changes the title or core question on a CREATE NEW candidate:
  * the old source lead/provenance is detached,
  * problem becomes the new core question,
  * the candidate is marked for fresh research/localisation,
  * old planning-lead evidence is not reused.
- Top panel confirms that the old planning lead was detached.
- No research/writer/component logic changed.
- Deploy package retains only the current v3.12n README instead of accumulating patch notes.

For the current CBS Article 14:
1. Open Edit.
2. Ensure Core Question is:
   Which market in Cambridgeshire is worth travelling to for the stalls, food,
   atmosphere or something you cannot easily get elsewhere?
3. Set Life Lane to Places & Discovery.
4. Save.
5. Lock Approved Plan again.
