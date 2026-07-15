# ICS Phase 1A — Connected Read-Only Shell

## Added

- `/app/index.html`: unified ICS application shell.
- `/.netlify/functions/publications`: secure read-only Publications endpoint.
- `/.netlify/functions/issues`: secure read-only Issues endpoint with optional publication filter.
- Shared Airtable helper at `netlify/functions/_airtable.mjs`.
- `/ics` redirect to `/app/`.

## Security

The Airtable token is read only from Netlify environment variables. It is never exposed to browser JavaScript or committed to the repository.

Required variables:

- `AIRTABLE_TOKEN` — retain the restricted read-only token.
- `AIRTABLE_BASE_ID` — `appVwgvUU4qvRWroW`

## Current scope

- Dashboard metrics and production warnings.
- Active Publications list.
- Issues list and publication filter.
- Read-only connection only.

## Deliberately disabled until Phase 1B

- Create/edit issues.
- Issue Sections editor.
- Question Engine and Hot Button panel.
- QA editing and publish gate.
- Letterman export.

## Deploy

Upload the repository to GitHub or deploy the ZIP through the existing Netlify workflow, add the two environment variables in Netlify, and trigger a fresh deploy.
