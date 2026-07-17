# ICS Master Articles v2.5

## Fixed
- The live `/ics` application now uses the selected article production logic. v2.4 updated the root page but left `/app/index.html` on the old automatic-next logic.
- The button now reads **Produce selected Master Article** in both entry points.
- The exact row open in the editor is sent to `produce-section`.
- Progress text explains that research, writing, checking and saving may take 30–60 seconds.
- The production function now writes stage-by-stage Netlify logs with a run ID:
  - request received and parsed
  - Airtable lookup started/completed
  - OpenAI started/completed and model used
  - JSON parse started/completed
  - Airtable save started/completed
  - exact failure details
- Article body guidance is tightened to 650–950 words to keep production responsive.

## First test
Select **The Five-Minute Check Before A Norfolk Summer Drive**, then click **Produce selected Master Article** once.
