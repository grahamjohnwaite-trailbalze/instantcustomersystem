import {createResponse,outputText,parseJsonText,cleanUrl} from './_openai.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const SCOPES={
  local:`LOCAL / EVENTS: Find current local news, council/service changes, transport or development developments, and worthwhile events/what's-on items in or directly affecting the publication area. Prefer official/local primary sources.`,
  national:`NATIONAL → LOCAL: Find current UK-wide policy, tax, rates, household-cost, health, travel, consumer, property or regulatory developments where the consequence materially changes for readers in this publication area. Do not include a national story with no real local reader consequence.`,
  life:`EVERYDAY / SEASONAL: Find current or timely reader questions around money, home, renting/property, journeys, family/health access, food/leisure, community, weather/season and local discovery. Include a fair challenge/Unfiltered opportunity only where evidence earns it.`
};

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const publication=String(data.publication||'').trim();
    const issuePromise=String(data.issuePromise||'').trim();
    const sendDate=String(data.sendDate||'').trim();
    const knownSignals=String(data.knownSignals||'').trim();
    const scope=String(data.scope||'local').trim();
    if(!publication||!issuePromise)return json(400,{ok:false,error:'publication and issuePromise are required'});
    if(!SCOPES[scope])return json(400,{ok:false,error:'Unknown signal scan scope'});

    const prompt=`You are doing ONE SHORT current-signal scan for Trail Blaze's ${publication}.
TODAY: ${new Date().toISOString().slice(0,10)}
TARGET SEND DATE: ${sendDate||'Not supplied'}
ISSUE PROMISE: ${issuePromise}
EDITOR NOTES: ${knownSignals||'None supplied'}

SCAN ONLY THIS SCOPE:
${SCOPES[scope]}

Return the 4 strongest distinct signals that could justify a useful 250-600 word article or a major supporting component now. Research current public information. Do not write articles.

RULES
- Current facts, dates, prices, policies and events must be supported by a real current source.
- Prefer primary/official/local sources where possible.
- Never invent local opinion, businesses, events, prices or quotes.
- Each signal must state the HUMAN QUESTION it creates for a normal reader.
- Avoid duplicate versions of the same story.
- Keep this scan narrow and concise.

RETURN STRICT JSON ONLY:
{"signals":[{"signal":"","question":"","why_now":"","why_local":"","source_title":"","source_url":""}]}`;

    const model=String(process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const response=await createResponse({input:prompt,useWeb:true,model,timeoutMs:22000});
    const result=parseJsonText(outputText(response));
    const signals=(Array.isArray(result.signals)?result.signals:[]).slice(0,4).map(x=>({
      scope,signal:String(x.signal||'').trim(),question:String(x.question||'').trim(),why_now:String(x.why_now||'').trim(),why_local:String(x.why_local||'').trim(),source_title:String(x.source_title||'').trim(),source_url:(u=>/^https?:\/\//i.test(u)?u:'')(cleanUrl(x.source_url))
    })).filter(x=>x.signal&&x.question);
    if(!signals.length)return json(502,{ok:false,error:`No usable ${scope} signals returned.`});
    return json(200,{ok:true,scope,signals,modelUsed:response._model_used||model});
  }catch(error){
    console.error('scan-issue-signals-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Signal scan failed.'),details:error?.details});
  }
};
