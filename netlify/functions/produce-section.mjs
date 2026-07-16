import {TABLES,airtableRequest,cleanRecord,json,publicError,readJson} from './_airtable.mjs';
import {cleanUrl,createResponse,outputText,parseJsonText} from './_openai.mjs';

const ALLOWED_CLASSES=new Set(['A — Question Only','B — Light Proof','C — Evidence Heavy']);
const value=(f,k)=>f?.[k]??'';

function productionClass(fields){
  const type=String(value(fields,'Section Type')).toLowerCase();
  const status=String(value(fields,'Evidence Status'));
  const blob=[value(fields,'Section Title'),value(fields,'Core Reader Question')].join(' ').toLowerCase();
  if(status==='Question Only'||/intro|outro/.test(type))return 'A — Question Only';
  if(/water|sewage|drainage|nhs|dentist|health service|mortgage|debt|conveyanc|solicitor|survey|deposit|house|property|heat pump|air con|hosepipe|ban|sandringham|university|apprentice|road|diversion/.test(blob))return 'C — Evidence Heavy';
  return 'B — Light Proof';
}

function promptFor(fields,cls){
  const useEvidence=cls!=='A — Question Only';
  return `You are the production editor for Norfolk Spotlight. Build one complete MASTER ARTICLE PACKAGE ready for manual upload to Letterman.

STYLE AND SAFETY
- UK English. Human, lively, specific and useful. Avoid generic AI phrasing.
- Never invent quotes, consensus, recommendations, prices, dates, businesses or factual claims.
- Use named Norfolk proof where supported.
- Distinguish fact, opinion and reader questions.
- One primary CTA only.
- Raw clean destination URLs only.
- Short paragraphs suitable for a narrow article page.
- The article must stand alone outside the newsletter.
${useEvidence?'- Search the current web. Prefer official/primary sources. Every material current claim must be supported by a returned source.':'- Do not search merely to decorate a question-led article. Avoid unnecessary factual claims.'}

APPROVED BRIEF
Working title: ${value(fields,'Section Title')}
Article type: ${value(fields,'Section Type')}
Production class: ${cls}
Reader hook: ${value(fields,'Reader Hook')}
Core question: ${value(fields,'Core Reader Question')}
Universal problem: ${value(fields,'Universal Reader Problem')}
Local proof needed: ${value(fields,'Local Proof Needed')}
Evidence required: ${value(fields,'Evidence Required')}
Commercial lane: ${value(fields,'Commercial Lane')}
Commercial pathway: ${value(fields,'Commercial Pathway')}
Primary action: ${value(fields,'Primary Next Action')}
CTA type: ${value(fields,'CTA Type')}
Existing CTA text: ${value(fields,'CTA Text')}

Return ONLY valid JSON in this exact shape:
{
 "article_title":"",
 "article_subhead":"",
 "article_body":"full article body without duplicated title or markdown citations",
 "summary_title":"short title for Letterman article summary",
 "summary_subhead":"one sentence",
 "summary_content":"45-90 word teaser",
 "seo_title":"ideally 50-60 characters",
 "seo_description":"ideally 140-160 characters",
 "url_path":"lowercase-hyphenated-slug-without-leading-slash",
 "keywords":"comma-separated natural keywords",
 "featured_image_brief":"specific image direction; do not claim an image exists",
 "featured_image_alt":"accessible descriptive alt text",
 "newsletter_headline":"shorter scan-friendly headline",
 "newsletter_teaser":"35-70 words that does not give away the whole article",
 "cta_text":"short natural button text",
 "social_facebook":"standalone Facebook caption ending with a natural discussion prompt",
 "social_linkedin":"professional but local LinkedIn caption",
 "social_x":"concise X caption",
 "evidence_summary":"what was verified or why proof was not required",
 "sources":[{"title":"","url":"clean raw URL","supports":"claim supported"}],
 "qa_result":"Pass or Fix Required",
 "exception":"blank when Pass"
}
Limit sources to the strongest 1-5. Do not include unused sources.`;
}

function packageBlock(result,sources,model){
  const payload={
    version:'MASTER_ARTICLE_V1',model_used:model||'',
    article_subhead:String(result.article_subhead||'').trim(),
    summary_title:String(result.summary_title||'').trim(),summary_subhead:String(result.summary_subhead||'').trim(),summary_content:String(result.summary_content||'').trim(),
    seo_title:String(result.seo_title||'').trim(),seo_description:String(result.seo_description||'').trim(),url_path:String(result.url_path||'').trim().replace(/^\/+/,''),keywords:String(result.keywords||'').trim(),
    featured_image_brief:String(result.featured_image_brief||'').trim(),featured_image_alt:String(result.featured_image_alt||'').trim(),
    newsletter_headline:String(result.newsletter_headline||'').trim(),newsletter_teaser:String(result.newsletter_teaser||'').trim(),
    social_facebook:String(result.social_facebook||'').trim(),social_linkedin:String(result.social_linkedin||'').trim(),social_x:String(result.social_x||'').trim(),
    letterman_status:'Ready for Letterman',letterman_article_id:'',published_url:'',newsletter_queue_status:'Not queued',sync_status:'Manual',
    evidence_summary:String(result.evidence_summary||'').trim(),sources
  };
  return `MASTER ARTICLE PACKAGE v1\n${JSON.stringify(payload,null,2)}\nEND MASTER ARTICLE PACKAGE`;
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
    const priorNotes=String(value(fields,'Notes')).replace(/\n?MASTER ARTICLE PACKAGE v1[\s\S]*?END MASTER ARTICLE PACKAGE\s*/g,'').replace(/\n?PRODUCTION SERVICE v1[\s\S]*$/,'').trim();
    const block=packageBlock(result,sources,response._model_used);
    const serviceNotes=[block,'',`PRODUCTION SERVICE v2`,`Class: ${cls}`,`Evidence: ${String(result.evidence_summary||'').trim()||'No summary returned.'}`,`Exception: ${qa==='Pass'?'None':String(result.exception||'Human review required.')}`].join('\n');
    const update={
      'Section Title':String(result.article_title||value(fields,'Section Title')).trim(),
      'Section Final Copy':String(result.article_body||'').trim(),
      'CTA Text':String(result.cta_text||value(fields,'CTA Text')||'').trim(),
      'Source / Reference Link 1':sources[0]?.url||value(fields,'Source / Reference Link 1')||'',
      'Evidence Status':qa==='Pass'?(cls==='A — Question Only'?'Question Only':'Verified'):'Researching',
      'Evidence Checked Date':new Date().toISOString().slice(0,10),
      'Section QA Result':qa,
      'Section Status':qa==='Pass'?'Ready':'Researching',
      'Notes':priorNotes?`${priorNotes}\n\n${serviceNotes}`:serviceNotes
    };
    const saved=await airtableRequest(TABLES.sections,{method:'PATCH',body:{records:[{id:record.id,fields:update}],typecast:true}});
    return json(200,{ok:true,record:cleanRecord(saved.records[0]),productionClass:cls,qaResult:qa,sources,articlePackage:parseJsonText(block.split('\n').slice(1,-1).join('\n')),exception:qa==='Pass'?'':String(result.exception||'Human review required.')});
  }catch(error){return publicError(error,'produce-section')}
};
