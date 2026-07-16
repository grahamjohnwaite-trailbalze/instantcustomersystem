import {json,publicError} from './_airtable.mjs';
import {createResponse,listAccessibleModels,outputText} from './_openai.mjs';

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const models=await listAccessibleModels();
    const response=await createResponse({input:'Reply with exactly: ICS CONNECTION OK',useWeb:false});
    return json(200,{ok:true,message:outputText(response),modelUsed:response._model_used,visibleModelCount:models.length,visibleModels:models.slice(0,40)});
  }catch(error){return publicError(error,'openai-diagnostic')}
};
