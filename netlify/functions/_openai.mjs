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

export async function createResponse({input,useWeb=false}){
  const apiKey=env('OPENAI_API_KEY');
  const model=env('OPENAI_MODEL',{required:false,fallback:'gpt-5.5'});
  const body={model,input};
  if(useWeb)body.tools=[{type:'web_search'}];
  const response=await fetch(`${API_ROOT}/responses`,{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const text=await response.text();
  let payload;try{payload=text?JSON.parse(text):{}}catch{payload={raw:text}}
  if(!response.ok){
    const error=new Error(payload?.error?.message||`OpenAI request failed (${response.status})`);
    error.status=response.status;error.details=payload;throw error;
  }
  return payload;
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
