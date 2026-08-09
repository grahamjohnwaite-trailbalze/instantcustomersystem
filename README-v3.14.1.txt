ICS v3.14.1 — WORKFLOW STEP SEQUENCING

What went wrong
---------------
The workflow had an incorrect auto-step rule:
a valid Step 5 selection with an empty canvas jumped directly to Step 7.

That skipped Step 6 Components.

Correct sequence
----------------
Step 5 Select
-> once 8–10 READY Masters are selected

Step 6 Components
-> build/produce supporting and partner components

Step 7 Assemble
-> only after support/components exist and are READY

No Step 2/3/4 logic changed.
The current CBS selection and produced Masters are preserved.
