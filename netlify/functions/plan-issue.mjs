import {createResponse,outputText,parseJsonText,cleanUrl} from './_openai.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const normalizeMode=v=>['REUSE','REFRESH','CREATE NEW'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():'CREATE NEW';

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const publication=String(data.publication||'').trim();
    const issuePromise=String(data.issuePromise||'').trim();
    const sendDate=String(data.sendDate||'').trim();
    const knownSignals=String(data.knownSignals||'').trim();
    const existing=(Array.isArray(data.existingArticles)?data.existingArticles:[]).slice(0,80).map(x=>({
      id:String(x.id||''),title:String(x.title||''),purpose:String(x.purpose||''),proof:String(x.proof||''),
      content:String(x.content||'').slice(0,1200),freshness:String(x.freshness||''),topic:String(x.topic||'')
    })).filter(x=>x.id&&x.title);
    if(!publication)return json(400,{ok:false,error:'publication is required'});
    if(!issuePromise)return json(400,{ok:false,error:'issuePromise is required'});

    const inventory=existing.map((x,i)=>`${i+1}. ID=${x.id}\nTITLE=${x.title}\nPURPOSE=${x.purpose}\nFRESHNESS=${x.freshness}\nTOPIC=${x.topic}\nPROOF=${x.proof}\nEXCERPT=${x.content}`).join('\n\n');
    const prompt=`You are the senior issue editor for Trail Blaze's ${publication}. Build the editorial MASTER ARTICLE slate for one upcoming issue.

TODAY: ${new Date().toISOString().slice(0,10)}
TARGET SEND DATE: ${sendDate||'Not supplied'}
ISSUE PROMISE: ${issuePromise}
KNOWN SIGNALS / EVENTS / MUST-INCLUDE NOTES FROM THE EDITOR:
${knownSignals||'None supplied. Research the current public picture yourself.'}

EXISTING PERMANENT / PRODUCED ARTICLE INVENTORY:
${inventory||'No existing articles supplied.'}

Research current public information before deciding. This is editorial PLANNING, not final article writing.

GOAL
Return exactly 15 distinct proper article opportunities for this issue. Each must answer one main reader question and normally be suitable for a 250-600 word article. Prefer 350-500 words. Do not fill the slate by paraphrasing one story.

DECISION MODES
- REUSE = an existing article is still current enough and genuinely deserves another issue appearance with no material factual refresh. Use its exact supplied ID.
- REFRESH = the underlying existing article/question is valuable, but dates, prices, evidence, law, event status, local proof or angle must be re-researched. Use its exact supplied ID but propose the fresh title/question.
- CREATE NEW = current news, event, national-to-local consequence, seasonal opportunity, reader need or uncovered question merits a new article.

EDITORIAL MIX
Across the 15, deliberately seek a balanced issue rather than 15 evergreen archive pieces. Where genuine evidence exists, include a mix of:
- current ${publication} news / change / accountability;
- local events or things happening in the issue window;
- newsworthy national developments with a real local consequence;
- money / household cost / value questions;
- property / renting / home / transport or other everyday decisions;
- food / leisure / places / local discovery;
- at least one fair UNFILTERED / challenge / contrary angle where earned;
- service / community / health / family questions where locally relevant.
Do not force a category when there is no worthwhile current angle.

QUALITY RULES
- The human question should sound like something a normal reader would actually ask. Do not overuse 'mate', 'friend', 'sensible', 'key question', 'useful', 'practical' or AI-style filler.
- A national story qualifies only when the local consequence materially changes the answer.
- Never fake a local event, price, statistic, business, quote, expert or reader view.
- Do not recommend a business just because it could be a sponsor.
- Same entity is allowed with a materially new question; same story/claim/angle is duplication.
- REUSE should normally be a minority of the slate. Existing inventory is a resource bank, not a quota to fill.
- If an existing article is time-sensitive or clearly dated, prefer REFRESH rather than REUSE.
- For controversial issues, state the strongest credible counter-position in the planning notes.

RETURN STRICT JSON ONLY:
{
 "issue_summary":"2-4 sentences explaining the editorial shape",
 "signals":[{"signal":"current signal/event/change","why_local":"why it matters here","source_title":"","source_url":""}],
 "articles":[{
   "order":1,
   "mode":"REUSE|REFRESH|CREATE NEW",
   "existing_article_id":"exact supplied ID for REUSE/REFRESH, blank for CREATE NEW",
   "title":"reader-facing article title",
   "question":"one main human reader question",
   "problem":"reader problem / decision",
   "hook":"why stop and read now",
   "reader":"who specifically needs this",
   "value":"what changes for the reader after reading",
   "local_proof":"named/current local proof required",
   "evidence":"what must be verified before publication",
   "lane":"Authority|Featured Partner|Community|Editorial|Open",
   "partner_path":"natural expert/business/community route or Open; never invent a partner",
   "cta_type":"None|Reply|Comment|Save|Nominate|Button|Ask Expert|Booking|Directory",
   "cta_text":"short action or blank",
   "stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED",
   "why_now":"current/seasonal/editorial reason this belongs in this issue",
   "countercase":"strongest credible other side when relevant",
   "source_signal":"which researched signal/event/change this stems from"
 }]
}`;

    const model=String(process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const response=await createResponse({input:prompt,useWeb:true,model,timeoutMs:70000});
    const result=parseJsonText(outputText(response));
    const validIds=new Set(existing.map(x=>x.id));
    const articles=(Array.isArray(result.articles)?result.articles:[]).slice(0,15).map((a,i)=>{
      let m=normalizeMode(a.mode),id=String(a.existing_article_id||'').trim();
      if((m==='REUSE'||m==='REFRESH')&&!validIds.has(id)){m='CREATE NEW';id='';}
      return {order:i+1,mode:m,existing_article_id:id,title:String(a.title||'').trim(),question:String(a.question||'').trim(),problem:String(a.problem||'').trim(),hook:String(a.hook||'').trim(),reader:String(a.reader||'').trim(),value:String(a.value||'').trim(),local_proof:String(a.local_proof||'').trim(),evidence:String(a.evidence||'').trim(),lane:String(a.lane||'Editorial').trim(),partner_path:String(a.partner_path||'Open').trim(),cta_type:String(a.cta_type||'None').trim(),cta_text:String(a.cta_text||'').trim(),stance:String(a.stance||'PRACTICAL').trim(),why_now:String(a.why_now||'').trim(),countercase:String(a.countercase||'').trim(),source_signal:String(a.source_signal||'').trim()};
    }).filter(a=>a.title&&a.question);
    if(articles.length!==15)return json(502,{ok:false,error:`Smart planner returned ${articles.length} usable articles; expected exactly 15. Please run it again.`});
    const signals=(Array.isArray(result.signals)?result.signals:[]).map(s=>({signal:String(s.signal||'').trim(),why_local:String(s.why_local||'').trim(),source_title:String(s.source_title||'').trim(),source_url:(u=>/^https?:\/\//i.test(u)?u:'')(cleanUrl(s.source_url))})).slice(0,20);
    const counts=articles.reduce((o,a)=>(o[a.mode]=(o[a.mode]||0)+1,o),{});
    return json(200,{ok:true,plan:{createdAt:new Date().toISOString(),publication,sendDate,issuePromise,issue_summary:String(result.issue_summary||'').trim(),signals,articles,counts},modelUsed:response._model_used||model});
  }catch(error){
    console.error('plan-issue-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Smart issue planning failed.'),details:error?.details});
  }
};
