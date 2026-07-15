# ICS Production Service v1

Adds a real server-side production step using the OpenAI Responses API.

## Netlify environment variables required

- `OPENAI_API_KEY` — required
- `OPENAI_MODEL` — optional; automatically tries `gpt-5.6-luna`, then `gpt-5.6-terra`, then `gpt-5.6`
- existing `AIRTABLE_TOKEN`
- existing `AIRTABLE_BASE_ID`

## Behaviour

- Processes only `PUBLISH NOW` sections.
- A Question Only sections draft without web search unless the draft requires a new fact.
- B Light Proof and C Evidence Heavy sections use the Responses API `web_search` tool.
- Writes final copy, CTA text, first clean raw source URL, evidence status/date, QA result, status and a source/evidence ledger into Notes.
- Stops at `Fix Required` when evidence is insufficient or conflicting.
- Runs one section per Netlify function call to reduce timeout risk.
- `Produce next section only` is the safest first live test.

## First test

1. Add `OPENAI_API_KEY` in Netlify Site configuration → Environment variables.
2. Deploy this ZIP.
3. Open Norfolk Production.
4. Click `Produce next section only`.
5. Inspect the first generated section in Airtable/ICS before running all pending sections.

## Cost and safety

Each B/C section can invoke web search and model generation. Test one section first. The production runner skips sections already marked Ready with QA Pass and final copy present.
