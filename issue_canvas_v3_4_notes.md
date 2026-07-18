# ICS Issue Canvas v3.4

## NOW scope completed in this build
- Opening a live issue now lands on **Issue Canvas**, making the canvas the main production workspace.
- Drag/reorder uses the dedicated handle so clicking/editing a card no longer fights dragging.
- Clear before/after insertion markers improve running-order placement.
- Partners now attach to articles/components via **Partner attached? Yes/No**.
- Partner-only fields are conditional and hidden until a partner is attached.
- Standalone partner presence is retained only as an explicit **Partner Feature** component.
- New article blocks no longer inherit `Potential Sponsor Category`; partner role/category starts blank unless deliberately attached.
- Component generation now calls `generate-canvas-component` and sends publication, issue number/date, issue theme, component purpose, local proof, partner context, neighbouring blocks and available produced-article context.
- Generator is instructed to return finished Letterman-ready component copy, not generic starter copy.
- Local Proof / Source remains internal evidence guidance and is not automatically printed into the component.

## Deliberately not pulled forward
- Master Content Ideas
- Archive Recovery
- Full partner CRM / Active Sponsors connection
- Letterman API publishing automation

## Proof gate
Do not move to NEXT until the same canvas workflow proves:
1. one complete Norfolk Spotlight issue;
2. one complete PBS issue;
3. one niche issue.
