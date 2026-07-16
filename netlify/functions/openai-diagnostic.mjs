import {json,publicError} from './_airtable.mjs';
import {createResponse,listAccessibleModels,outputText} from './_openai.mjs';

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const models=await listAccessibleModels();
    const textResponse=await createResponse({input:'Reply with exactly: ICS CONNECTION OK',useWeb:false});
    const webResponse=await createResponse({input:'Use web search and reply with exactly: ICS WEB SEARCH OK',useWeb:true});
    return json(200,{
      ok:true,
      message:outputText(textResponse),
      textModelUsed:textResponse._model_used,
      webMessage:outputText(webResponse),
      webModelUsed:webResponse._model_used,
      visibleModelCount:models.length,
      visibleModels:models.slice(0,40)
    });
  }catch(error){return publicError(error,'openai-diagnostic')}
};
