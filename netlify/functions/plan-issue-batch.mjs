import {createResponse,outputText,parseJsonText} from './_openai.mjs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const normalizeMode=v=>['REUSE','REFRESH','CREATE NEW'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():'CREATE NEW';
export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const d=await request.json().catch(()=>({}));
    const publication=String(d.publication||'').trim(),issuePromise=String(d.issuePromise||'').trim();
    if(!publication||!issuePromise)return json(400,{ok:false,error:'publication and issuePromise are required'});
    const batch=Number(d.batch||1),label=String(d.batchLabel||`Batch ${batch}`),requestedCount=Math.max(1,Math.min(5,Number(d.targetCount)||5)),brief=String(d.batchBrief||`Produce ${requestedCount} distinct article decisions.`);
    const signals=(Array.isArray(d.signals)?d.signals:[]).slice(0,18).map((x,i)=>`${i+1}. [${x.scope||'lead'}] ${String(x.signal||'').slice(0,180)} | ${String(x.published_at||x.why_now||'').slice(0,80)} | ${String(x.source_title||'').slice(0,80)}`).join('\n');
    const existing=(Array.isArray(d.existingArticles)?d.existingArticles:[]).slice(0,45).map(x=>({id:String(x.id||''),title:String(x.title||''),purpose:String(x.purpose||'').slice(0,180),freshness:String(x.freshness||''),topic:String(x.topic||''),proof:String(x.proof||'').slice(0,160)})).filter(x=>x.id&&x.title);
    const inventory=existing.map((x,i)=>`${i+1}. ${x.id} | ${x.title} | ${x.purpose} | ${x.freshness} | ${x.topic}`).join('\n');
    const prior=(Array.isArray(d.priorArticles)?d.priorArticles:[]).slice(0,10).map((x,i)=>`${i+1}. ${x.title} — ${x.question}`).join('\n');
    const prompt=`You are senior editor for Trail Blaze ${publication}. Plan ONLY ${requestedCount} Master Article decision${requestedCount===1?'':'s'} for planning batch ${batch}/3: ${label}. Do not browse the web.\n\nISSUE PROMISE: ${issuePromise}\nTARGET SEND: ${String(d.sendDate||'')}\nEDITOR NOTES: ${String(d.knownSignals||'None').slice(0,1000)}\nBATCH JOB: ${brief}\n\nCURRENT DISCOVERY LEADS (leads only; not verified facts):\n${signals}\n\nEXISTING ARTICLE LIBRARY:\n${inventory||'None'}\n\nALREADY CHOSEN IN THIS ISSUE — DO NOT DUPLICATE OR REUSE THEIR SOURCE LEADS:\n${prior||'None'}\n\nReturn exactly ${requestedCount} distinct article decision${requestedCount===1?'':'s'}. One question per article.
SOURCE-TO-IDEA DISCIPLINE:
- Every CREATE NEW or current-event REFRESH decision must be grounded in one specific CURRENT DISCOVERY LEAD above.
- source_signal MUST start with the exact lead number, for example "Lead 4: ...", and accurately describe what that lead is actually about.
- Do not broaden a phone-use enforcement story into speeding, a Pride/library-display dispute into branch/service changes, or otherwise change the event/topic merely because it creates a nicer article.
- The proposed question may go one step beyond the headline only when the linked signal genuinely supports that direction.
- If no discovery lead supports a proposed current article, choose a different supported idea instead.
- A discovery lead already used by any priorArticles entry is normally unavailable for another article in the same issue.
- Do not create a second article from the same underlying event merely by changing the wording, audience or CTA.

 Existing library is a resource bank, not a quota; REUSE should be earned. Use REFRESH when an old article/question needs current verification or a materially updated angle.
 REFRESH DISCIPLINE:
- REFRESH is not allowed merely because an existing article is evergreen, still relevant, seasonal again, or easy to update.
- For every REFRESH, why_now must state exactly what materially changed since the earlier article: a new rule, decision, figure, price, policy, local development, evidence set, result or other change that materially alters the answer.
- If you cannot name that change, choose CREATE NEW instead.
- Recently covered ideas should have a strong presumption against REFRESH unless the answer has materially changed.
 CREATE NEW for genuinely new/current opportunities. Human UK wording. Include local proof/evidence needs. Do not invent businesses, facts, partners, events or reader quotes. For contentious angles include a fair countercase.\n\nSTRICT JSON ONLY:\n{"issue_summary":"","articles":[{"mode":"REUSE|REFRESH|CREATE NEW","existing_article_id":"","title":"","question":"","problem":"","hook":"","reader":"","value":"","local_proof":"","evidence":"","lane":"Authority|Feature Partner|Activation|Community|Editorial|Open","partner_path":"","cta_type":"None|Reply|Comment|Save|Nominate|Button|Ask Expert|Booking|Directory","cta_text":"","stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED","why_now":"","countercase":"","source_signal":""}]}`;
    const model=String(process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const response=await createResponse({input:prompt,useWeb:false,model,timeoutMs:22000});
    const result=parseJsonText(outputText(response));
    const validIds=new Set(existing.map(x=>x.id));
    const articles=(Array.isArray(result.articles)?result.articles:[]).slice(0,5).map(a=>{
      let mode=normalizeMode(a.mode),id=String(a.existing_article_id||'').trim();
      if((mode==='REUSE'||mode==='REFRESH')&&!validIds.has(id)){mode='CREATE NEW';id='';}
      return {mode,existing_article_id:id,title:String(a.title||'').trim(),question:String(a.question||'').trim(),problem:String(a.problem||'').trim(),hook:String(a.hook||'').trim(),reader:String(a.reader||'').trim(),value:String(a.value||'').trim(),local_proof:String(a.local_proof||'').trim(),evidence:String(a.evidence||'').trim(),lane:String(a.lane||'Editorial').trim(),partner_path:String(a.partner_path||'Open').trim(),cta_type:String(a.cta_type||'None').trim(),cta_text:String(a.cta_text||'').trim(),stance:String(a.stance||'PRACTICAL').trim(),why_now:String(a.why_now||'').trim(),countercase:String(a.countercase||'').trim(),source_signal:String(a.source_signal||'').trim()};
    }).filter(a=>a.title&&a.question);
    if(articles.length!==requestedCount)return json(502,{ok:false,error:`Planner batch returned ${articles.length} usable articles; expected ${requestedCount}.`});
    return json(200,{ok:true,batch,label,issue_summary:String(result.issue_summary||'').trim(),articles,modelUsed:response._model_used||model});
  }catch(error){
    console.error('plan-issue-batch-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Planning batch failed.'),details:error?.details});
  }
};
