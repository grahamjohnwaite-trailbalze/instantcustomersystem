# ICS Production Service v1.2 — Compatibility and Diagnostics

- Ignores any stale OPENAI_MODEL environment variable during validation.
- Tries gpt-4.1-mini first, then gpt-4.1, then GPT-5.6 variants.
- gpt-4.1-mini and gpt-4.1 support Responses API web_search.
- Returns the full per-model diagnostic chain if all attempts fail.
- If all models show the same permission error, create a fresh API key after billing activation and replace OPENAI_API_KEY.
