import {json} from './_airtable.mjs';
import {diagnoseOpenAI} from './_openai.mjs';
export default async()=>{
  try{return json(200,await diagnoseOpenAI())}
  catch(error){return json(error.status||500,{ok:false,error:error.message,details:error.details||null})}
};
