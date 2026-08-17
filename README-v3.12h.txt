ICS v3.12h — Signal Fallback + Status Fix

Why v3.12g still failed
-----------------------
Decision 14 exhausted the reusable article-library candidates after the duplicate
guard was applied. v3.12g correctly refused to reuse a duplicate, but its deterministic
fallback looked only in the article library even though the issue already had 36 saved
planning signals/question-bank candidates.

What changes
------------
1. Duplicate recovery now checks:
   a) unused safe article-library candidate;
   b) if none remains, an unused safe saved signal/question-bank candidate.
2. A signal fallback is CREATE NEW and is explicitly marked as an idea that requires
   fresh research/localisation in Step 3. It is never treated as evidence.
3. The failure message in the top action panel no longer gets overwritten by the
   generic workflow refresh.
4. Top action messages are selectable text with multiline preservation.
5. Existing 13/15 decisions remain untouched.

Acceptance test
---------------
- Deploy.
- Open CBS Issue #46.
- Click Build / Resume 15-Candidate Plan once.
- Decision 14 should either complete normally or use a safe saved-signal fallback.
- Planning should proceed to decision 15.
- If any genuine blocker remains, the full message must stay visible in the top panel
  and be easy to select/copy.
