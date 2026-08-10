import { TABLES, airtableRequest, cleanRecord, json, listAll, pick, publicError, readJson } from './_airtable.mjs';

const FIELDS=['Publication Name','Short Code','Status','Weekly Send Target'];

export default async (request) => {
  try {
    const method=String(request.method||'GET').toUpperCase();
    if(method==='GET'){
      const records = await listAll(TABLES.publications);
      const active = records
        .map(cleanRecord)
        .filter(({ fields }) => !['Archived', 'Inactive'].includes(fields.Status))
        .sort((a, b) => String(a.fields['Publication Name'] || '').localeCompare(String(b.fields['Publication Name'] || '')));
      return json(200, { ok: true, records: active, count: active.length });
    }
    if(method==='POST'){
      const data=await readJson(request);
      const fields=pick(data.fields,FIELDS);
      const name=String(fields['Publication Name']||'').trim();
      if(!name)return json(400,{ok:false,error:'Publication Name is required.'});
      const existing=(await listAll(TABLES.publications)).map(cleanRecord).find(r=>String(r.fields['Publication Name']||'').trim().toLowerCase()===name.toLowerCase());
      if(existing)return json(409,{ok:false,error:`${name} already exists.`,record:existing});
      if(!fields.Status)fields.Status='Active';
      const result=await airtableRequest(TABLES.publications,{method:'POST',body:{fields,typecast:true}});
      return json(201,{ok:true,record:cleanRecord(result)});
    }
    return json(405,{ok:false,error:'Method not allowed'});
  } catch (error) {
    return publicError(error, 'publications');
  }
};
