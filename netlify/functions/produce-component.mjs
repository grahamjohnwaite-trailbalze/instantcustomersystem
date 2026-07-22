import {createResponse,outputText} from './_openai.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8'}
});

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const prompt=String(data.prompt||'').trim();
    if(!prompt)return json(400,{ok:false,error:'prompt is required.'});

    const model=String(data.model||process.env.OPENAI_COMPONENT_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    const response=await createResponse({
      input:prompt,
      useWeb:false,
      model,
      timeoutMs:65000
    });
    const text=outputText(response).trim();
    if(!text)return json(502,{ok:false,error:'The model returned no component copy.'});
    return json(200,{ok:true,text,modelUsed:response._model_used||model});
  }catch(error){
    console.error('produce-component-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{
      ok:false,
      error:String(error?.message||'Supporting component production failed.'),
      details:error?.details
    });
  }
};
