# ICS Master Articles v2.2 — Airtable Record Lookup Fix

## Exact fault fixed
The production function passed `Issue Sections/<record-id>` into a helper that URL-encoded the slash. Airtable therefore treated the whole string as a table/model name and returned `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`.

The OpenAI connection and web-search test were already working. This release changes the section lookup to use Airtable `filterByFormula` with `RECORD_ID()` and leaves the existing table helper untouched.

It also corrects the diagnostic label that previously displayed `undefined`.
