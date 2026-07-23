import {TABLES,airtableRequest,cleanRecord,json,publicError,readJson} from './_airtable.mjs';
import {cleanUrl,createResponse,outputText,parseJsonText} from './_openai.mjs';

const ALLOWED_CLASSES=new Set(['A — Question Only','B — Light Proof','C — Evidence Heavy']);
const value=(f,k)=>f?.[k]??'';

const TOTAL_BUDGET_MS=175000;
function withTimeout(promise,timeoutMs,label){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(`${label} timed out after ${Math.round(timeoutMs/1000)} seconds`);e.status=408;reject(e)},timeoutMs)});
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
function stripRuntimeBlocks(notes){
  return String(notes||'')
    .replace(/\n?MASTER ARTICLE RUNNING v2\.\d+[\s\S]*?END MASTER ARTICLE RUNNING\s*/g,'')
    .replace(/\n?MASTER ARTICLE FAILED v2\.\d+[\s\S]*?END MASTER ARTICLE FAILED\s*/g,'')
    .replace(/\n?MASTER ARTICLE TRACE v1[\s\S]*?END MASTER ARTICLE TRACE\s*/g,'')
    .trim();
}

function productionClass(fields){
  const type=String(value(fields,'Section Type')).toLowerCase();
  const status=String(value(fields,'Evidence Status'));
  const blob=[value(fields,'Section Title'),value(fields,'Core Reader Question')].join(' ').toLowerCase();
  if(status==='Question Only'||/intro|outro/.test(type))return 'A — Question Only';
  if(/water|sewage|drainage|nhs|dentist|health service|mortgage|debt|conveyanc|solicitor|survey|deposit|house|property|heat pump|air con|hosepipe|ban|sandringham|university|apprentice|road|diversion/.test(blob))return 'C — Evidence Heavy';
  return 'B — Light Proof';
}

function researchPromptFor(fields,cls){
  const localProof=String(value(fields,'Local Proof Needed')||'').trim();
  const evidence=String(value(fields,'Evidence Required')||'').trim();
  const title=String(value(fields,'Section Title')||'').trim();
  const question=String(value(fields,'Core Reader Question')||'').trim();
  return `You are the evidence researcher for a local-news MASTER ARTICLE. Research BEFORE drafting.

ARTICLE
Title: ${title}
Core question: ${question}
Local proof required: ${localProof}
Evidence required: ${evidence}
Production class: ${cls}

RESEARCH RULES
- Search the current web thoroughly.
- Prefer primary/official sources: local councils, GOV.UK, regulators, NHS/NICE, water companies, transport/highway bodies, official venue/business pages, official menus and ticket pages.
- The returned evidence MUST satisfy the LOCAL PROOF requirement, not merely provide generic national background.
- When the brief requires local proof, include genuinely place-specific or directly relevant regional primary sources for the named publication area. Generic national background is not enough.
- If the brief names a body such as Anglian Water, NHS, NICE, FCA, MoneyHelper, a promoter, ticket agent or local council, actively search that body.
- Current prices, dates, availability, service details and material current claims require current sources.
- Do not invent a source or claim.
- If adequate evidence cannot be found, say so explicitly.

Return ONLY valid JSON:
{
 "research_status":"Sufficient or Insufficient",
 "research_summary":"short description of what was verified and what remains uncertain",
 "sources":[{"title":"","url":"clean raw URL","supports":"specific claim(s) this source supports","source_type":"official/local/primary/other"}],
 "missing_evidence":["anything required by the brief that could not be verified"]
}
Return 2-8 strongest sources. Do not pad with irrelevant generic sources.`;
}

function promptFor(fields,cls,research){
  const useEvidence=cls!=='A — Question Only';
  const sourcePack=JSON.stringify(research||{},null,2);
  return `You are the production editor for Spotlight. Build one complete MASTER ARTICLE PACKAGE ready for manual upload to Letterman.

STYLE, AUDIENCE AND SAFETY
- UK English. Research deeply, write simply, sound real.
- Write for an intelligent ordinary reader, not for a literary prize, council report or broadsheet leader column. The copy should feel natural if explained over coffee, at work, on Facebook or in the pub.
- Keep sentences and paragraphs easy to read. Use contractions where natural. Prefer concrete nouns, numbers, examples and actions over polished adjectives or abstract explanation.
- Headline and subhead must be clickable, conversational and specific without becoming misleading or clickbait.
- Apply three reader tests: PUB TEST (would a normal person say it this way?), FACEBOOK TEST (would someone who clicked keep reading?), SO WHAT TEST (does the reader quickly understand why it affects them?).
- Avoid repeated AI-ish constructions and filler such as useful, practical, meaningful, straightforward, key question, important distinction, matters, whether, crucial, navigate, 'The question is…' and 'That matters because…'. Normal one-off use is fine; patterned repetition is not.
- LOCALISATION GATE: the finished article must not be publishable in another location simply by swapping the place name. When the subject supports it, use several verified named towns, roads, venues, businesses, current prices, figures, official decisions or other local examples. Local proof should do real editorial work, not decorate generic copy.
- Genuine local voices or partner-supplied comments may be used when supplied and attributed. NEVER invent reader comments, quotes, consensus or local opinion. If genuine local voices are unavailable, the article may ask readers for them for a follow-up.
- Never invent recommendations, prices, dates, businesses or factual claims.
- Use named local proof only where supported by the supplied research pack.
- Distinguish fact, opinion and reader questions.
- One primary CTA only. The CTA should match the reader's next natural action; do not manufacture a weak button just because a field exists.
- Raw clean destination URLs only.
- Short paragraphs suitable for a narrow article page.
- The article must stand alone outside the newsletter.
- Length is earned by the story: normally 450-850 words. Go longer only when the reader genuinely needs the extra detail; cut repetition rather than padding to a target.
${useEvidence?`- Use ONLY material claims supported by the research pack below.
- If an optional or non-essential detail in the brief could not be verified, OMIT that detail from the article rather than forcing it into the copy.
- A missing optional detail does NOT by itself require QA Fix Required.
- Mark QA Fix Required only when evidence needed to answer the CORE QUESTION is missing, or when the drafted article still contains a material claim that is not adequately supported.
- In evidence_summary, mention useful verification limits without turning every omitted peripheral detail into a publication blocker.`:'- Avoid unnecessary factual claims.'}

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

RESEARCH PACK
${sourcePack}

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
 "evidence_summary":"what was verified and any important limits",
 "sources":[{"title":"","url":"clean raw URL","supports":"claim supported"}],
 "qa_result":"Pass or Fix Required",
 "exception":"blank when Pass"
}
QA DECISION
- Pass: the core reader question is answered with adequate support, and unsupported peripheral details have been omitted.
- Fix Required: a material claim used in the article is unsupported, or evidence essential to the core answer is missing.
- Do not fail an otherwise publishable article merely because the original brief requested extra details that were not needed and were left out.

Use the strongest 1-5 sources from the research pack. Do not include unused sources.`;
}

function evidenceGate(fields,cls,research){
  if(cls==='A — Question Only')return {pass:true,reasons:[]};
  const sources=Array.isArray(research?.sources)?research.sources:[];
  const reasons=[];
  if(research?.research_status!=='Sufficient')reasons.push('Research stage reported insufficient evidence.');
  if(cls==='C — Evidence Heavy'&&sources.length<2)reasons.push('Evidence-heavy article requires at least two relevant sources.');
  const blob=[value(fields,'Section Title'),value(fields,'Core Reader Question'),value(fields,'Local Proof Needed'),value(fields,'Evidence Required')].join(' ').toLowerCase();
  const srcBlob=sources.map(s=>[s.title,s.url,s.supports,s.source_type].join(' ')).join(' ').toLowerCase();
  if(blob.includes('peterborough')&&!/(peterborough|peterborough\.gov\.uk|cambridgeshire|anglianwater)/.test(srcBlob))reasons.push('No Peterborough-specific or directly relevant regional source was returned.');
  if(/anglian water/.test(blob)&&!/anglian/.test(srcBlob))reasons.push('Brief requires Anglian Water evidence but none was returned.');
  if(/nhs|nice/.test(blob)&&!/(nhs|nice)/.test(srcBlob))reasons.push('Brief requires NHS/NICE evidence but none was returned.');
  if(/fca|moneyhelper/.test(blob)&&!/(fca|moneyhelper)/.test(srcBlob))reasons.push('Brief requires FCA/MoneyHelper evidence but none was returned.');
  return {pass:reasons.length===0,reasons};
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
  let runId=(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,10));
  const started=Date.now();
  let selectedSectionId='';
  const log=(stage,extra={})=>console.log('master-article-stage',{runId,stage,elapsedMs:Date.now()-started,...extra});
  try{
    log('request_received',{method:request.method});
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await readJson(request);
    runId=String(data.runId||runId).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||runId;
    log('request_parsed',{sectionId:data.sectionId||'',requestedClass:data.productionClass||''});
    if(!data.sectionId)return json(400,{ok:false,error:'sectionId is required.'});
    selectedSectionId=String(data.sectionId);
    log('airtable_lookup_started');
    const lookup=await airtableRequest(TABLES.sections,{params:{filterByFormula:`RECORD_ID()='${String(data.sectionId).replace(/'/g,"\\'")}'`,maxRecords:'1'}});
    const rawRecord=lookup.records?.[0];
    if(!rawRecord)return json(404,{ok:false,error:'The selected section could not be found in Airtable.'});
    const record=cleanRecord(rawRecord);
    log('airtable_lookup_completed',{recordId:record.id,title:String(record.fields?.['Section Title']||'')});
    const fields=record.fields||{};
    const cls=ALLOWED_CLASSES.has(data.productionClass)?data.productionClass:productionClass(fields);
    const originalNotes=stripRuntimeBlocks(value(fields,'Notes'));
    const runningBlock=[`MASTER ARTICLE RUNNING v2.10`,`Run ID: ${runId}`,`Stage: Researching and writing`,`Started: ${new Date().toISOString()}`,`END MASTER ARTICLE RUNNING`].join('\n');
    await airtableRequest(TABLES.sections,{method:'PATCH',body:{records:[{id:record.id,fields:{'Section Status':'Researching','Evidence Status':'Researching','Notes':originalNotes?`${originalNotes}\n\n${runningBlock}`:runningBlock}}],typecast:true}});
    log('running_marker_saved');
    const traceStarted=Date.now();
    const trace=[];
    const remaining=()=>Math.max(1000,TOTAL_BUDGET_MS-(Date.now()-started));

    const assertRunOwnership=async(label='Run ownership check')=>{
      const latest=await withTimeout(
        airtableRequest(TABLES.sections,{params:{filterByFormula:`RECORD_ID()='${record.id.replace(/'/g,"\\'")}'`,maxRecords:'1'}}),
        16000,
        label
      );
      const latestRecord=latest.records?.[0];
      const latestNotes=String(latestRecord?.fields?.Notes||'');
      const runningBlocks=[...latestNotes.matchAll(/MASTER ARTICLE RUNNING v2\.\d+[\s\S]*?END MASTER ARTICLE RUNNING/g)].map(m=>m[0]);
      const active=runningBlocks[runningBlocks.length-1]||'';
      const ownerLine=active.split('\n').find(line=>line.startsWith('Run ID: '))||'';
      const ownerId=ownerLine.replace('Run ID: ','').trim();
      if(ownerId && ownerId!==runId){
        const e=new Error(`Superseded by newer production run ${ownerId}`);
        e.status=409;
        e.code='RUN_SUPERSEDED';
        throw e;
      }
      return true;
    };
    const traceLine=(stage,status='START',detail='')=>{
      const seconds=Math.round((Date.now()-traceStarted)/1000);
      const line=`${status==='DONE'?'✓':status==='FAIL'?'✖':'▶'} ${stage} · ${seconds}s${detail?` · ${detail}`:''}`;
      trace.push(line);
      return line;
    };
    const saveTrace=async()=>{
      await assertRunOwnership('Trace ownership check');
      const block=[`MASTER ARTICLE TRACE v1`,`Run ID: ${runId}`,...trace.slice(-12),`END MASTER ARTICLE TRACE`].join('\n');
      const notes=originalNotes?`${originalNotes}\n\n${runningBlock}\n\n${block}`:`${runningBlock}\n\n${block}`;
      await withTimeout(
        airtableRequest(TABLES.sections,{
          method:'PATCH',
          body:{records:[{id:record.id,fields:{'Notes':notes}}],typecast:true},
          timeoutMs:15000
        }),
        16000,
        'Diagnostic trace save'
      );
    };
    const stage=async(name,fn,limitMs)=>{
      traceLine(name,'START');
      await saveTrace();
      const stageStart=Date.now();
      try{
        const result=await withTimeout(fn(),Math.min(limitMs,remaining()),name);
        traceLine(name,'DONE',`${Math.round((Date.now()-stageStart)/1000)}s`);
        await saveTrace();
        return result;
      }catch(error){
        traceLine(name,'FAIL',String(error?.message||error).slice(0,220));
        try{await saveTrace()}catch{}
        throw error;
      }
    };
    traceLine('Request accepted','DONE');
    await saveTrace();
    let research={research_status:'Sufficient',research_summary:'Question-only article; no research required.',sources:[],missing_evidence:[]};
    let researchResponse=null;
    if(cls!=='A — Question Only'){
      const researchModel=String(process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
      traceLine('Research model','DONE',researchModel);
      await saveTrace();
      log('research_started',{productionClass:cls,model:researchModel});
      researchResponse=await stage('Research request',()=>createResponse({input:researchPromptFor(fields,cls),useWeb:true,model:researchModel,timeoutMs:65000}),70000);
      log('research_completed',{model:researchResponse._model_used||'',outputChars:outputText(researchResponse).length});
      research=parseJsonText(outputText(researchResponse));
      research.sources=(Array.isArray(research.sources)?research.sources:[]).map(s=>({title:String(s.title||''),url:cleanUrl(s.url),supports:String(s.supports||''),source_type:String(s.source_type||'')})).filter(s=>s.url).slice(0,8);
      const gate=evidenceGate(fields,cls,research);
      if(!gate.pass){
        research.research_status='Insufficient';
        research.missing_evidence=[...(Array.isArray(research.missing_evidence)?research.missing_evidence:[]),...gate.reasons];
      }
      log('research_gate_completed',{status:research.research_status,sourceCount:research.sources.length,missing:research.missing_evidence?.length||0});
    }
    const writerModel=String(process.env.OPENAI_WRITER_MODEL||process.env.OPENAI_PRODUCTION_MODEL||researchResponse?._model_used||'gpt-5.6-luna').trim();
    traceLine('Writer model','DONE',writerModel||'auto-select');
    await saveTrace();
    log('openai_started',{productionClass:cls,useWeb:false,model:writerModel||'auto-select'});
    const response=await stage('Writer request',()=>createResponse({input:promptFor(fields,cls,research),useWeb:false,model:writerModel,timeoutMs:65000}),70000);
    log('openai_completed',{model:response._model_used||'',outputChars:outputText(response).length});
    log('json_parse_started');
    const result=parseJsonText(outputText(response));
    log('json_parse_completed',{qaResult:result.qa_result||'',sourceCount:Array.isArray(result.sources)?result.sources.length:0});
    const writerSources=(Array.isArray(result.sources)?result.sources:[]).map(s=>({title:String(s.title||''),url:cleanUrl(s.url),supports:String(s.supports||'')})).filter(s=>s.url);
    const researchSources=(research.sources||[]).map(s=>({title:s.title,url:s.url,supports:s.supports}));
    const merged=[];
    for(const src of [...writerSources,...researchSources])if(src.url&&!merged.some(x=>x.url===src.url))merged.push(src);
    const sources=merged.slice(0,5);
    const gate=evidenceGate(fields,cls,research);
    const qa=(result.qa_result==='Pass'&&gate.pass)?'Pass':'Fix Required';
    if(!gate.pass){
      result.exception=[String(result.exception||'').trim(),...gate.reasons].filter(Boolean).join(' ');
      result.evidence_summary=[String(result.evidence_summary||'').trim(),String(research.research_summary||'').trim(),`Missing evidence: ${(research.missing_evidence||[]).join('; ')}`].filter(Boolean).join(' ');
    }
    const priorNotes=originalNotes.replace(/\n?MASTER ARTICLE PACKAGE v1[\s\S]*?END MASTER ARTICLE PACKAGE\s*/g,'').replace(/\n?PRODUCTION SERVICE v[\d.]+[\s\S]*$/,'').trim();
    const block=packageBlock(result,sources,response._model_used);
    const serviceNotes=[block,'',`PRODUCTION SERVICE v2.10`,`Run ID: ${runId}`,`Class: ${cls}`,`Evidence: ${String(result.evidence_summary||'').trim()||'No summary returned.'}`,`Exception: ${qa==='Pass'?'None':String(result.exception||'Human review required.')}`].join('\n');
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
    log('airtable_save_started',{qaResult:qa,bodyChars:String(result.article_body||'').length});
    await assertRunOwnership('Final save ownership check');
    traceLine('Final Airtable save','START'); await saveTrace();
    const saved=await withTimeout(
      airtableRequest(TABLES.sections,{
        method:'PATCH',
        body:{records:[{id:record.id,fields:update}],typecast:true},
        timeoutMs:20000
      }),
      21000,
      'Final Airtable save'
    );
    traceLine('Final Airtable save','DONE');
    log('airtable_save_completed',{savedRecordId:saved.records?.[0]?.id||''});
    log('request_completed',{qaResult:qa});
    return json(200,{ok:true,record:cleanRecord(saved.records[0]),productionClass:cls,qaResult:qa,sources,articlePackage:parseJsonText(block.split('\n').slice(1,-1).join('\n')),exception:qa==='Pass'?'':String(result.exception||'Human review required.')});
  }catch(error){
    console.error('master-article-failed',{runId,elapsedMs:Date.now()-started,message:error?.message,status:error?.status,details:error?.details,stack:error?.stack});
    if(error?.code==='RUN_SUPERSEDED'){
      return json(409,{ok:false,error:String(error.message||'This run was superseded by a newer production run.'),runId,superseded:true});
    }
    try{
      if(selectedSectionId){
        const lookup=await airtableRequest(TABLES.sections,{params:{filterByFormula:`RECORD_ID()='${selectedSectionId.replace(/'/g,"\\'")}'`,maxRecords:'1'}});
        const current=lookup.records?.[0];
        if(current){
          const notes=stripRuntimeBlocks(current.fields?.Notes||'');
          const failed=[`MASTER ARTICLE FAILED v2.10`,`Run ID: ${runId}`,`Error: ${String(error?.message||'Production failed').slice(0,1000)}`,`Failed: ${new Date().toISOString()}`,`END MASTER ARTICLE FAILED`].join('\n');
          await withTimeout(
            airtableRequest(TABLES.sections,{
              method:'PATCH',
              body:{records:[{id:current.id,fields:{'Section Status':'Researching','Evidence Status':'Researching','Notes':notes?`${notes}\n\n${failed}`:failed}}],typecast:true},
              timeoutMs:18000
            }),
            20000,
            'Failure marker save'
          );
        }
      }
    }catch(markerError){console.error('failure-marker-save-failed',{runId,message:markerError?.message});}
    return publicError(error,'produce-section')
  }
};


export const config={background:true};