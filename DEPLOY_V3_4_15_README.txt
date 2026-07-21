ICS Issue Canvas v3.4.15

Fixes production polling/version mismatch and adds OpenAI request timeouts.
- Front end now recognises any PRODUCTION SERVICE v2.x success marker and MASTER ARTICLE FAILED v2.x failure marker.
- Background marker cleanup is version-agnostic.
- OpenAI web research requests time out after 120 seconds per model; text drafting after 90 seconds per model.
- Timed-out model attempts fall through to the next compatible model rather than hanging indefinitely.

Test: deploy, reopen PBS, inspect Produced Articles first, then run Article #2 individually.
