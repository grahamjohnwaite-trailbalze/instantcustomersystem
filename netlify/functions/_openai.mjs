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

async function openAIRequest(path,{method='GET',body}={}){
  const apiKey=env('OPENAI_API_KEY');
  const response=await fetch(`${API_ROOT}${path}`,{
    method,
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:body?JSON.stringify(body):undefined
  });
  const text=await response.text();
  let payload;try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  return {response,payload};
}

export async function listAccessibleModels(){
  const {response,payload}=await openAIRequest('/models');
  if(!response.ok){
    const message=payload?.error?.message||`OpenAI model-list request failed (${response.status})`;
    const error=new Error(message);error.status=response.status;error.details=payload;throw error;
  }
  return (payload.data||[]).map(x=>x.id).filter(Boolean).sort();
}

function preferredModels(available=[]){
  const configured=String(process.env.OPENAI_MODEL||'').trim();
  const preferences=[configured,'gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o'].filter(Boolean);
  const visible=new Set(available);
  const matched=preferences.filter((m,i,a)=>a.indexOf(m)===i&&visible.has(m));
  if(matched.length)return matched;
  return available.filter(m=>/^gpt-(?:4\.1|4o)(?:-|$)/.test(m)&&!/(audio|realtime|transcribe|tts|search-preview)/i.test(m)).slice(0,8);
}

async function requestModel({model,input,useWeb}){
  const body={model,input};
  if(useWeb)body.tools=[{type:'web_search'}];
  return openAIRequest('/responses',{method:'POST',body});
}

export async function createResponse({input,useWeb=false}){
  const available=await listAccessibleModels();
  const candidates=preferredModels(available);
  if(!candidates.length){
    const error=new Error('The API key connected successfully, but no compatible text model was visible to this project.');
    error.status=403;error.details={visibleModels:available.slice(0,100)};throw error;
  }
  const attempts=[];
  for(const model of candidates){
    const {response,payload}=await requestModel({model,input,useWeb});
    if(response.ok)return {...payload,_model_used:model};
    const message=payload?.error?.message||`OpenAI request failed (${response.status})`;
    const code=payload?.error?.code||payload?.error?.type||'';
    attempts.push({model,status:response.status,message,code});
    const retryable=[400,403,404].includes(response.status)||/model|permission|access|tool|web.search/i.test(message);
    if(!retryable){const error=new Error(message);error.status=response.status;error.details={attempts,last:payload};throw error;}
  }
  const summary=attempts.map(a=>`${a.model}: ${a.status} ${a.message}${a.code?` [${a.code}]`:''}`).join(' | ');
  const error=new Error(`No visible model completed the request. ${summary}`);
  error.status=403;error.details={attempts,visibleModels:available.slice(0,100)};throw error;
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
