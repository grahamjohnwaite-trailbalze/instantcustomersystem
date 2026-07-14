# ICS Phase 1B — Minimum Useful Issue Command Centre

## Included
- Create and update Issues through secure Netlify Functions.
- Load, create and update linked Issue Sections.
- Essential Question Engine fields and the locked 56 Primary Hot Buttons.
- Section completion gate, browser recovery draft, issue header editing.
- Ordered Letterman-ready copy preview and clipboard export.
- Norfolk Spotlight production priority for 16 July 2026, with 18 July fallback.

## Netlify environment
- AIRTABLE_BASE_ID=appVwgvUU4qvRWroW
- AIRTABLE_TOKEN must now be a persistent restricted token with data.records:read and data.records:write for this base. Do not expose or commit it.

## Deliberately deferred until this production loop passes
- Full QA Checks board and blocking publish gate.
- Automated archive similarity scoring.
- Drag-and-drop reorder (Section Order is editable now).
- Social scheduler, sponsor CRM, revenue dashboard and automatic publishing.

## Acceptance test
1. Create/open Norfolk Spotlight issue.
2. Add 3 sections.
3. Save Core Reader Question, Primary Hot Button, evidence, action and final copy.
4. Refresh browser and confirm Airtable persistence.
5. Preview and copy Letterman output.
