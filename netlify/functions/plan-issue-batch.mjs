import {createResponse,outputText,parseJsonText} from './_openai.mjs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const normalizeMode=v=>['REUSE','LOCALISE','REFRESH','CREATE NEW'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():'CREATE NEW';
const guardWords=text=>[...new Set(String(text||'').toLowerCase().replace(/£/g,' ').replace(/20,?000/g,'20000').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!new Set('the a an and or but to of in on at for from with by is are was were be been this that what which who will would should could can do does did have has had your our norfolk peterborough cambridgeshire spotlight guide explained actually new best how when why'.split(/\s+/)).has(w)))];
const guardSimilarity=(a,b)=>{const A=guardWords(a),B=guardWords(b);if(!A.length||!B.length)return 0;const bs=new Set(B),hit=A.filter(x=>bs.has(x)).length;return hit/Math.min(A.length,B.length)};
const recentDuplicate=(article,blocked)=>{let best=null;const text=[article?.title,article?.question,article?.problem].filter(Boolean).join(' ');for(const title of blocked){const score=guardSimilarity(text,title);if(!best||score>best.score)best={title,score}}return best&&best.score>=0.45?best:null};
const rejectedDuplicate=(article,rejected)=>{let best=null;const text=[article?.title,article?.question,article?.problem].filter(Boolean).join(' ');for(const title of rejected){const score=guardSimilarity(text,title);if(!best||score>best.score)best={title,score}}return best&&best.score>=0.38?best:null};
export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const d=await request.json().catch(()=>({}));
    const publication=String(d.publication||'').trim(),issueNumber=String(d.issueNumber||'').trim(),issuePromise=String(d.issuePromise||'').trim();
    if(!publication||!issuePromise)return json(400,{ok:false,error:'publication and issuePromise are required'});
    const batch=Number(d.batch||1),totalBatches=Math.max(1,Number(d.totalBatches)||9),label=String(d.batchLabel||`Decision ${batch}`),requestedCount=Math.max(1,Math.min(2,Number(d.targetCount)||1)),brief=String(d.batchBrief||`Produce ${requestedCount} distinct article decision.`);
    const signals=(Array.isArray(d.signals)?d.signals:[]).slice(0,18).map((x,i)=>`${i+1}. [${x.scope||'lead'}] ${String(x.signal||'').slice(0,180)} | ${String(x.published_at||x.why_now||'').slice(0,80)} | ${String(x.source_title||'').slice(0,80)}`).join('\n');
    const blockedRecentHistory=(Array.isArray(d.blockedRecentHistory)?d.blockedRecentHistory:[]).slice(0,80).map(x=>String(x||'').trim()).filter(Boolean);
    const blockedPack=blockedRecentHistory.map((x,i)=>`${i+1}. ${x}`).join('\n');
    const rejectedCandidates=(Array.isArray(d.rejectedCandidates)?d.rejectedCandidates:[]).slice(0,30).map(String).filter(Boolean);
    const existing=(Array.isArray(d.existingArticles)?d.existingArticles:[]).slice(0,120).map(x=>({id:String(x.id||''),title:String(x.title||''),purpose:String(x.purpose||'').slice(0,180),freshness:String(x.freshness||''),topic:String(x.topic||''),proof:String(x.proof||'').slice(0,160),history_status:String(x.history_status||''),history_match:String(x.history_match||''),history_publication:String(x.history_publication||''),history_score:Number(x.history_score||0)})).filter(x=>x.id&&x.title);
    const usableExisting=existing.filter(x=>!rejectedCandidates.some(t=>guardSimilarity(x.title,t)>=0.38));
    const inventory=usableExisting.map((x,i)=>`${i+1}. ${x.id} | ${x.title} | ${x.purpose} | ${x.freshness} | ${x.topic} | HISTORY=${x.history_status||'UNKNOWN'}${x.history_publication?` | MATCH=${x.history_publication}: ${x.history_match} (${x.history_score}%)`:''}`).join('\n');
    const prior=(Array.isArray(d.priorArticles)?d.priorArticles:[]).slice(0,10).map((x,i)=>`${i+1}. ${x.title} — ${x.question} | mode=${x.mode||''} | life_lane=${x.life_lane||''} | commercial=${x.lane||''} | source=${x.source_signal||''}`).join('\n');
    const prompt=`You are senior editor for Trail Blaze ${publication}. Plan ONLY ${requestedCount} Master Article decision${requestedCount===1?'':'s'} for planning decision ${batch}/${totalBatches}: ${label}. Do not browse the web.\n\nAUTHORITATIVE ISSUE: ${publication} | Issue #${issueNumber||'—'} | TARGET SEND ${String(d.sendDate||'')}\nISSUE PROMISE: ${issuePromise}\nIf the issue promise contains an old date or conflicts with the authoritative issue line, ignore the stale date and plan for the authoritative target send date.\nEDITOR NOTES: ${String(d.knownSignals||'None').slice(0,1000)}\nBATCH JOB: ${brief}\n\nCURRENT DISCOVERY LEADS (leads only; not verified facts):\n${signals}\n\nHARD BLOCK — RECENTLY PUBLISHED IN TARGET PUBLICATION (DO NOT REUSE, LOCALISE, REFRESH OR RECREATE THE SAME QUESTION/ANGLE):\n${blockedPack||'None supplied'}\n\nREJECTED EARLIER IN THIS PLANNING RUN — DO NOT PROPOSE THESE OR CLOSE REWRITES AGAIN:\n${rejectedCandidates.length?rejectedCandidates.map((x,i)=>`${i+1}. ${x}`).join('\n'):'None'}\n\nEXISTING ARTICLE LIBRARY (already excludes known same-publication recent duplicates):\n${inventory||'None'}\n\nALREADY CHOSEN IN THIS ISSUE — DO NOT DUPLICATE OR REUSE THEIR SOURCE LEADS:\n${prior||'None'}\n\nReturn exactly ${requestedCount} distinct article decision${requestedCount===1?'':'s'}. One question per article.
SOURCE-TO-IDEA DISCIPLINE:
- Every CREATE NEW or current-event REFRESH decision must be grounded in one specific CURRENT DISCOVERY LEAD above.
- source_signal MUST start with the exact lead number, for example "Lead 4: ...", and accurately describe what that lead is actually about.
- Do not broaden a phone-use enforcement story into speeding, a Pride/library-display dispute into branch/service changes, or otherwise change the event/topic merely because it creates a nicer article.
- The proposed question may go one step beyond the headline only when the linked signal genuinely supports that direction.
- If no discovery lead supports a proposed current article, choose a different supported idea instead.
- A discovery lead already used by any priorArticles entry is normally unavailable for another article in the same issue.
- Do not create a second article from the same underlying event merely by changing the wording, audience or CTA.

 PORTFOLIO-FIRST DISCIPLINE:
- Before inventing a new article, actively inspect the EXISTING ARTICLE LIBRARY for a strong proven article or concept that can be reused or refreshed for this issue.
- A normal Spotlight issue should be assembled mostly from already-produced or localisable assets plus a smaller number of genuinely current/new stories. Current signals are gap-fillers and freshness inputs, not the whole issue.
- Across the full 9-decision issue plan, prefer strong REUSE/LOCALISE/REFRESH assets when genuinely suitable. For this single decision, choose the strongest remaining portfolio gap; do not force reuse.
- Do not choose a weak archive article merely to satisfy that preference: reader value, specificity and issue fit still win.
- Use the ALREADY CHOSEN list to fill missing Life Lanes and tones. Avoid civic/council/transport clustering unless the week genuinely demands it.
- Across the issue aim for a broad Spotlight mix: Home & Property; Home Improvement & Garden; Money & Household Costs; Family & Children; Health & Wellbeing; Food & Dining; Pets & Animals; Motoring & Transport; Travel/Days Out/Experiences; Leisure/Culture/Entertainment; Community & Local Change; Work/Business/Opportunity.
- Human variety matters: include discovery, recommendation, enjoyment, useful service, shareable/list/resource potential and commercial pathways as appropriate. Facts/answers first; engagement second.
- Commercial potential should be visible, but never rescue a weak editorial idea. One strong article may support several partner routes.
- COMMERCIAL VISIBILITY: for every strong article, identify the natural expert/authority, feature/activation, list-building or specialist-brand pathways where they genuinely exist. Do not invent a sponsor and do not force a commercial lane.
- A real paid/current partner commitment may increase priority, but only after reader value, specificity, freshness and factual confidence pass the editorial floor.
- Avoid a civic/public-service-heavy Master Article portfolio. Unless an exceptional breaking-news week justifies it, no more than about 4 of 9 Master Articles should be dominated by councils, planning scrutiny, bins, public-service administration or transport bureaucracy.
- The Master Article layer itself should contain at least two discovery, enjoyment, recommendation, people-led or lighter-interest pieces; do not expect supporting components to supply all personality.

 REUSE / PUBLICATION-HISTORY GATE:
- HISTORY=BLOCKED RECENT DUPLICATE means this asset or materially similar topic is already known published in the TARGET publication. NEVER return it as REUSE, LOCALISE or REFRESH unless the brief explicitly names a materially changed answer; normally choose a different asset.
- HISTORY=LOCALISE FROM OTHER PUBLICATION means the concept appears in another publication but not the target publication in the current minimum-history layer. Return mode LOCALISE when adapting that existing asset to the target publication.
- HISTORY=UNKNOWN HISTORY — REVIEW is not proof that the article is unused. You may propose it only when strong, but make the uncertainty explicit in why_now.
- A generated SEED/question-universe record is an idea candidate only, never proof of research or publication.
- Same title is not required for duplication: compare underlying reader question, decision and factual answer.
- HARD RULE: anything materially matching the HARD BLOCK list is unavailable even under a rewritten title. Choose another concept.
- HARD RULE: anything materially matching REJECTED EARLIER IN THIS PLANNING RUN is also unavailable. Do not waste another decision on the same rejected concept.
- If the safe existing-article pool is exhausted or weak, prefer a genuinely different CREATE NEW article from an unused current discovery lead rather than recycling a blocked/rejected library idea.
- Cross-publication LOCALISE candidates should be preferred over same-publication UNKNOWN HISTORY assets when reader value is similar.
 Existing library is a resource bank, not a quota; REUSE should be earned. Use REFRESH when an old article/question needs current verification or a materially updated angle.
 REFRESH DISCIPLINE:
- REFRESH is not allowed merely because an existing article is evergreen, still relevant, seasonal again, or easy to update.
- For every REFRESH, why_now must state exactly what materially changed since the earlier article: a new rule, decision, figure, price, policy, local development, evidence set, result or other change that materially alters the answer.
- If you cannot name that change, choose CREATE NEW instead.
- Recently covered ideas should have a strong presumption against REFRESH unless the answer has materially changed.
 CREATE NEW for genuinely new/current opportunities. Human UK wording. Include local proof/evidence needs. Do not invent businesses, facts, partners, events or reader quotes. For contentious angles include a fair countercase.\n\nSTRICT JSON ONLY:\n{"issue_summary":"","articles":[{"mode":"REUSE|LOCALISE|REFRESH|CREATE NEW","existing_article_id":"","title":"","question":"","problem":"","hook":"","reader":"","value":"","local_proof":"","evidence":"","life_lane":"Home & Property|Home Improvement & Garden|Money & Household Costs|Family & Children|Health & Wellbeing|Food & Dining|Pets & Animals|Motoring & Transport|Travel, Days Out & Experiences|Leisure, Culture & Entertainment|Community & Local Change|Work, Business & Opportunity|Open","lane":"Authority|Feature Partner|Activation|Community|Editorial|Open","partner_path":"","cta_type":"None|Reply|Comment|Save|Nominate|Button|Ask Expert|Booking|Directory","cta_text":"","stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED","why_now":"","countercase":"","source_signal":""}]}`;
    const model=String(process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const validIds=new Set(usableExisting.map(x=>x.id));
    // v3.9.6 deliberately performs one model call only. A duplicate or timeout is returned quickly
    // and the client resumes the same one-article decision, rather than risking a Netlify 504 on an internal retry.
    const response=await createResponse({input:prompt,useWeb:false,model,timeoutMs:18000});
    const result=parseJsonText(outputText(response));
    const articles=(Array.isArray(result.articles)?result.articles:[]).slice(0,requestedCount).map(a=>{
      let mode=normalizeMode(a.mode),id=String(a.existing_article_id||'').trim();
      if((mode==='REUSE'||mode==='LOCALISE'||mode==='REFRESH')&&!validIds.has(id)){mode='CREATE NEW';id='';}
      return {mode,existing_article_id:id,title:String(a.title||'').trim(),question:String(a.question||'').trim(),problem:String(a.problem||'').trim(),hook:String(a.hook||'').trim(),reader:String(a.reader||'').trim(),value:String(a.value||'').trim(),local_proof:String(a.local_proof||'').trim(),evidence:String(a.evidence||'').trim(),life_lane:String(a.life_lane||'Open').trim(),lane:String(a.lane||'Editorial').trim(),partner_path:String(a.partner_path||'Open').trim(),cta_type:String(a.cta_type||'None').trim(),cta_text:String(a.cta_text||'').trim(),stance:String(a.stance||'PRACTICAL').trim(),why_now:String(a.why_now||'').trim(),countercase:String(a.countercase||'').trim(),source_signal:String(a.source_signal||'').trim()};
    }).filter(a=>a.title&&a.question);
    const dupHits=articles.map(a=>recentDuplicate(a,blockedRecentHistory)).filter(Boolean);
    const rejectedHits=articles.map(a=>rejectedDuplicate(a,rejectedCandidates)).filter(Boolean);
    if(articles.length!==requestedCount)return json(502,{ok:false,error:`Planner batch returned ${articles.length} usable articles; expected ${requestedCount}.`});
    if(dupHits.length)return json(409,{ok:false,error:`Recent-history guard rejected ${dupHits.length} duplicate candidate${dupHits.length===1?'':'s'} in this decision: ${dupHits.map(x=>x.title).join(' | ')}. Click Build / Resume Issue Plan again; every completed article decision remains saved.`});
    if(rejectedHits.length)return json(409,{ok:false,error:`Planning-run guard rejected a previously rejected concept again: ${rejectedHits.map(x=>x.title).join(' | ')}. Click Build / Resume Issue Plan again; this concept is now excluded from the available pool.`});
    return json(200,{ok:true,batch,label,issue_summary:String(result.issue_summary||'').trim(),articles,modelUsed:response._model_used||model});
  }catch(error){
    console.error('plan-issue-batch-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Planning batch failed.'),details:error?.details});
  }
};
