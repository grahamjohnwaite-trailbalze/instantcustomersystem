import {createResponse,outputText,parseJsonText} from './_openai.mjs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const normalizeMode=v=>['REUSE','LOCALISE','REFRESH','CREATE NEW'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():'CREATE NEW';
const titleCaseAllWords=text=>String(text||'').replace(/(^|[\s—–:/([{])([a-z])/g,(m,p,c)=>p+c.toUpperCase());
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
    const signals=(Array.isArray(d.signals)?d.signals:[]).slice(0,14).map((x,i)=>`${i+1}. ${String(x.signal||'').slice(0,150)} | ${String(x.source_title||'').slice(0,60)}`).join('\n');
    const blockedRecentHistory=(Array.isArray(d.blockedRecentHistory)?d.blockedRecentHistory:[]).slice(0,50).map(x=>String(x||'').trim()).filter(Boolean);
    const blockedPack=blockedRecentHistory.map((x,i)=>`${i+1}. ${x}`).join('\n');
    const rejectedCandidates=(Array.isArray(d.rejectedCandidates)?d.rejectedCandidates:[]).slice(0,30).map(String).filter(Boolean);
    const existing=(Array.isArray(d.existingArticles)?d.existingArticles:[]).slice(0,90).map(x=>({id:String(x.id||''),title:String(x.title||''),purpose:String(x.purpose||'').slice(0,100),freshness:String(x.freshness||''),topic:String(x.topic||''),history_status:String(x.history_status||''),history_match:String(x.history_match||''),history_publication:String(x.history_publication||''),history_score:Number(x.history_score||0)})).filter(x=>x.id&&x.title);
    const usableExisting=existing.filter(x=>!rejectedCandidates.some(t=>guardSimilarity(x.title,t)>=0.38));
    const rankedExisting=[...usableExisting].sort((a,b)=>{const rank=x=>String(x.history_status||'').startsWith('LOCALISE')?0:String(x.history_status||'').startsWith('AVAILABLE')?1:2;return rank(a)-rank(b)}).slice(0,36);
    const inventory=rankedExisting.map((x,i)=>`${i+1}. ${x.id} | ${x.title} | ${x.topic||x.purpose} | ${x.freshness} | ${x.history_status||'UNKNOWN'}${x.history_publication?` | from ${x.history_publication}`:''}`).join('\n');
    const prior=(Array.isArray(d.priorArticles)?d.priorArticles:[]).slice(0,20).map((x,i)=>`${i+1}. ${x.title} — ${x.question} | mode=${x.mode||''} | life_lane=${x.life_lane||''} | commercial=${x.lane||''} | source=${x.source_signal||''}`).join('\n');
    const prompt=`You are the senior editor for Trail Blaze ${publication}. Choose ONE Master Article for decision ${batch}/${totalBatches}. Return JSON only. Do not browse.

ISSUE: ${publication} #${issueNumber||'—'} | send ${String(d.sendDate||'')}
PROMISE: ${issuePromise}
JOB: ${brief}

CURRENT LEADS (leads, not verified facts):
${signals}

RECENT TARGET-PUBLICATION TOPICS — HARD BLOCK, including close rewrites:
${blockedPack||'None'}

REJECTED THIS RUN — HARD BLOCK:
${rejectedCandidates.length?rejectedCandidates.join(' | '):'None'}

SAFE/REVIEW ARTICLE CANDIDATES:
${inventory||'None'}

ALREADY CHOSEN:
${prior||'None'}

RULES:
- Never repeat a recent blocked, rejected, or already-chosen question/angle. Same concept under a new title is still a duplicate.
- Prefer LOCALISE from another publication when strong and not already used in ${publication}.
- REUSE only when history does not show recent same-publication use. UNKNOWN HISTORY must be stated in why_now.
- REFRESH requires a real changed fact/rule/figure/decision that materially changes the answer.
- CREATE NEW must use one unused current lead and source_signal must start with its exact Lead number.
- Fill a missing Life Lane/tone. Avoid another civic/council/transport piece if the current slate is already serious. Aim for human/discovery/recommendation/value/shareability and natural commercial routes without forcing sponsors.
- Facts/answers first. Do not invent businesses, experts, prices, events, sources or quotes.

STRICT JSON ONLY:
{"issue_summary":"","articles":[{"mode":"REUSE|LOCALISE|REFRESH|CREATE NEW","existing_article_id":"","title":"","question":"","problem":"","hook":"","reader":"","value":"","local_proof":"","evidence":"","life_lane":"Home & Property|Home Improvement & Garden|Money & Household Costs|Family & Children|Health & Wellbeing|Food & Dining|Pets & Animals|Motoring & Transport|Travel, Days Out & Experiences|Leisure, Culture & Entertainment|Community & Local Change|Work, Business & Opportunity|Open","lane":"Authority|Feature Partner|Activation|Community|Editorial|Open","partner_path":"","cta_type":"None|Reply|Comment|Save|Nominate|Button|Ask Expert|Booking|Directory","cta_text":"","stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED","why_now":"","countercase":"","source_signal":""}]}`;
    const model=String(process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const validIds=new Set(rankedExisting.map(x=>x.id));
    // v3.9.8 uses one compact model call with a 24s ceiling. A duplicate or timeout is returned quickly
    // The prompt is intentionally compact so one decision can finish before the platform inactivity window.
    let response,result;
    try{
      response=await createResponse({input:prompt,useWeb:false,model,timeoutMs:22000});
      result=parseJsonText(outputText(response));
    }catch(primaryError){
      const msg=String(primaryError?.message||'').toLowerCase();
      const isTimeout=msg.includes('timeout')||msg.includes('timed out')||msg.includes('aborted')||msg.includes('inactivity');
      if(!isTimeout)throw primaryError;

      // v3.12f: compact fallback. Do not hammer the same long prompt repeatedly.
      // Give the model only the strongest unused options and the already-chosen titles.
      const compactInventory=rankedExisting.slice(0,12).map((x,i)=>`${i+1}. ${x.id} | ${x.title} | ${x.topic||x.purpose} | ${x.history_status||'UNKNOWN'}`).join('\n');
      const compactPrior=(Array.isArray(d.priorArticles)?d.priorArticles:[]).slice(0,15).map((x,i)=>`${i+1}. ${x.title}`).join('\n');
      const compactSignals=(Array.isArray(d.signals)?d.signals:[]).slice(0,10).map((x,i)=>`${i+1}. ${String(x.signal||'').slice(0,120)}`).join('\n');
      const fallbackPrompt=`Choose ONE distinct Master Article for Trail Blaze ${publication}, decision ${batch}/${totalBatches}. Return JSON only.

ISSUE PROMISE: ${issuePromise}
JOB: ${brief}

UNUSED CURRENT LEADS:
${compactSignals||'None'}

SAFE CANDIDATES:
${compactInventory||'None'}

ALREADY CHOSEN — DO NOT REPEAT:
${compactPrior||'None'}

REJECTED — DO NOT REPEAT:
${rejectedCandidates.join(' | ')||'None'}

Use a clearly different question/angle. Prefer human, discovery, recommendation, value or everyday-life coverage if the slate is already civic-heavy. Do not invent facts, businesses, prices, sources or quotes.

JSON ONLY:
{"issue_summary":"","articles":[{"mode":"REUSE|LOCALISE|REFRESH|CREATE NEW","existing_article_id":"","title":"","question":"","problem":"","hook":"","reader":"","value":"","local_proof":"","evidence":"","life_lane":"Open","lane":"Editorial","partner_path":"Open","cta_type":"None","cta_text":"","stance":"PRACTICAL","why_now":"","countercase":"","source_signal":""}]}`;
      response=await createResponse({input:fallbackPrompt,useWeb:false,model,timeoutMs:18000});
      result=parseJsonText(outputText(response));
      response._planner_fallback_used=true;
    }
    const articles=(Array.isArray(result.articles)?result.articles:[]).slice(0,requestedCount).map(a=>{
      let mode=normalizeMode(a.mode),id=String(a.existing_article_id||'').trim();
      if((mode==='REUSE'||mode==='LOCALISE'||mode==='REFRESH')&&!validIds.has(id)){mode='CREATE NEW';id='';}
      return {mode,existing_article_id:id,title:titleCaseAllWords(String(a.title||'').trim()),question:String(a.question||'').trim(),problem:String(a.problem||'').trim(),hook:String(a.hook||'').trim(),reader:String(a.reader||'').trim(),value:String(a.value||'').trim(),local_proof:String(a.local_proof||'').trim(),evidence:String(a.evidence||'').trim(),life_lane:String(a.life_lane||'Open').trim(),lane:String(a.lane||'Editorial').trim(),partner_path:String(a.partner_path||'Open').trim(),cta_type:String(a.cta_type||'None').trim(),cta_text:String(a.cta_text||'').trim(),stance:String(a.stance||'PRACTICAL').trim(),why_now:String(a.why_now||'').trim(),countercase:String(a.countercase||'').trim(),source_signal:String(a.source_signal||'').trim()};
    }).filter(a=>a.title&&a.question);
    const dupHits=articles.map(a=>recentDuplicate(a,blockedRecentHistory)).filter(Boolean);
    const rejectedHits=articles.map(a=>rejectedDuplicate(a,rejectedCandidates)).filter(Boolean);
    if(articles.length!==requestedCount)return json(502,{ok:false,error:`Planner batch returned ${articles.length} usable articles; expected ${requestedCount}.`});
    if(dupHits.length)return json(409,{ok:false,error:`Recent-history guard rejected ${dupHits.length} duplicate candidate${dupHits.length===1?'':'s'} in this decision: ${dupHits.map(x=>x.title).join(' | ')}. Click Build / Resume Issue Plan again; every completed article decision remains saved.`});
    if(rejectedHits.length)return json(409,{ok:false,error:`Planning-run guard rejected a previously rejected concept again: ${rejectedHits.map(x=>x.title).join(' | ')}. Click Build / Resume Issue Plan again; this concept is now excluded from the available pool.`});
    return json(200,{ok:true,batch,label,issue_summary:String(result.issue_summary||'').trim(),articles,modelUsed:response._model_used||model,fallbackUsed:!!response._planner_fallback_used});
  }catch(error){
    console.error('plan-issue-batch-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Planning batch failed.'),details:error?.details});
  }
};
