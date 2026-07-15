import {TABLES,airtableRequest,cleanRecord,json,listAll,publicError,readJson} from './_airtable.mjs';
import {cleanUrl,createResponse,outputText,parseJsonText} from './_openai.mjs';

const ALLOWED_CLASSES=new Set(['A — Question Only','B — Light Proof','C — Evidence Heavy']);
const value=(f,k)=>f?.[k]??'';

function productionClass(fields){
  const type=String(value(fields,'Section Type')).toLowerCase();
  const status=String(value(fields,'Evidence Status'));
  const blob=[value(fields,'Section Title'),value(fields,'Core Reader Question')].join(' ').toLowerCase();
  if(status==='Question Only'||/intro|outro/.test(type))return 'A — Question Only';
  if(/water|sewage|drainage|nhs|dentist|health service|37\.7|mortgage|debt|conveyanc|solicitor|survey|deposit|house|£250,000|£350,000|£500,000|heat pump|air con|hosepipe|ban|cancel|sandringham|university|apprentice|road|diversion/.test(blob))return 'C — Evidence Heavy';
  return 'B — Light Proof';
}

function promptFor(fields,cls){
  const useEvidence=cls!=='A — Question Only';
  return `You are the production editor for Norfolk Spotlight, a human, lively, specific UK local newsletter.\n\nBuild exactly one newsletter section from the approved Airtable brief below.\n\nSTRICT RULES\n- Never invent a reader quote, local consensus, business recommendation, price, date or factual claim.\n- Use UK English and natural everyday speech. Avoid generic AI phrasing.\n- Specific facts and named Norfolk proof beat generic statements.\n- Use only one primary CTA.\n- Raw destination URLs only: remove UTM and tracking parameters.\n- The article title may ask a provocative question, but the body must distinguish fact from opinion.\n- Keep the article useful and readable, not like a research report.\n- If evidence is insufficient or conflicting, set qa_result to \"Fix Required\" and explain the exception.\n${useEvidence?'- Search the current web and use reliable primary/official sources where possible. Every material current claim must be supportable by the returned sources.':'- Do not search merely to decorate a question-led section. Avoid new factual claims unless necessary.'}\n\nAPPROVED BRIEF\nTitle: ${value(fields,'Section Title')}\nSection type: ${value(fields,'Section Type')}\nProduction class: ${cls}\nReader hook: ${value(fields,'Reader Hook')}\nCore question: ${value(fields,'Core Reader Question')}\nUniversal problem: ${value(fields,'Universal Reader Problem')}\nLocal proof needed: ${value(fields,'Local Proof Needed')}\nEvidence required: ${value(fields,'Evidence Required')}\nCommercial lane: ${value(fields,'Commercial Lane')}\nPrimary action: ${value(fields,'Primary Next Action')}\nCTA type: ${value(fields,'CTA Type')}\nExisting CTA text: ${value(fields,'CTA Text')}\n\nReturn ONLY valid JSON with this exact shape:\n{\n  \"article_title\": \"string\",\n  \"final_copy\": \"Letterman-ready article body without markdown citations or a duplicated title\",\n  \"cta_text\": \"short natural button or reply instruction\",\n  \"evidence_summary\": \"brief explanation of what was verified or why proof was not required\",\n  \"sources\": [{\"title\":\"string\",\"url\":\"raw clean URL\",\"supports\":\"claim supported\"}],\n  \"qa_result\": \"Pass or Fix Required\",\n  \"exception\": \"blank when Pass; otherwise the exact human-review issue\"\n}\nLimit sources to the strongest 1-5. Do not include a source you did not use.`;
}

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await readJson(request);
    if(!data.sectionId)return json(400,{ok:false,error:'sectionId is required.'});
    const record=cleanRecord(await airtableRequest(`${TABLES.sections}/${data.sectionId}`));
    const fields=record.fields||{};
    const cls=ALLOWED_CLASSES.has(data.productionClass)?data.productionClass:productionClass(fields);
    const response=await createResponse({input:promptFor(fields,cls),useWeb:cls!=='A — Question Only'});
    const result=parseJsonText(outputText(response));
    const sources=(Array.isArray(result.sources)?result.sources:[]).map(s=>({title:String(s.title||''),url:cleanUrl(s.url),supports:String(s.supports||'')})).filter(s=>s.url).slice(0,5);
    const qa=result.qa_result==='Pass'?'Pass':'Fix Required';
    const priorNotes=String(value(fields,'Notes')).replace(/\n?PRODUCTION SERVICE v1[\s\S]*$/,'').trim();
    const serviceNotes=[
      'PRODUCTION SERVICE v1',
      `Class: ${cls}`,
      `Evidence: ${String(result.evidence_summary||'').trim()||'No summary returned.'}`,
      `Sources: ${sources.length?sources.map((s,i)=>`${i+1}. ${s.title||s.url} — ${s.url}${s.supports?` — ${s.supports}`:''}`).join('\n'):'None'}`,
      `Exception: ${qa==='Pass'?'None':String(result.exception||'Human review required.')}`
    ].join('\n');
    const update={
      'Section Final Copy':String(result.final_copy||'').trim(),
      'CTA Text':String(result.cta_text||value(fields,'CTA Text')||'').trim(),
      'Source / Reference Link 1':sources[0]?.url||value(fields,'Source / Reference Link 1')||'',
      'Evidence Status':qa==='Pass'?(cls==='A — Question Only'?'Question Only':'Verified'):'Researching',
      'Evidence Checked Date':new Date().toISOString().slice(0,10),
      'Section QA Result':qa,
      'Section Status':qa==='Pass'?'Ready':'Researching',
      'Notes':priorNotes?`${priorNotes}\n\n${serviceNotes}`:serviceNotes
    };
    const saved=await airtableRequest(TABLES.sections,{method:'PATCH',body:{records:[{id:record.id,fields:update}],typecast:true}});
    return json(200,{ok:true,record:cleanRecord(saved.records[0]),productionClass:cls,qaResult:qa,sources,exception:qa==='Pass'?'':String(result.exception||'Human review required.')});
  }catch(error){return publicError(error,'produce-section')}
};
