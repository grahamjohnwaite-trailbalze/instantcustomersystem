ICS v3.15.4 — STEP 6 PERSISTENCE PROGRESS

What v3.15.3 got wrong
----------------------
The persistence architecture was correct, but the implementation created every missing
Airtable support record BEFORE the live production progress panel began updating.

With 18 components this meant the UI could look completely idle while 18 serial network
writes were happening. That was unacceptable and made it look as if Step 6 had gone backwards.

Fix
---
Step 6 now shows progress from the FIRST network request:

Phase 1 — Checking Saved State
- checks Airtable for already-persisted support records

Phase 2 — Saving Component Records
- shows "Saving 1 of 18", "Saving 2 of 18", etc.
- updates the progress bar and persistent top status after every Airtable write
- yields to the browser between writes so the UI visibly updates

Phase 3 — Producing Component Copy
- continues the existing per-component live progress
- ready and failed counts update after every component

Resume behaviour
----------------
Any records already created by a previous partial v3.15.3 run are preserved.
The next run begins from the saved Airtable count rather than starting over.

Compatibility fix
-----------------
Persistent support records use existing safe Airtable select values:
- Section Type: Short
- Commercial Lane: None
The intended component type/life lane stay in the persistent Notes metadata.

No content/evidence rules were bypassed.
