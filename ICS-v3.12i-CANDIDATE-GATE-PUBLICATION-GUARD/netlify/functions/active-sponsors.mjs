import {listAll,cleanRecord,json,publicError} from './_airtable.mjs';

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='GET')return json(405,{ok:false,error:'Method not allowed'});
    const records=await listAll('Active Sponsors');
    return json(200,{ok:true,count:records.length,records:records.map(cleanRecord)});
  }catch(error){
    return publicError(error,'active-sponsors');
  }
};
