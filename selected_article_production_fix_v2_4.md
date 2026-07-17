# ICS Master Articles v2.4 — Selected Article Production Fix

## Root cause
The button labelled “Produce next Master Article only” did not use the row selected in the editor. It always rebuilt the production queue and sent the first pending record. After Sandringham was completed, Water remained the first pending record, so selecting Summer Drive still retried Water.

## Fix
- Button renamed to **Produce selected Master Article**.
- One-article production now sends the exact selected Publish Now record.
- A clear warning appears when no article is selected or the record is outside the Publish Now queue.
- Ready/QA Pass records require confirmation before replacement.
- Invalid/non-JSON server responses now display the HTTP status and the first part of the raw response.

## No schema changes
No Airtable fields or records are changed by deployment.
