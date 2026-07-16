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

function candidateModels(){
  // Compatibility-first list. OPENAI_MODEL is intentionally ignored while
  // the production service is being validated so an old invalid Netlify
  // value cannot block the fallback chain.
  return ['gpt-4.1-mini','gpt-4.1','gpt-5.6-luna','gpt-5.6-terra','gpt-5.6'];
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
  const attempts=[];
  for(const model of candidateModels()){
    const {response,payload}=await requestModel({apiKey,model,input,useWeb});
    if(response.ok)return {...payload,_model_used:model};
    const message=payload?.error?.message||`OpenAI request failed (${response.status})`;
    const code=payload?.error?.code||payload?.error?.type||'';
    attempts.push(`${model}: ${message}${code?` [${code}]`:''}`);
    const retryable=response.status===404||response.status===403||/model|permission|access/i.test(message);
    if(!retryable){
      const error=new Error(message);
      error.status=response.status;error.details=payload;throw error;
    }
  }
  const error=new Error(`OpenAI model diagnostic failed. Attempts: ${attempts.join(' | ')}`);
  error.status=403;error.details={attempts,advice:'Check the exact model attempts shown. If every model returns the same permission error, create a fresh project API key after billing became active and replace OPENAI_API_KEY in Netlify.'};throw error;
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
