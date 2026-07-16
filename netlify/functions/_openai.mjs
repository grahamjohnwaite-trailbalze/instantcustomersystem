const API_ROOT='https://api.openai.com/v1';

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

async function availableModels(apiKey){
  const response=await fetch(`${API_ROOT}/models`,{headers:{authorization:`Bearer ${apiKey}`}});
  const text=await response.text();
  let payload;try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  if(!response.ok){
    const error=new Error(payload?.error?.message||`Unable to list OpenAI models (${response.status})`);
    error.status=response.status;error.details=payload;throw error;
  }
  return new Set((payload.data||[]).map(x=>x.id));
}

function preferredModels(accessible){
  const preferred=['gpt-4o-mini','gpt-4.1-mini','gpt-4.1','gpt-4o','gpt-5-mini','gpt-5'];
  return preferred.filter(x=>accessible.has(x));
}

async function requestModel({apiKey,model,input,useWeb}){
  const body={model,input};
  if(useWeb)body.tools=[{type:'web_search'}];
  const response=await fetch(`${API_ROOT}/responses`,{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const text=await response.text();
  let payload;try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  return {response,payload};
}

export async function createResponse({input,useWeb=false}){
  const apiKey=env('OPENAI_API_KEY');
  const accessible=await availableModels(apiKey);
  const candidates=preferredModels(accessible);
  if(!candidates.length){
    const sample=[...accessible].filter(x=>/^gpt-/i.test(x)).slice(0,30);
    const error=new Error(`The API key is valid, but none of the service's supported text models are visible to this project. Visible GPT models: ${sample.join(', ')||'none'}`);
    error.status=403;error.details={visibleModels:sample};throw error;
  }
  const attempts=[];
  for(const model of candidates){
    const {response,payload}=await requestModel({apiKey,model,input,useWeb});
    if(response.ok)return {...payload,_model_used:model};
    const message=payload?.error?.message||`OpenAI request failed (${response.status})`;
    const code=payload?.error?.code||payload?.error?.type||'';
    attempts.push(`${model}: ${message}${code?` [${code}]`:''}`);
    const retryable=response.status===404||response.status===403||/model|permission|access|tool/i.test(message);
    if(!retryable){const error=new Error(message);error.status=response.status;error.details=payload;throw error;}
  }
  const error=new Error(`OpenAI request failed. Accessible models were found, but every attempt failed: ${attempts.join(' | ')}`);
  error.status=403;error.details={attempts};throw error;
}

export async function diagnoseOpenAI(){
  const apiKey=env('OPENAI_API_KEY');
  const accessible=await availableModels(apiKey);
  const candidates=preferredModels(accessible);
  const visible=[...accessible].filter(x=>/^gpt-/i.test(x)).sort().slice(0,50);
  if(!candidates.length)return {ok:false,stage:'models',visibleModels:visible,error:'No supported text model found in this API project.'};
  const attempts=[];
  for(const model of candidates){
    const {response,payload}=await requestModel({apiKey,model,input:'Reply with exactly OK',useWeb:false});
    if(response.ok)return {ok:true,model,visibleModels:visible};
    attempts.push({model,status:response.status,message:payload?.error?.message||'Unknown error',code:payload?.error?.code||payload?.error?.type||''});
  }
  return {ok:false,stage:'response',visibleModels:visible,attempts,error:'Models are visible but a basic response could not be created.'};
}

export function outputText(response){
  if(response.output_text)return response.output_text;
  const parts=[];
  for(const item of response.output||[]){
    for(const content of item.content||[]){
      if(content.type==='output_text'&&content.text)parts.push(content.text);
    }
  }
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
