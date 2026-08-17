import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app/index.html', import.meta.url),'utf8');
const prod=fs.readFileSync(new URL('../netlify/functions/produce-section.mjs', import.meta.url),'utf8');
assert(!prod.includes('export const config={background:true}'));
assert(!app.includes('Writer did not reach a persisted terminal state within 14 minutes'));
assert(app.includes('persisted to Airtable'));
assert(prod.includes("const RELEASE_VERSION='3.9.4'"));
console.log('v3.22.1 synchronous writer runtime tests passed');
