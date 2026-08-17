import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../app/index.html', import.meta.url),'utf8');
assert.match(html,/readyBankCountV3231>0/,'READY bank assets must keep workflow in Step 5');
assert.match(html,/Build READY Bank — \${mix.total}\/\${bankTarget}/,'top action must expose READY-bank build');
assert.doesNotMatch(html,/Write every Master that has a valid Research Pack/,'retired Master wording must not remain in operator guide');
assert.match(html,/Step 5 — Build Weekly READY Article Bank \+ This Issue/);
console.log('ready-state-continuity: ok');
