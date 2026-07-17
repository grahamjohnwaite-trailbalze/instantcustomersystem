ICS Master Articles v2.1 — Web Search Model Fix

Cause fixed:
- The connection test used a plain text request, which passed with gpt-5.2.
- Evidence-heavy production adds the Responses API web_search tool.
- The prior candidate selector stopped after finding OPENAI_MODEL, so it never tried another visible web-search-capable model when gpt-5.2 rejected the tool request.

Changes:
- Research requests now prioritise visible web-search-capable models.
- A configured model no longer prevents fallback to other visible models.
- The connection test now tests both plain text and hosted web search.
- Production errors now return model-by-model diagnostic attempts.
