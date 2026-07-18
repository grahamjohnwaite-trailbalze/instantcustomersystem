ISSUE CANVAS v3.4.4

Fix: Master Article Library no longer depends on the separate master-articles Netlify function.
It uses the already proven issues + sections endpoints to load all produced articles across every issue linked to the current publication, then deduplicates by title.

This is designed to survive deployments where a newly added Netlify function is missing or unavailable.
