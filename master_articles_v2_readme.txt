ICS MASTER ARTICLES v2.0

DEPLOYMENT
Upload this entire ZIP to Netlify. It is built from the user's restored working deploy.

FIRST TEST
1. Open /ics and confirm Dashboard and Issues load.
2. Open the Norfolk issue.
3. Click Test OpenAI connection.
4. Only after it passes, click Produce next Master Article only.
5. Select the produced article and click Preview selected article package.

WHAT IS STORED NOW
To avoid requiring an immediate Airtable schema migration, the complete Letterman package is stored as structured JSON inside the existing Notes field between:
MASTER ARTICLE PACKAGE v1
...
END MASTER ARTICLE PACKAGE

The existing Airtable fields still store the main article title, body, CTA, evidence status, source link and QA status.

THE PACKAGE INCLUDES
Article subhead; article summary title/subhead/content; SEO title; SEO description; URL path; keywords; featured image brief and alt text; newsletter headline/teaser; Facebook, LinkedIn and X copy; Letterman future automation placeholders; evidence summary and sources.

NEXT DATABASE STEP
After the first successful article, these package values can be migrated into dedicated Airtable fields or a Master Articles table without losing the generated data.
