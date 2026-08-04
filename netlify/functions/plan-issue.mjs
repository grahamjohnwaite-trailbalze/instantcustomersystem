import {createResponse,outputText,parseJsonText} from './_openai.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const normalizeMode=v=>['REUSE','REFRESH','CREATE NEW'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():'CREATE NEW';

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const publication=String(data.publication||'').trim();
    const issueNumber=String(data.issueNumber||'').trim();
    const issuePromise=String(data.issuePromise||'').trim();
    const sendDate=String(data.sendDate||'').trim();
    const knownSignals=String(data.knownSignals||'').trim();
    const signals=(Array.isArray(data.signals)?data.signals:[]).slice(0,24).map(x=>({scope:String(x.scope||''),signal:String(x.signal||''),question:String(x.question||''),why_now:String(x.why_now||''),why_local:String(x.why_local||''),source_title:String(x.source_title||''),source_url:String(x.source_url||''),published_at:String(x.published_at||'')}));
    const existing=(Array.isArray(data.existingArticles)?data.existingArticles:[]).slice(0,60).map(x=>({id:String(x.id||''),title:String(x.title||''),purpose:String(x.purpose||''),freshness:String(x.freshness||''),topic:String(x.topic||''),proof:String(x.proof||'').slice(0,280)})).filter(x=>x.id&&x.title);
    if(!publication||!issuePromise)return json(400,{ok:false,error:'publication and issuePromise are required'});
    if(signals.length<5)return json(400,{ok:false,error:'At least 5 current discovery signals are required before planning.'});

    const signalPack=signals.map((x,i)=>`${i+1}. [${x.scope||'discovery'}] ${x.signal}\nDATE=${x.published_at||x.why_now}\nDISCOVERY SOURCE=${x.source_title} ${x.source_url}`).join('\n\n');
    const inventory=existing.map((x,i)=>`${i+1}. ID=${x.id} | ${x.title} | ${x.purpose} | freshness=${x.freshness} | topic=${x.topic} | proof=${x.proof}`).join('\n');
    const prompt=`You are the senior issue editor for Trail Blaze's ${publication}. Build a default 9-MASTER-ARTICLE slate for one upcoming issue. DO NOT browse the web: current research has already been supplied below.

TODAY: ${new Date().toISOString().slice(0,10)}
TARGET SEND DATE: ${sendDate||'Not supplied'}
ISSUE PROMISE: ${issuePromise}
EDITOR NOTES: ${knownSignals||'None'}

CURRENT DISCOVERY PACK (HEADLINE LEADS ONLY — NOT VERIFIED EVIDENCE):
${signalPack}

EXISTING ARTICLE LIBRARY:
${inventory||'No existing articles supplied.'}

Return exactly 9 distinct article decisions. The operator may add or remove articles later; quality and issue balance beat quotas. One article = one real reader question, normally 250-600 words.

MODES
REUSE = existing article remains current and genuinely deserves another issue appearance. Exact ID required.
REFRESH = existing question/article is strong but needs new facts, dates, prices, local proof or angle. Exact ID required.
CREATE NEW = current signal, event, national-to-local consequence, seasonal need or uncovered question merits a new article.

EDITORIAL RULES
- PORTFOLIO FIRST: actively inspect the existing library before creating fresh work. A normal Spotlight issue should primarily curate strong produced/localisable assets plus a smaller number of genuinely current/new stories.
- Existing library is a resource bank, not a quota. REUSE/REFRESH should be earned, but CREATE NEW should not dominate merely because current signals exist.
- Build a varied weekly experience: current change/news, events/what's-on, money/value, home/property/renting/transport, food/leisure/local discovery, community/service/family/health where earned, and one fair challenge/Unfiltered angle where evidence supports it.
- Current discovery leads should materially influence the slate. Treat them as leads only, not proven facts. Every REFRESH/CREATE NEW brief must require fresh verification during article research. Do not reproduce a headline claim as fact merely because it appears here.
- Do not produce 15 evergreen archive articles while ignoring the current discovery pack.
- Human questions must sound natural. Avoid overusing mate, friend, sensible, useful, practical, key question, whether.
- Do not invent partners. Partner path may be Open.
- Same entity is fine with a materially different question; same story/claim/angle is duplication.
- For a contentious angle, include the strongest credible countercase.

STRICT JSON ONLY:
{"issue_summary":"","articles":[{"order":1,"mode":"REUSE|REFRESH|CREATE NEW","existing_article_id":"","title":"","question":"","problem":"","hook":"","reader":"","value":"","local_proof":"","evidence":"","life_lane":"Home & Property|Home Improvement & Garden|Money & Household Costs|Family & Children|Health & Wellbeing|Food & Dining|Pets & Animals|Motoring & Transport|Travel, Days Out & Experiences|Leisure, Culture & Entertainment|Community & Local Change|Work, Business & Opportunity|Open","lane":"Authority|Featured Partner|Community|Editorial|Open","partner_path":"","cta_type":"None|Reply|Comment|Save|Nominate|Button|Ask Expert|Booking|Directory","cta_text":"","stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED","why_now":"","countercase":"","source_signal":""}]}`;

    const model=String(process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const response=await createResponse({input:prompt,useWeb:false,model,timeoutMs:60000});
    const result=parseJsonText(outputText(response));
    const validIds=new Set(existing.map(x=>x.id));
    const articles=(Array.isArray(result.articles)?result.articles:[]).slice(0,9).map((a,i)=>{
      let mode=normalizeMode(a.mode),id=String(a.existing_article_id||'').trim();
      if((mode==='REUSE'||mode==='REFRESH')&&!validIds.has(id)){mode='CREATE NEW';id='';}
      return {order:i+1,mode,existing_article_id:id,title:String(a.title||'').trim(),question:String(a.question||'').trim(),problem:String(a.problem||'').trim(),hook:String(a.hook||'').trim(),reader:String(a.reader||'').trim(),value:String(a.value||'').trim(),local_proof:String(a.local_proof||'').trim(),evidence:String(a.evidence||'').trim(),life_lane:String(a.life_lane||'Open').trim(),lane:String(a.lane||'Editorial').trim(),partner_path:String(a.partner_path||'Open').trim(),cta_type:String(a.cta_type||'None').trim(),cta_text:String(a.cta_text||'').trim(),stance:String(a.stance||'PRACTICAL').trim(),why_now:String(a.why_now||'').trim(),countercase:String(a.countercase||'').trim(),source_signal:String(a.source_signal||'').trim()};
    }).filter(a=>a.title&&a.question);
    if(articles.length!==9)return json(502,{ok:false,error:`Planner returned ${articles.length} usable articles; expected 9.`});
    const counts=articles.reduce((o,a)=>(o[a.mode]=(o[a.mode]||0)+1,o),{});
    return json(200,{ok:true,plan:{createdAt:new Date().toISOString(),publication,sendDate,issuePromise,issue_summary:String(result.issue_summary||'').trim(),signals,articles,counts},modelUsed:response._model_used||model});
  }catch(error){
    console.error('plan-issue-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Smart issue planning failed.'),details:error?.details});
  }
};
