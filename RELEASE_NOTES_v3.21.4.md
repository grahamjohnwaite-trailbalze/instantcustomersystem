# ICS v3.21.4 — Live Research Control

- Fixes false 3-minute research failures by allowing background jobs to resolve for up to 12 minutes.
- Runs bulk research with a bounded four-worker pool instead of waiting for every article sequentially.
- Adds a persistent red/amber/green live action ticker with elapsed batch timer in the sticky workflow header.
- Main research action remains disabled and visibly amber while a batch is running.
- Locked plans now show only approved production records in the left Content Library; stale template rows are hidden.
- Preserves all saved Airtable research packs and existing issue state.
