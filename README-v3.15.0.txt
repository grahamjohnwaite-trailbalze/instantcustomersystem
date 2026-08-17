ICS v3.15.0 — STEP 6 COMPONENT AUTOMATION

What the screenshot exposed
---------------------------
Step 6 still opened the old component command centre with dozens of component types and
manual fields. That contradicts the operator workflow: ICS should know the issue target,
selected Masters and required support count, then generate support automatically.

Step 6 contract
---------------
1. Read the saved Step 5 Master selection.
2. Calculate target issue size from Publication Profile.
3. Calculate missing support/partner count.
4. Create the missing supporting components in a balanced batch.
5. Attach active partners where appropriate.
6. Produce the created components using the existing component producer.
7. Surface only exceptions.
8. Keep manual component controls under Advanced.
9. Stay on Step 6 until the required support exists and is READY.
10. Only then can the workflow advance to Step 7 Assemble.

Current CBS example
-------------------
If 9 Masters are selected and Spotlight target is ~27 sections:
ICS should build about 18 support/partner blocks automatically.

No Step 2/3/4/5 content standards were bypassed.
