Issue Canvas v3.4.7

Critical fix: previous v3.4.x patches updated root index.html but the live /ics route redirects to /app/, which served app/index.html. This build synchronises app/index.html with the patched root Issue Canvas so article-library fixes and diagnostics actually run on the live workspace.
