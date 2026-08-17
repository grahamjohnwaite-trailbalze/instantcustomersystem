# ICS v3.21.5 — Fast Research Lane

- Step 3 now saves a bounded fast evidence pack first instead of automatically launching an expensive deep-recovery pass for every weak candidate.
- Items with incomplete evidence are saved honestly for later review/deep research; they do not hold the whole issue open.
- Client wait for one fast research job is capped at 150 seconds instead of 12 minutes.
- Live ticker now shows Finished · Active · Waiting · Failed counts separately.
- Four-worker research pool retained.
- No planning, approval, or completed research is reset by this release.
