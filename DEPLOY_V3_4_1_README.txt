ICS Issue Canvas v3.4.1

NOW fixes only:
1. Issue Canvas moved inside the main application shell so it renders at the top/main workspace.
2. Opening an issue loads Issue Canvas after issue sections and the publication article library are loaded.
3. Produced Articles library can load produced Master Articles across all issues for the selected publication via publicationId.
4. Article lookup supports publication library records, not only current-issue sections.
5. UI distinguishes Articles in Canvas from Produced Articles available.

Test first with Norfolk Spotlight:
- Open Norfolk issue: Canvas should appear immediately below header with no large blank gap.
- Left library should show a non-zero produced article availability count if Norfolk has produced Master Articles in Airtable.
- Existing canvas should still show its saved 11 blocks.
- Drag/double-click one available produced article into Canvas.
