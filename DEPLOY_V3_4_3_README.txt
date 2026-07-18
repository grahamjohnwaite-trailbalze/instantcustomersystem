ISSUE CANVAS v3.4.3

Fixes:
- Prevents the same Master Article being added to Canvas twice (record ID or normalized title).
- Marks library articles already used as "Already in Canvas" and disables drag/double-click for them.
- Broadens Master Article detection to recover Letterman-built articles saved with older/variant package markers, substantial final copy, or Ready/Published output records.
- Deduplicates repeated library records by title.

Deploy this ZIP over v3.4.2 and hard refresh.
Expected test: Sandringham cannot be duplicated; previously missing £250k/£350k/£500k, Full English and £50 Family Day articles should appear if their Airtable records contain any recoverable production signal.
