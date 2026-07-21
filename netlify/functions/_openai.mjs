const API_ROOT='https://api.openai.com/v1';
let modelCache={at:0,models:[]};

function env(name,{required=true,fallback}={}){
  const value=process.env[name]||fallback;
  if(required&&!value)throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function cleanUrl(value){
  try{
    const url=new URL(String(value||'').trim());
    for(const key of [...url.searchParams.keys()]){
      if(/^utm_/i.test(key)||['gclid','fbclid','mc_cid','mc_eid'].includes(key))url.searchParams.delete(key);
    }
    url.hash='';
    return url.toString();
  }catch{return ''}
}

async function openAIRequest(path,{method='GET',body,timeoutMs=90000}={}){
  const apiKey=env('OPENAI_API_KEY');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error(`OpenAI request timed out after ${Math.round(timeoutMs/1000)} seconds`)),timeoutMs);
  let response;
  try{
    response=await fetch(`${API_ROOT}${path}`,{
      method,
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
      body:body?JSON.stringify(body):undefined,
      signal:controller.signal
    });
  }catch(err){
    if(err?.name==='AbortError'||/timed out|abort/i.test(String(err?.message||''))){
      const e=new Error(`OpenAI request timed out after ${Math.round(timeoutMs/1000)} seconds`);e.status=408;throw e;
    }
    throw err;
  }finally{clearTimeout(timer);}
  const text=await response.text();
  let payload;try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  return {response,payload};
}

export async function listAccessibleModels(){
  // Model discovery is helpful, but it must never consume most of an article's
  // production budget. Reuse the last successful list for ten minutes.
  if(modelCache.models.length && Date.now()-modelCache.at < 10*60*1000)return modelCache.models;
  const {response,payload}=await openAIRequest('/models',{timeoutMs:10000});
  if(!response.ok){
    const message=payload?.error?.message||`OpenAI model-list request failed (${response.status})`;
    const error=new Error(message);error.status=response.status;error.details=payload;throw error;
  }
  const models=(payload.data||[]).map(x=>x.id).filter(Boolean).sort();
  modelCache={at:Date.now(),models};
  return models;
}

function unique(values){return values.filter((v,i,a)=>v&&a.indexOf(v)===i)}

function preferredModels(available=[],useWeb=false){
  const configured=String(process.env.OPENAI_MODEL||'').trim();
  const visible=new Set(available);

  // A successful plain-text request does not prove that the same model can use
  // hosted web search. For research requests, try models documented for the
  // Responses API web_search tool before any configured legacy model.
  const preferences=useWeb
    ? ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6','gpt-4.1-mini','gpt-4.1',configured]
    : [configured,'gpt-5.6-luna','gpt-5.6-terra','gpt-5.6','gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o'];

  const matched=unique(preferences).filter(model=>visible.has(model));
  const additional=available.filter(model=>{
    if(matched.includes(model))return false;
    if(/audio|realtime|transcribe|tts|search-preview|image|embedding|moderation/i.test(model))return false;
    return useWeb
      ? /^(?:gpt-5(?:\.|-|$)|gpt-4\.1(?:-|$)|o[34](?:-|$))/.test(model)
      : /^(?:gpt-5(?:\.|-|$)|gpt-4\.1(?:-|$)|gpt-4o(?:-|$)|o[34](?:-|$))/.test(model);
  });
  return unique([...matched,...additional]).slice(0,12);
}

async function requestModel({model,input,useWeb,timeoutMs}){
  const body={model,input};
  if(useWeb)body.tools=[{type:'web_search'}];
  return openAIRequest('/responses',{method:'POST',body,timeoutMs:timeoutMs|| (useWeb?60000:60000)});
}


export async function createResponse({input,useWeb=false}){
  const available=await listAccessibleModels();
  const allCandidates=preferredModels(available,useWeb);
  // Keep production bounded. A single article must never spend minutes cycling
  // through every visible model. Try only the strongest few models within one
  // global deadline, then return a controlled failure to the QA layer.
  const candidates=allCandidates.slice(0,2);
  const started=Date.now();
  const globalTimeoutMs=useWeb?80000:60000;
  if(!candidates.length){
    const error=new Error(`The API key connected successfully, but no compatible ${useWeb?'web-search ':''}text model was visible to this project.`);
    error.status=403;error.details={useWeb,candidates,visibleModels:available.slice(0,100)};throw error;
  }
  const attempts=[];
  for(const model of candidates){
    const remaining=globalTimeoutMs-(Date.now()-started);
    if(remaining<=5000)break;
    let response,payload;
    try{({response,payload}=await requestModel({model,input,useWeb,timeoutMs:Math.min(useWeb?40000:45000,remaining)}));}
    catch(err){
      attempts.push({model,status:err.status||0,message:String(err.message||err),code:'timeout_or_network',useWeb});
      if((err.status||0)===408)continue;
      throw err;
    }
    if(response.ok)return {...payload,_model_used:model};
    const message=payload?.error?.message||`OpenAI request failed (${response.status})`;
    const code=payload?.error?.code||payload?.error?.type||'';
    attempts.push({model,status:response.status,message,code,useWeb});
    const retryable=[400,403,404].includes(response.status)||/model|permission|access|tool|web.search/i.test(message);
    if(!retryable){
      const error=new Error(message);error.status=response.status;error.details={useWeb,attempts,last:payload};throw error;
    }
  }
  const summary=attempts.map(a=>`${a.model}: ${a.status} ${a.message}${a.code?` [${a.code}]`:''}`).join(' | ');
  const elapsed=Math.round((Date.now()-started)/1000);
  const error=new Error(`No visible model completed the ${useWeb?'web-search':'text'} request within the production limit (${elapsed}s). ${summary}`);
  error.status=403;error.details={useWeb,attempts,visibleModels:available.slice(0,100)};throw error;
}

export function outputText(response){
  if(response.output_text)return response.output_text;
  const parts=[];
  for(const item of response.output||[])for(const content of item.content||[])if(content.type==='output_text'&&content.text)parts.push(content.text);
  return parts.join('\n').trim();
}

export function parseJsonText(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(raw)}catch{
    const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
    if(start>=0&&end>start)return JSON.parse(raw.slice(start,end+1));
    throw new Error('The production model did not return valid JSON.');
  }
}
