import assert from 'node:assert/strict';
import {expectedResearchOrders,evidenceClass,articleState,nextStep} from '../netlify/functions/_workflow-core.mjs';
const plan=Array.from({length:20},(_,i)=>({order:i+1,mode:i===7?'REUSE':'CREATE NEW'}));
assert.equal(expectedResearchOrders(plan).length,19);assert(!expectedResearchOrders(plan).includes(8));
assert.equal(evidenceClass('VERIFIED_NOW'),'VERIFIED');assert.equal(evidenceClass('ATTRIBUTED_REPORT'),'ATTRIBUTED');assert.equal(evidenceClass('EDITORIAL'),'EDITORIAL');assert.equal(evidenceClass('BLOCKED'),'NEEDS_EVIDENCE');
assert.equal(articleState({approved:true,researchOutcome:'ATTRIBUTED_REPORT'}),'WRITEABLE');assert.equal(articleState({approved:true,researchOutcome:'BLOCKED'}),'NEEDS_EVIDENCE');assert.equal(articleState({approved:true,researchOutcome:'VERIFIED_NOW',written:true,qaPass:true}),'QA_READY');
assert.equal(nextStep({planLocked:true,expectedResearch:19,researchTerminal:0}),3);assert.equal(nextStep({planLocked:true,expectedResearch:19,researchTerminal:19,written:3,minArticles:8}),4);assert.equal(nextStep({planLocked:true,expectedResearch:19,researchTerminal:19,written:12,minArticles:8,selected:8}),6);
console.log('v3.22 workflow-core tests passed');
