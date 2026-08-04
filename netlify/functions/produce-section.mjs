import {TABLES,airtableRequest,cleanRecord,json,publicError,readJson} from './_airtable.mjs';
import {cleanUrl,createResponse,outputText,parseJsonText} from './_openai.mjs';

const ALLOWED_CLASSES=new Set(['A — Question Only','B — Light Proof','C — Evidence Heavy']);
const value=(f,k)=>f?.[k]??'';

const TOTAL_BUDGET_MS=110000;
const RECOVERY_BUDGET_MS=45000;
const RELEASE_VERSION='3.7.1';
function withTimeout(promise,timeoutMs,label){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(`${label} timed out after ${Math.round(timeoutMs/1000)} seconds`);e.status=408;reject(e)},timeoutMs)});
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
function stripRuntimeBlocks(notes){
  return String(notes||'')
    .replace(/\n?MASTER ARTICLE RUNNING v[\d.]+[\s\S]*?END MASTER ARTICLE RUNNING\s*/g,'')
    .replace(/\n?MASTER ARTICLE FAILED v[\d.]+[\s\S]*?END MASTER ARTICLE FAILED\s*/g,'')
    .replace(/\n?MASTER ARTICLE TRACE v1[\s\S]*?END MASTER ARTICLE TRACE\s*/g,'')
    .trim();
}

function briefKey(fields,cls){
  return [cls,String(value(fields,'Section Title')||'').trim().toLowerCase(),String(value(fields,'Core Reader Question')||'').trim().toLowerCase()].join(' | ');
}
function latestCheckpoint(notes,label){
  const re=label==='research'
    ? /MASTER ARTICLE RESEARCH CHECKPOINT v1\n([\s\S]*?)\nEND MASTER ARTICLE RESEARCH CHECKPOINT/g
    : /MASTER ARTICLE WRITER CHECKPOINT v(?:1|2)\n([\s\S]*?)\nEND MASTER ARTICLE WRITER CHECKPOINT/g;
  const all=[...String(notes||'').matchAll(re)];
  if(!all.length)return null;
  try{return JSON.parse(all[all.length-1][1])}catch{return null}
}
function removeCheckpoints(notes){
  return String(notes||'')
    .replace(/\n?MASTER ARTICLE RESEARCH CHECKPOINT v1\n[\s\S]*?\nEND MASTER ARTICLE RESEARCH CHECKPOINT\s*/g,'')
    .replace(/\n?MASTER ARTICLE WRITER CHECKPOINT v(?:1|2)\n[\s\S]*?\nEND MASTER ARTICLE WRITER CHECKPOINT\s*/g,'')
    .trim();
}

function removeWriterCheckpoints(notes){
  return String(notes||'')
    .replace(/\n?MASTER ARTICLE WRITER CHECKPOINT v(?:1|2)\n[\s\S]*?\nEND MASTER ARTICLE WRITER CHECKPOINT\s*/g,'')
    .trim();
}
function parsePipeSourceLine(line){
  const raw=String(line||'').replace(/^Source\s+\d+:\s*/i,'').trim();
  const parts=raw.split(' | ');
  if(parts.length<2)return null;
  const title=String(parts.shift()||'').trim();
  const url=cleanUrl(String(parts.shift()||'').trim());
  let source_type='';
  if(parts.length>1 && /^(official|primary|local|reported|discovery|other)$/i.test(String(parts[0]||'').trim()))source_type=String(parts.shift()||'').trim();
  const supports=parts.join(' | ').trim();
  return url?{title,url,supports,source_type}:null;
}
function lockedResearchFromNotes(notes){
  const text=String(notes||'');
  const packs=[...text.matchAll(/RESEARCH PACK v1\n([\s\S]*?)\nEND RESEARCH PACK/g)];
  if(packs.length){
    const body=packs[packs.length-1][1];
    const evidenceClass=(body.match(/^Evidence Class:\s*(.+)$/mi)||[])[1]?.trim()||'';
    const decision=(body.match(/^Decision:\s*(.+)$/mi)||[])[1]?.trim()||'';
    const missingText=(body.match(/^Missing:\s*(.*)$/mi)||[])[1]?.trim()||'';
    const sources=body.split('\n').filter(x=>/^Source\s+\d+:/i.test(x)).map(parsePipeSourceLine).filter(Boolean);
    return {
      brief_key:'',model:'LOCKED-RESEARCH-PACK-v1',source:'research_pack',
      research:{
        research_status:['VERIFIED_NOW','ATTRIBUTED_REPORT'].includes(evidenceClass)?'Sufficient':'Insufficient',
        research_summary:decision||`Locked research pack retained with evidence class ${evidenceClass||'unknown'}.`,
        sources,
        missing_evidence:missingText&&missingText!=='None recorded'?missingText.split(';').map(x=>x.trim()).filter(Boolean):[],
        locked_evidence_class:evidenceClass
      }
    };
  }
  const blocked=[...text.matchAll(/MASTER ARTICLE BLOCKED v1\n([\s\S]*?)\nEND MASTER ARTICLE BLOCKED/g)];
  if(blocked.length){
    const body=blocked[blocked.length-1][1];
    const reason=(body.match(/^Reason:\s*(.+)$/mi)||[])[1]?.trim()||'';
    const missingText=(body.match(/^Missing:\s*(.*)$/mi)||[])[1]?.trim()||'';
    const sources=body.split('\n').filter(x=>/^Source\s+\d+:/i.test(x)).map(parsePipeSourceLine).filter(Boolean);
    if(sources.length){
      return {
        brief_key:'',model:'LOCKED-BLOCKED-EVIDENCE-v1',source:'blocked_evidence',
        research:{research_status:'Insufficient',research_summary:reason||'Locked source-check evidence retained from an earlier research run.',sources,missing_evidence:missingText?missingText.split(';').map(x=>x.trim()).filter(Boolean):[]}
      };
    }
  }
  return null;
}
function researchCheckpointBlock(key,research,model){
  return `MASTER ARTICLE RESEARCH CHECKPOINT v1\n${JSON.stringify({brief_key:key,saved_at:new Date().toISOString(),model:model||'',research},null,2)}\nEND MASTER ARTICLE RESEARCH CHECKPOINT`;
}
function researchKey(research){
  const sources=(Array.isArray(research?.sources)?research.sources:[]).map(x=>({
    url:cleanUrl(x.url),title:String(x.title||'').trim(),supports:String(x.supports||'').trim(),source_type:String(x.source_type||'').trim()
  })).sort((a,b)=>a.url.localeCompare(b.url));
  const resolved=research?.resolved_subject&&typeof research.resolved_subject==='object'?research.resolved_subject:{};
  return JSON.stringify({
    status:String(research?.research_status||''),
    summary:String(research?.research_summary||''),
    resolved_subject:resolved,
    sources,
    required_now_missing:Array.isArray(research?.required_now_missing)?research.required_now_missing:[],
    future_tests:Array.isArray(research?.future_tests)?research.future_tests:[],
    optional_missing:Array.isArray(research?.optional_missing)?research.optional_missing:[],
    missing_evidence:Array.isArray(research?.missing_evidence)?research.missing_evidence:[]
  });
}
function writerCheckpointBlock(key,researchKeyValue,raw,model){
  return `MASTER ARTICLE WRITER CHECKPOINT v2\n${JSON.stringify({brief_key:key,research_key:String(researchKeyValue||''),saved_at:new Date().toISOString(),model:model||'',raw_output:String(raw||'')},null,2)}\nEND MASTER ARTICLE WRITER CHECKPOINT`;
}

function productionClass(fields){
  const type=String(value(fields,'Section Type')).toLowerCase();
  const status=String(value(fields,'Evidence Status'));
  const blob=[value(fields,'Section Title'),value(fields,'Core Reader Question')].join(' ').toLowerCase();
  if(status==='Question Only'||/intro|outro/.test(type))return 'A — Question Only';
  if(/water|sewage|drainage|nhs|dentist|health service|mortgage|debt|conveyanc|solicitor|survey|deposit|house|property|heat pump|air con|hosepipe|ban|sandringham|university|apprentice|road|diversion/.test(blob))return 'C — Evidence Heavy';
  return 'B — Light Proof';
}


function decodeXml(s=''){
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function stripTags(s=''){return decodeXml(String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function rssTextBetween(block,tag){const m=block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?stripTags(m[1]):''}
function hostOf(url=''){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
async function fetchTextFast(url,timeoutMs=6500){
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 TBOS-Evidence-Collector/1.0','accept':'application/rss+xml, application/xml, text/xml, text/html, */*'},signal:c.signal,redirect:'follow'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return {text:await r.text(),url:r.url||url,contentType:r.headers.get('content-type')||''};
  }finally{clearTimeout(timer)}
}
function parseRssEvidence(xml,query,provider){
  const items=String(xml||'').match(/<item\b[\s\S]*?<\/item>/gi)||[];
  return items.slice(0,10).map(item=>{
    const title=rssTextBetween(item,'title');
    const url=rssTextBetween(item,'link');
    const description=rssTextBetween(item,'description');
    const source=rssTextBetween(item,'source')||hostOf(url)||provider;
    return {title,url,description,source,query,provider};
  }).filter(x=>x.title&&x.url);
}
function bingWebUrl(q){return `https://www.bing.com/search?format=rss&setlang=en-GB&q=${encodeURIComponent(q)}`}
function googleNewsUrl(q){return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`}
function sourceTypeFor(url='',title=''){
  const h=hostOf(url),blob=(h+' '+title).toLowerCase();
  if(/\.gov\.uk$|gov\.uk|nhs\.uk|nice\.org\.uk|police\.uk|parliament\.uk|abta\.com|fca\.org\.uk|caa\.co\.uk|ofcom\.org\.uk|ofgem\.gov\.uk|ombudsman|official/.test(blob))return 'official';
  if(/norfolk|edp24|eastern daily press|bbc\.co\.uk|itv\.com/.test(blob))return 'local';
  return 'other';
}

const STOPWORDS=new Set('the a an and or but if then than to of in on at for from with by as is are was were be been being this that these those what which who will would should could can do does did have has had your our their its more before after about into near beside new local says say reported reports report despite strong opposition actually change changes changing current latest plan plans planning article'.split(/\s+/));
function tokens(s=''){
  return [...new Set(String(s).toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOPWORDS.has(w)))];
}
function evidenceFingerprint(x){
  const u=cleanUrl(x.url||'');
  let canonical=u;
  try{
    const parsed=new URL(u);
    canonical=(parsed.hostname.replace(/^www\./,'')+parsed.pathname).replace(/\/+$/,'').toLowerCase();
  }catch{}
  const title=tokens(x.title||'').slice(0,12).sort().join(' ');
  return canonical+' | '+title;
}
function relevanceScore(x,fields){
  const title=String(value(fields,'Section Title')||'');
  const q=String(value(fields,'Core Reader Question')||'');
  const proof=String(value(fields,'Local Proof Needed')||'');
  const notes=String(value(fields,'Notes')||'');
  const current=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const need=tokens([title,q,proof,current].join(' '));
  const hay=new Set(tokens([x.title,x.description,x.source,x.url].join(' ')));
  let score=0;
  for(const w of need)if(hay.has(w))score+=1;
  const blob=[x.title,x.description,x.source,x.url].join(' ').toLowerCase();
  // Strong anchors for local article identity.
  if(/\ba149\b/i.test(title+' '+q)&&/\ba149\b/i.test(blob))score+=5;
  if(/\bnorfolk\b/i.test(title+' '+q+' '+proof)&&/\bnorfolk\b/i.test(blob))score+=2;
  const specific=tokens(title).filter(w=>!['norfolk'].includes(w));
  if(specific.filter(w=>hay.has(w)).length>=2)score+=2;
  return score;
}
function sameStory(a,b){
  const A=new Set(tokens(a.title||'')),B=new Set(tokens(b.title||''));
  if(!A.size||!B.size)return false;
  const overlap=[...A].filter(x=>B.has(x)).length;
  return overlap/Math.min(A.size,B.size)>=0.72;
}

const GENERIC_HOSTS=new Set(['wikipedia.org','simple.wikipedia.org','mayoclinic.org','britannica.com','dictionary.com','merriam-webster.com','wiktionary.org']);
function genericDriftSource(x){
  const h=hostOf(x.url||'').toLowerCase();
  if([...GENERIC_HOSTS].some(g=>h===g||h.endsWith('.'+g)))return true;
  const blob=[x.title,x.description].join(' ').toLowerCase();
  return /definition of|simple english wikipedia|symptoms and causes|dictionary|encyclopedia/.test(blob);
}
function wrongGeographySource(x,fields){
  const article=[value(fields,'Section Title'),value(fields,'Core Reader Question'),value(fields,'Local Proof Needed'),value(fields,'Notes')].join(' ').toLowerCase();
  const blob=[x.title,x.description,x.source,x.url].join(' ').toLowerCase();
  // Prevent same-name US places from passing a UK locality match (for example Norfolk, Virginia).
  if(/\bnorfolk\b/.test(article)&&/virginia|hampton roads|virginia beach|chesapeake|wtkr\.com|13newsnow|wavy\.com/.test(blob))return true;
  if(/\bsuffolk\b/.test(article)&&/suffolk county,? new york|long island|virginia/.test(blob))return true;
  return false;
}
function editorAuthoritativeEvidence(fields){
  const notes=String(value(fields,'Notes')||'');
  const matches=[...notes.matchAll(/AUTHORITATIVE EVIDENCE UPDATE v2\n([\s\S]*?)\nEND AUTHORITATIVE EVIDENCE UPDATE/g)];
  const block=matches.length?String(matches[matches.length-1][1]||''):'';
  const url=cleanUrl((block.match(/^URL:\s*(https?:\/\/\S+)/mi)||[])[1]||'');
  const title=String((block.match(/^TITLE:\s*(.*)$/mi)||[])[1]||'').trim();
  const text=String((block.match(/EVIDENCE TEXT:\s*\n---\s*\n([\s\S]*?)\n---\s*\nSTATUS:/i)||[])[1]||'').trim();
  return {url,title,text};
}
function editorAuthoritativeSourceUrl(fields){
  const direct=cleanUrl(String(value(fields,'Source / Reference Link 1')||'').trim());
  const notes=String(value(fields,'Notes')||'');
  const v2=editorAuthoritativeEvidence(fields).url;
  const marked=(notes.match(/AUTHORITATIVE SOURCE UPDATE v1[\s\S]*?URL:\s*(https?:\/\/\S+)/i)||[])[1]||'';
  return v2||direct||cleanUrl(marked);
}
async function editorAuthoritativeSource(fields){
  const supplied=editorAuthoritativeEvidence(fields);
  const url=supplied.url||editorAuthoritativeSourceUrl(fields);
  if(!url)return null;
  let fetched='',fetchWarning='';
  try{
    const response=await fetchTextFast(url);
    fetched=stripTags(String(response.text||'')).replace(/\s+/g,' ').trim().slice(0,9000);
  }catch(error){
    fetchWarning=String(error?.message||error).slice(0,240);
  }
  const editorText=String(supplied.text||'').replace(/\s+/g,' ').trim().slice(0,12000);
  const description=[
    editorText?`EDITOR-CONFIRMED SOURCE TEXT: ${editorText}`:'',
    fetched?`DIRECT PAGE EXTRACTION: ${fetched}`:'',
    fetchWarning?`DIRECT EXTRACTION WARNING: ${fetchWarning}. Editor-supplied evidence text retained and must be assessed against the source URL.`:''
  ].filter(Boolean).join(' ');
  return {
    title:supplied.title||hostOf(url)||'Editor-supplied authoritative source',
    url,
    description:description||`Editor supplied this URL as an authoritative source for the article.`,
    source:hostOf(url),query:'editor authoritative evidence',provider:'EDITOR',
    relevance:editorText?15:12,seeded_editor:true,editor_confirmed_text:Boolean(editorText),fetch_warning:Boolean(fetchWarning)
  };
}
function currentDiscoverySource(fields){
  const notes=String(value(fields,'Notes')||'');
  const line=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const provenance=(notes.match(/Plan provenance:\s*([^\n]+)/i)||[])[1]||'';
  const url=(provenance.match(/https?:\/\/\S+/i)||line.match(/https?:\/\/\S+/i)||[])[0]||'';
  if(!line||!url)return null;
  const parts=line.split('|').map(x=>x.trim());
  const headline=String(parts[0]||'').replace(/^Lead\s+\d+:\s*/i,'').trim();
  const publisher=String(parts[1]||'').trim();
  return {
    title:[headline,publisher].filter(Boolean).join(' — '),
    url:cleanUrl(url),
    description:`Current discovery lead supplied by the locked Smart Plan. Publisher: ${publisher||'not stated'}. This is discovery/corroboration, not primary authority.`,
    source:publisher||'Current discovery lead',
    query:'locked smart plan',provider:'SMART-PLAN',relevance:8,seeded_discovery:true
  };
}
function precisionAnchors(fields){
  const title=String(value(fields,'Section Title')||'');
  const q=String(value(fields,'Core Reader Question')||'');
  const proof=String(value(fields,'Local Proof Needed')||'');
  const notes=String(value(fields,'Notes')||'');
  const current=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const all=[title,q,proof,current].join(' ');
  const entities=[...new Set((all.match(/\bA\d{1,3}\b|\bNorfolk\b|\bSuffolk\b|\bSEND\b|\bNHS\b|\bGigabit\b|\bKing'?s Lynn\b|\bGreat Yarmouth\b|\bNorwich\b|\bCromer\b|\bHunstanton\b/gi)||[]).map(x=>x.toLowerCase()))];
  const topicGroups=[];
  if(/housing|homes|estate|developer|planning/i.test(all))topicGroups.push(['housing','homes','estate','developer','planning','development']);
  if(/road|traffic|junction|transport|a\d+/i.test(all))topicGroups.push(['road','traffic','junction','transport','a149','highway']);
  if(/drain|flood|water|sewage/i.test(all))topicGroups.push(['drainage','flood','water','sewage','surface']);
  if(/speed|police|enforcement/i.test(all))topicGroups.push(['speeding','speed','police','enforcement','motorist']);
  if(/library/i.test(all))topicGroups.push(['library','libraries']);
  if(/obesity|health|nhs/i.test(all))topicGroups.push(['obesity','health','nhs']);
  if(/gigabit|broadband|internet/i.test(all))topicGroups.push(['gigabit','broadband','internet']);
  return {entities,topicGroups};
}
function precisionPass(x,fields){
  if(genericDriftSource(x)||wrongGeographySource(x,fields))return false;
  const blob=[x.title,x.description,x.source,x.url].join(' ').toLowerCase();
  const {entities,topicGroups}=precisionAnchors(fields);
  const entityHits=entities.filter(e=>blob.includes(e)).length;
  const topicHits=topicGroups.filter(group=>group.some(w=>blob.includes(w))).length;
  // Specific road/entity identifiers are strong enough with a matching topic.
  if(entities.some(e=>/^a\d+$/i.test(e))&&entityHits>=1&&topicHits>=1)return true;
  // Otherwise require locality/entity plus topic identity, or two independent topic groups.
  if(entityHits>=1&&topicHits>=1)return true;
  if(topicHits>=2)return true;
  return false;
}
function articleSearchTerms(fields){
  const title=String(value(fields,'Section Title')||'').trim();
  const q=String(value(fields,'Core Reader Question')||'').trim();
  const proof=String(value(fields,'Local Proof Needed')||'').trim();
  const evidence=String(value(fields,'Evidence Required')||'').trim();
  const notes=String(value(fields,'Notes')||'');
  const current=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const compact=s=>String(s||'').replace(/[—–:?!(),"']/g,' ').replace(/\s+/g,' ').trim();
  const key=[title,q].join(' ').match(/\b[A-Z]\d{1,3}\b|\bNorfolk\b|\bSEND\b|\bGigabit\b|\bpothole\w*\b|\bhousing\b|\btravel hub\b|\bobesity\b|\blibrar\w*\b|\bspeeding\b|\bsurvey\b/gi)||[];
  const base=[...new Set(key.map(x=>x.toLowerCase()))].join(' ');
  const editorUrl=editorAuthoritativeSourceUrl(fields);
  const queries=[
    compact(title),
    compact(`${base} ${q}`).slice(0,180),
    compact(current).slice(0,180),
    compact(`site:norfolk.gov.uk ${base} ${title}`).slice(0,180),
    compact(`site:gov.uk ${base} ${title}`).slice(0,180)
  ].filter(Boolean);
  if(editorUrl){try{const h=new URL(editorUrl).hostname.replace(/^www\./,'');queries.unshift(compact(`site:${h} ${title}`));}catch{}}
  if(/nhs|obesity|health|send/i.test(title+' '+q+' '+evidence))queries.push(compact(`site:nhs.uk Norfolk ${title}`).slice(0,180));
  if(/police|speed/i.test(title+' '+q))queries.push(compact(`site:norfolk.police.uk ${title}`).slice(0,180));
  if(/planning|housing|a149|self-build/i.test(title+' '+q+' '+proof))queries.push(compact(`Norfolk planning ${title}`).slice(0,180));
  if(/pothole|road repair|highway repair/i.test(title+' '+q+' '+proof+' '+current)){
    queries.unshift(compact(`"${current.replace(/\|.*$/,'').replace(/^Lead\s+\d+:\s*/i,'').trim()}"`).slice(0,180));
    queries.push('site:norfolk.gov.uk Norfolk County Council pothole repair trial techniques');
    queries.push('site:gov.uk pothole repair reporting repeat repairs council 2026');
  }
  return [...new Set(queries)].slice(0,9);
}
async function fastEvidencePack(fields,cls){
  if(cls==='A — Question Only')return {research_status:'Sufficient',research_summary:'Question-only article; no research required.',sources:[],missing_evidence:[]};
  const queries=articleSearchTerms(fields);
  const jobs=[];
  for(const q of queries.slice(0,5))jobs.push(fetchTextFast(bingWebUrl(q)).then(r=>parseRssEvidence(r.text,q,'Bing Web RSS')));
  for(const q of queries.slice(0,3))jobs.push(fetchTextFast(googleNewsUrl(q)).then(r=>parseRssEvidence(r.text,q,'Google News RSS')));
  const settled=await Promise.allSettled(jobs);
  let raw=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  const discovery=currentDiscoverySource(fields);
  if(discovery)raw.unshift(discovery);
  const editorSource=await editorAuthoritativeSource(fields);
  if(editorSource)raw.unshift(editorSource);
  // Reject off-topic and wrong-country results before they ever reach Writer. An editor-supplied URL is deliberately retained for qualification.
  raw=raw.map(x=>({...x,relevance:Number(x.relevance||relevanceScore(x,fields))})).filter(x=>x.seeded_editor||(x.relevance>=3&&precisionPass(x,fields)));
  raw.sort((a,b)=>b.relevance-a.relevance);
  const seen=new Set(),dedup=[];
  for(const x of raw){
    const k=evidenceFingerprint(x);
    if(!k||seen.has(k))continue;
    if(dedup.some(y=>sameStory(x,y)))continue;
    seen.add(k);dedup.push(x);
  }
  // Prefer relevance first, then official/local authority.
  dedup.sort((a,b)=>{
    const rank=x=>sourceTypeFor(x.url,x.source)==='official'?0:sourceTypeFor(x.url,x.source)==='local'?1:2;
    return b.relevance-a.relevance||rank(a)-rank(b)||(b.description?.length||0)-(a.description?.length||0);
  });
  const chosen=dedup.slice(0,6).map(x=>({
    title:String(x.title||x.source||'').slice(0,220),
    url:cleanUrl(x.url),
    supports:String(x.description||`Discovery result for: ${x.query}`).slice(0,700),
    source_type:x.seeded_discovery?'discovery':x.seeded_editor?(sourceTypeFor(x.url,x.source)==='other'?'primary':sourceTypeFor(x.url,x.source)):sourceTypeFor(x.url,x.source),
    relevance:x.relevance
  })).filter(x=>x.url);
  const official=chosen.filter(x=>x.source_type==='official').length;
  const local=chosen.filter(x=>x.source_type==='local').length;
  const specificStrong=chosen.filter(x=>Number(x.relevance)>=5).length;
  // One decisive, editor-confirmed official source can establish the core claim by itself.
  // This is essential for regulator/trade-body notices that directly state the event,
  // date, responsible body and reader action, even when the publisher blocks fetching.
  const decisiveEditorOfficial=Boolean(
    editorSource?.editor_confirmed_text &&
    sourceTypeFor(editorSource.url,editorSource.source)==='official' &&
    Number(editorSource.relevance||0)>=15 &&
    String(editorSource.description||'').includes('EDITOR-CONFIRMED SOURCE TEXT:') &&
    String(editorSource.description||'').length>=220
  );
  const sufficient=decisiveEditorOfficial||(chosen.length>=2&&(official+local>=1)&&specificStrong>=1&&chosen.every(x=>Number(x.relevance)>=3));
  return {
    research_status:sufficient?'Sufficient':'Insufficient',
    research_summary:decisiveEditorOfficial
      ?`Decisive editor-confirmed official source retained. It may establish the core article premise and reader action without source-count padding.`
      :`Source precision gate retained ${chosen.length} distinct article-specific source leads (${official} official, ${local} local; ${specificStrong} strongly matched). Generic reference pages, duplicate stories and sources without the article's entity/topic anchors were removed before writing.`,
    sources:chosen,
    decisive_editor_source:decisiveEditorOfficial,
    core_evidence_relaxed:decisiveEditorOfficial,
    missing_evidence:sufficient?[]:['The source precision gate found too little distinct article-specific evidence. It will not pad the pack with generic or tangential sources. Human verification is required before publication.']
  };
}


function independentQuestionRecoveryEligible(fields){
  const title=String(value(fields,'Section Title')||'');
  const question=String(value(fields,'Core Reader Question')||'');
  const notes=String(value(fields,'Notes')||'');
  const blob=`${title} ${question}`.toLowerCase();
  const story=`${title} ${notes}`.toLowerCase();
  const guideShape=/\b(how|which|what|where|guide|tips?|ways?|best|worth|parents?|famil(?:y|ies)|children|things to do|events?|books?|save|compare|choose|find)\b/.test(blob);
  const hardSpecific=/\b(liquidation|insolven|administrator|court|charged|arrest|crash|collision|death|dies|closure|closes|planning decision|approved|refused|investigation|fraud|fire|company enters|council vote|election result)\b/.test(story);
  return guideShape&&!hardSpecific;
}
function independentQuestionSearchTerms(fields){
  const title=String(value(fields,'Section Title')||'').trim();
  const q=String(value(fields,'Core Reader Question')||'').trim();
  const compact=x=>String(x||'').replace(/[—–:?!(),"']/g,' ').replace(/\s+/g,' ').trim();
  const terms=[
    compact(q),
    compact(`Norfolk ${q}`),
    compact(title),
    compact(`Norfolk ${title}`)
  ];
  if(/child|read|book|liter/i.test(`${title} ${q}`)){
    terms.push(compact(`Norfolk libraries ${q}`));
    terms.push(compact(`site:booktrust.org.uk ${q}`));
  }
  if(/event|what's on|things to do|literary|author/i.test(`${title} ${q}`)){
    terms.push(compact(`site:visitnorfolk.com Norfolk August 2026 literary events books authors`));
    terms.push(compact(`site:norfolk.gov.uk libraries events Norfolk August 2026`));
  }
  return [...new Set(terms.filter(Boolean))].slice(0,7);
}
async function fastIndependentQuestionPack(fields,cls){
  if(!independentQuestionRecoveryEligible(fields))return null;
  const queries=independentQuestionSearchTerms(fields);
  const jobs=[];
  for(const q of queries.slice(0,5))jobs.push(fetchTextFast(bingWebUrl(q)).then(r=>parseRssEvidence(r.text,q,'Bing Web RSS')));
  for(const q of queries.slice(0,2))jobs.push(fetchTextFast(googleNewsUrl(q)).then(r=>parseRssEvidence(r.text,q,'Google News RSS')));
  const settled=await Promise.allSettled(jobs);
  let raw=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  raw=raw.filter(x=>!genericDriftSource(x)&&!wrongGeographySource(x,fields));
  raw=raw.map(x=>({...x,relevance:Number(x.relevance||relevanceScore(x,fields))})).filter(x=>x.relevance>=2);
  raw.sort((a,b)=>b.relevance-a.relevance);
  const seen=new Set(),chosen=[];
  for(const x of raw){
    const url=cleanUrl(x.url); if(!url)continue;
    const k=evidenceFingerprint(x); if(!k||seen.has(k)||chosen.some(y=>sameStory(x,y)))continue;
    seen.add(k);
    chosen.push({title:String(x.title||x.source||'').slice(0,220),url,supports:String(x.description||`Search result for: ${x.query}`).slice(0,700),source_type:sourceTypeFor(url,x.source),relevance:x.relevance});
    if(chosen.length>=6)break;
  }
  const strong=chosen.filter(x=>/official|primary|local/i.test(x.source_type)||/\.gov\.uk|gov\.uk|nhs\.uk|visitnorfolk\.com|booktrust\.org\.uk/i.test(x.url)).length;
  if(chosen.length<2||strong<1)return null;
  return {
    research_status:'Sufficient',
    research_summary:`Independent question recovery found ${chosen.length} relevant sources after the original discovery lead could not carry the article. The article should answer the approved reader question from these sources rather than write about the failed source search.`,
    sources:chosen,
    required_now_missing:[],future_tests:[],optional_missing:[],missing_evidence:[],
    resolved_subject:{name:String(value(fields,'Core Reader Question')||value(fields,'Section Title')||'Approved reader question'),location:'Norfolk, England',responsible_body:'Independent verified sources',reference:'Question-first recovery',confidence:'medium'},
    recovery_used:true,recovery_model:'FAST-INDEPENDENT-QUESTION-v1',independent_question_recovery:true
  };
}

function mergeEvidenceSources(primary=[],secondary=[]){
  const out=[],seen=new Set();
  for(const src of [...primary,...secondary]){
    const url=cleanUrl(src?.url||'');
    if(!url||seen.has(url))continue;
    seen.add(url);
    out.push({
      title:String(src?.title||'').trim().slice(0,220),
      url,
      supports:stripTags(String(src?.supports||'')).trim().slice(0,900),
      source_type:String(src?.source_type||sourceTypeFor(url,src?.title||'')).trim()||'other',
      relevance:Number(src?.relevance||0)
    });
  }
  return out.slice(0,8);
}
function recoveryResearchPrompt(fields,cls,firstPass){
  const title=String(value(fields,'Section Title')||'').trim();
  const question=String(value(fields,'Core Reader Question')||'').trim();
  const proof=String(value(fields,'Local Proof Needed')||'').trim();
  const evidence=String(value(fields,'Evidence Required')||'').trim();
  const notes=String(value(fields,'Notes')||'');
  const current=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const provenance=(notes.match(/Plan provenance:\s*([^\n]+)/i)||[])[1]||'';
  return `You are the bounded second-pass evidence researcher for one UK local-news article.

ARTICLE
Title: ${title}
Question: ${question}
Current discovery lead: ${current||'Not supplied'}
Plan provenance: ${provenance||'Not supplied'}
Local proof needed: ${proof||'Not supplied'}
Evidence needed: ${evidence||'Not supplied'}
Class: ${cls}

FAST PASS
${JSON.stringify(firstPass||{},null,2)}

TASK
1. Resolve the exact real-world subject first. Do not substitute a different project when the article is about a specific company, decision, incident, scheme or named event.
2. QUESTION-FIRST RECOVERY: if the discovery article itself is unavailable but the approved brief is a guide/advice/recommendation question rather than a specific breaking-news claim, you MAY abandon the discovery article as the spine and answer the approved reader question independently from credible primary, official and genuinely local sources. In that case, do not write a meta-story about the source being unavailable.
3. For guide/list/event briefs, it is acceptable to build a fresh verified set of examples that answers the reader question; do not require proof that those examples appeared in the original discovery article. Verify every example directly and state only supported details.
4. If enough independent evidence cannot answer the approved question well, return Insufficient so the item can be RETRY / REPLACE. Do not invent an article about failed research.
5. This publication means Norfolk, England. Reject Norfolk, Virginia and other same-name places.
3. For roads/potholes, identify the accountable highway authority and find the most direct official council, committee, contract, scheme or GOV.UK source.
4. The supplied newspaper/RSS lead is discovery only. It may establish what to search for, but primary/official evidence should support material reader-facing facts where available.
5. Return no more than 4 distinct sources. Map each source to a specific claim. Do not pad.
6. Separate missing evidence by timing:
   - REQUIRED_NOW blocks publication today.
   - FUTURE_TEST is an outcome not yet knowable and must be framed as a question, not a blocker.
   - OPTIONAL may be omitted.
7. A trial can be written about before results exist only when its existence, responsible body and present purpose are verified.
8. If the exact subject cannot be verified, return Insufficient and say what identity or official confirmation is missing.

Return ONLY valid JSON:
{"research_status":"Sufficient or Insufficient","resolved_subject":{"name":"","location":"","responsible_body":"","reference":"","confidence":"high/medium/low"},"research_summary":"","sources":[{"title":"","url":"","supports":"","source_type":"official/primary/local/discovery/other","reader_facing":true}],"required_now_missing":[],"future_tests":[],"optional_missing":[],"missing_evidence":[]}`;
}
async function recoverEvidencePack(fields,cls,firstPass,model){
  const response=await createResponse({
    input:recoveryResearchPrompt(fields,cls,firstPass),
    useWeb:true,
    model:String(model||process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim(),
    timeoutMs:RECOVERY_BUDGET_MS
  });
  const recovered=parseJsonText(outputText(response));
  const recoveredSources=(Array.isArray(recovered.sources)?recovered.sources:[]).map(x=>({
    title:String(x.title||'').trim(),
    url:cleanUrl(x.url),
    supports:stripTags(String(x.supports||'')).trim(),
    source_type:String(x.source_type||sourceTypeFor(x.url,x.title)).trim()||'other',
    relevance:Math.max(5,Number(x.relevance||0))
  })).filter(x=>x.url);
  const merged=mergeEvidenceSources(recoveredSources,firstPass?.sources||[]);
  const requiredNow=Array.isArray(recovered.required_now_missing)?recovered.required_now_missing.map(x=>String(x||'').trim()).filter(Boolean):[];
  const futureTests=Array.isArray(recovered.future_tests)?recovered.future_tests.map(x=>String(x||'').trim()).filter(Boolean):[];
  const optionalMissing=Array.isArray(recovered.optional_missing)?recovered.optional_missing.map(x=>String(x||'').trim()).filter(Boolean):[];
  const legacyMissing=Array.isArray(recovered.missing_evidence)?recovered.missing_evidence.map(x=>String(x||'').trim()).filter(Boolean):[];
  const resolved=(recovered.resolved_subject&&typeof recovered.resolved_subject==='object')?recovered.resolved_subject:{};
  const hasResolvedSubject=Boolean(String(resolved.name||'').trim());
  const hasEvidence=merged.length>0;
  // Editorial timing rule: future outcomes and optional detail do not make today's research insufficient.
  const timedStatus=(requiredNow.length===0 && hasResolvedSubject && hasEvidence)?'Sufficient':(String(recovered.research_status||'Insufficient')==='Sufficient'?'Sufficient':'Insufficient');
  return {
    research_status:timedStatus,
    research_summary:String(recovered.research_summary||'').trim()||'Second-pass research completed.',
    sources:merged,
    required_now_missing:requiredNow,
    future_tests:futureTests,
    optional_missing:optionalMissing,
    missing_evidence:requiredNow.length?requiredNow:legacyMissing.filter(x=>!futureTests.includes(x)&&!optionalMissing.includes(x)),
    resolved_subject:resolved,
    recovery_used:true,
    recovery_model:response._model_used||model||''
  };
}

function isGuideAdviceBrief(fields){
  const title=String(value(fields,'Section Title')||'');
  const question=String(value(fields,'Core Reader Question')||'');
  const blob=(title+' '+question).toLowerCase();
  // General reader-service questions can normally be answered from authoritative
  // evidence without recreating every real-world condition hands-on.
  return /\b(how|what can|what should|which|guide|tips?|checklist|ways?|features?|options?|worth|save|choose|find|do beyond|before you)\b/i.test(blob)
    && !/\b(liquidat|administrat|arrest|charged|court|death|killed|crash|fire|closure|closed|bankrupt|insolvenc|fraud|investigation|planning decision|council decision)\b/i.test(blob);
}

function relaxNonCoreEvidenceDemands(fields,research){
  if(!research||!isGuideAdviceBrief(fields)) return research;
  const sources=Array.isArray(research.sources)?research.sources:[];
  const strong=sources.filter(x=>/official|primary/i.test(String(x.source_type||''))||/\.gov\.uk|gov\.uk|nhs\.uk|support\.google\.com|moneyhelper\.org\.uk|fca\.org\.uk/i.test(String(x.url||'')));
  if(strong.length<2) return research;

  const title=String(value(fields,'Section Title')||'');
  const question=String(value(fields,'Core Reader Question')||'');
  const localProof=String(value(fields,'Local Proof Needed')||'');
  const articleBlob=(title+' '+question+' '+localProof).toLowerCase();
  const demandsLocalNamedClaim=/\b(named|specific)\s+(?:norfolk|local)\s+(?:retailer|business|venue|operator|route|scheme)|\bwhich norfolk (?:retailer|business|venue|operator|route)\b/i.test(articleBlob);

  const canBeOptional=(item)=>{
    const t=String(item||'');
    if(/hands[- ]on|representative (?:android )?devices?|google pixel|samsung galaxy|representative participating uk issuers?|tested? on current|real[- ]world device testing/i.test(t)) return true;
    if(!demandsLocalNamedClaim && /norfolk[- ]relevant retailers?|local pass|particular norfolk business|specific norfolk retailer|transport operators? before naming/i.test(t)) return true;
    if(/supplied .* article could not be independently reviewed|exact feature list and expert attribution remain unverified|original discovery (?:article|lead).*unavailable/i.test(t)) return true;
    return false;
  };

  const required=Array.isArray(research.required_now_missing)?research.required_now_missing:[];
  const legacy=Array.isArray(research.missing_evidence)?research.missing_evidence:[];
  const moved=[...required,...legacy].filter(canBeOptional);
  if(!moved.length) return research;
  const movedSet=new Set(moved);
  research.required_now_missing=required.filter(x=>!movedSet.has(x));
  research.missing_evidence=legacy.filter(x=>!movedSet.has(x) && !/^Research stage reported insufficient evidence\./i.test(String(x||'')));
  research.optional_missing=[...new Set([...(research.optional_missing||[]),...moved])];
  if(research.required_now_missing.length===0 && strong.length>=2){
    research.research_status='Sufficient';
    research.core_evidence_relaxed=true;
    research.research_summary=[String(research.research_summary||'').trim(),'Core-answer gate: authoritative sources are sufficient for the approved reader-service question; hands-on, discovery-source and unnecessary local-enrichment checks are non-blocking.'].filter(Boolean).join(' ');
  }
  return research;
}

function classifyEvidenceTiming(research){
  const raw=[
    ...(research?.required_now_missing||[]),
    ...(research?.missing_evidence||[])
  ].map(x=>String(x||'').trim()).filter(Boolean);

  const futurePattern=/\b(before[- ]and[- ]after|follow[- ]?up|result|results|outcome|outcomes|durability|repeat[- ]repair|failure data|damage data|vehicle damage|cycle damage|savings?|save money|longer[- ]term|long[- ]term|performance after|monitoring result|evaluation result|once (?:the )?(?:trial|scheme|rollout)|future)\b/i;
  const optionalPattern=/\b(contractor|contractors|exact roads?|road names?|exact sites?|site references?|exact locations?|start date|duration|timetable|equipment|reporting process specific to|claims process specific to)\b/i;
  const hardPattern=/\b(identity|exact subject|responsible body|accountable body|whether (?:the )?(?:trial|scheme|service|funding|project) exists|existence of|current decision|eligibility required to|amount of funding|legal status|official confirmation of the premise)\b/i;

  const required=[],future=[],optional=[];
  for(const item of raw){
    if(futurePattern.test(item)) future.push(item);
    else if(optionalPattern.test(item) && !hardPattern.test(item)) optional.push(item);
    else required.push(item);
  }

  const uniq=a=>[...new Set(a)];
  return {required:uniq(required),future:uniq(future),optional:uniq(optional)};
}

function publicationPremiseEstablished(research){
  const sources=research?.sources||[];
  const resolved=research?.resolved_subject||{};
  const subject=Boolean(String(resolved.name||'').trim());
  const body=Boolean(String(resolved.responsible_body||'').trim());
  const strong=sources.filter(x=>
    /official|primary/i.test(String(x.source_type||'')) ||
    /\.gov\.uk|gov\.uk|nhs\.uk|police\.uk|norfolk\.gov\.uk/i.test(String(x.url||''))
  ).length;
  // A current story can proceed when its real subject is resolved and there is
  // article-specific evidence for the premise. Unknown future outcomes remain questions.
  return subject && sources.length>=2 && (body || strong>=1);
}

function evidenceOutcome(cls,research,gate){
  const timing=classifyEvidenceTiming(research);
  const premiseOk=publicationPremiseEstablished(research);
  const gateReasons=(gate?.reasons||[]).filter(x=>{
    const t=String(x||'');
    if(/^Research stage reported insufficient evidence\./i.test(t) && premiseOk && timing.required.length===0)return false;
    if(/^Required-now evidence missing:/i.test(t)){
      const detail=t.replace(/^Required-now evidence missing:\s*/i,'');
      return timing.required.includes(detail);
    }
    return true;
  });
  const blocking=[...timing.required,...gateReasons].filter(Boolean);
  if(premiseOk && blocking.length===0){
    return {code:'COMPLETE',label:'Complete',missing:[],future_tests:timing.future,optional_missing:timing.optional};
  }
  if(gate?.pass&&research?.research_status==='Sufficient'){
    return {code:'COMPLETE',label:'Complete',missing:[],future_tests:timing.future,optional_missing:timing.optional};
  }
  const n=(research?.sources||[]).length;
  if(n===0)return {code:'RESEARCH_INCOMPLETE',label:'Research incomplete',missing:blocking.length?blocking:timing.required};
  return {code:'SOURCE_CHECK_REQUIRED',label:'Source check required',missing:blocking.length?blocking:timing.required};
}
function researchLockDecision(research){
  const sources=Array.isArray(research?.sources)?research.sources:[];
  const combined=[
    String(research?.research_status||''),
    String(research?.research_summary||''),
    ...(research?.required_now_missing||[]),
    ...(research?.missing_evidence||[]),
    String(research?.resolved_subject?.responsible_body||'')
  ].join(' ');
  const directVerificationMissing=!research?.core_evidence_relaxed && /insufficient|cannot be verified|not officially confirmed|official confirmation.*missing|does not verify|does not establish|specific (?:trial|scheme|project).*not|exact (?:trial|scheme|project).*not/i.test(combined);
  const official=sources.filter(x=>/official|primary/i.test(String(x.source_type||''))||/\.gov\.uk|gov\.uk|nhs\.uk|police\.uk|norfolk\.gov\.uk/i.test(String(x.url||'')));
  const directlyVerifyingOfficial=official.filter(x=>{
    const support=[x.title,x.supports].join(' ');
    return !/context only|national context|general identity|accountable highway authority|reporting route|does not verify|does not provide|not the specific|earlier .* not|discovery-only/i.test(support);
  });
  const reported=sources.filter(x=>{
    const support=[x.title,x.supports,x.source_type].join(' ');
    return cleanUrl(x.url)&&(/discovery|report|reported|news/i.test(support));
  });
  if(directlyVerifyingOfficial.length>=1&&!directVerificationMissing){
    return {code:'VERIFIED_NOW',humanReview:false,reason:'An official or primary source directly verifies the article premise.'};
  }
  if(reported.length>=1){
    return {code:'ATTRIBUTED_REPORT',humanReview:true,reason:'Reporting supports the article premise, but matching official confirmation is incomplete. Claims must remain explicitly attributed.'};
  }
  if(sources.length>=1){
    return {code:'RESEARCH_INCOMPLETE',humanReview:true,reason:'Relevant evidence was retained, but it does not yet establish the article premise strongly enough for publication.'};
  }
  return {code:'BLOCKED',humanReview:true,reason:'No sufficiently credible article-specific source is retained for publication.'};
}

function researchPromptFor(fields,cls){
  const localProof=String(value(fields,'Local Proof Needed')||'').trim();
  const evidence=String(value(fields,'Evidence Required')||'').trim();
  const title=String(value(fields,'Section Title')||'').trim();
  const question=String(value(fields,'Core Reader Question')||'').trim();
  const notes=String(value(fields,'Notes')||'');
  const current=(notes.match(/Current signal:\s*([^\n]+)/i)||[])[1]||'';
  const provenance=(notes.match(/Plan provenance:\s*([^\n]+)/i)||[])[1]||'';
  return `You are the evidence researcher for a local-news MASTER ARTICLE. Research BEFORE drafting.

ARTICLE
Title: ${title}
Core question: ${question}
Local proof required: ${localProof}
Evidence required: ${evidence}
Production class: ${cls}
Current discovery lead: ${current||'Not supplied'}
Plan provenance: ${provenance||'Not supplied'}
Editor-supplied authoritative source URL: ${editorAuthoritativeSourceUrl(fields)||'Not supplied'}

RESEARCH RULES
- EDITOR SOURCE PRIORITY: when editor-supplied authoritative evidence is present, assess the exact URL and the EDITOR-CONFIRMED SOURCE TEXT first. Treat the pasted wording as source evidence tied to that URL when direct extraction is blocked (for example HTTP 403), while still checking internal consistency and publisher authority. Extract what it confirms, what it does not confirm, dates, named bodies and customer/action instructions. Do not ignore it merely because an older checkpoint disagrees.
- ENTITY FIRST: resolve the exact named subject/project/organisation/site/service from the discovery lead before broad research. Use distinctive proper nouns, places, scheme names and reference numbers as search anchors.
- If the lead is vague, first search to identify the exact subject. Never substitute a different local project because it is easier to find.
- Search the current web thoroughly.
- Prefer primary/official sources: local councils, GOV.UK, regulators, NHS/NICE, water companies, transport/highway bodies, official venue/business pages, official menus and ticket pages.
- Treat newspapers/news sites primarily as discovery or corroboration. Do not make the article dependent on naming them when the underlying official/primary evidence can be found.
- Distinguish evidence needed NOW from outcomes that cannot yet exist. A future result of a trial, rollout, consultation or proposed scheme should become a FUTURE TEST/question, not automatically make research insufficient.
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
- EDITORIAL SOURCE RULE: Spotlight is the publisher, not a news-curation feed. Do not normally write "EDP24 reports", "the BBC says", "according to [newspaper]" or otherwise foreground discovery/news-media sources in reader-facing copy. Use those sources internally to discover/corroborate the story. Prefer attribution to the underlying official body, document, dataset, organisation or direct published statement when attribution is useful.
- It is fine to say "Norfolk County Council says...", "council papers show...", "NHS guidance says..." or equivalent primary-source attribution where that adds authority.
- EVIDENCE TIMING RULE: facts verified now may be stated as facts. Outcomes that genuinely do not exist yet may be explored as clearly unanswered questions: "Could this...?", "Will it...?", "What happens if...?", "What should we watch?". Do not turn a future unknown into a publication blocker merely because results do not yet exist.
- A question mark must never disguise an unsupported factual premise. Verify the premise first, then ask the legitimate unanswered question.
- Do not manufacture hearsay. Phrases such as "we heard", "a source suggested", "people are saying" or "it's being said on social media" may be used only when genuine traceable source material exists in the research pack and the wording accurately reflects it.
- When research.future_tests is present, use those items as future tests/questions or follow-up hooks, not as reasons to declare the article unverifiable.
- When research.optional_missing is present, omit those details unless independently supported.
- One primary CTA only. The CTA should match the reader's next natural action. It may be engagement, list-building, a lead magnet, a Resident Expert, a Featured Partner, a booking, an offer, a directory/resource, a community action or another genuinely useful next step; do not manufacture a weak button just because a field exists.
- Raw clean destination URLs only.
- Short paragraphs suitable for a narrow article page.
- The article must stand alone outside the newsletter.
- QUESTION-FIRST RULE: answer ONE clear reader question well. Do not turn a broad topic into a catch-all guide.
- SPLIT TEST: if the brief naturally contains two or more questions that could each make a useful standalone 250-600 word article, answer only the approved core question here and return the other distinct questions in related_questions for the content bank. Do not cram them into this article.
- Length is earned by the question: normally 250-600 words, with roughly 350-500 as the sweet spot. Go beyond 600 only when the reader genuinely needs the extra detail; a 1,000+ word cornerstone piece should be exceptional, not the default. Cut repetition rather than padding to a target.
- SPOTLIGHT VOICE: keep personality, humour and an Unfiltered edge where the subject earns it. Do not manufacture outrage or clickbait, but do challenge lazy assumptions and bland official framing when evidence supports a sharper question.
- For contested subjects, do not force false certainty. A credible practical, challenge, contrarian or debate angle is allowed when it is supported and clearly distinguished from fact.

EDITORIAL BRAIN — PLAN THE HUMAN STORY BEFORE WRITING
- Facts are the foundation, not the finished article. Use the verified facts to create truthful curiosity, relevance, opinion and discussion.
- The reader should feel invited into the story, not lectured, processed or handed a pile of facts.
- Before drafting, silently decide: WHO CARES, WHY NOW, HUMAN EMOTION, MAIN TENSION, LOCAL RELEVANCE, PRACTICAL PAYOFF, SHARE REASON and CONVERSATION STARTER.
- Start from the human moment, frustration, hope, surprise, decision or everyday consequence — not from the category, institution or press-release wording.
- Make the opening create an honest "I want to know more" response within the first 2-3 short paragraphs.
- Apply the FRIEND TEST: is there a clear reason a reader would send this to a friend, partner, neighbour or colleague? Make that reason visible in the copy without saying "share this".
- Apply the LET-THEM-IN TEST: include the unresolved part, fair editorial observation or recognisable local experience that gives readers room to agree, disagree or add knowledge.
- Spotlight may form and express fair editorial opinions from supported facts. Clearly signal opinion with natural wording such as "That sounds promising, but...", "The fair test is...", "Drivers would be entitled to ask..." or equivalent. Do not present opinion as verified fact.
- Do not manufacture controversy. Select the fitting emotional treatment: curiosity, warmth, humour, pride, reassurance, frustration, scepticism, surprise or urgency.
- Do not repeatedly tell readers that evidence is missing. Explain the verified position once, then use the uncertainty to sharpen the real question, the practical test or what should happen next.
- NEVER turn an unsuccessful source search into the subject of the published article. If the research pack says independent_question_recovery is true, answer the approved reader question directly from the replacement evidence and ignore the unavailable discovery story except as provenance. If the core question still cannot be answered, return Fix Required rather than writing a meta-article about what could not be verified.
- Use a specific, answerable discussion prompt. Avoid generic endings such as "What do you think?".
- The final paragraph should open the door: invite a location, experience, recommendation, example, disagreement or useful local tip that can improve a follow-up story.
- Every paragraph must earn its place by doing at least one job: hook, explain, localise, interpret, help, surprise or invite.
${useEvidence?`- Use ONLY material claims supported by the research pack below.
- Some sources are fast discovery snippets rather than full documents. Never infer a precise figure, condition, quote or legal conclusion that is not explicitly present in the supplied evidence. When evidence is thin, write cautiously and surface what still needs checking.
- CRITICAL EVIDENCE LANGUAGE: absence of evidence is not evidence that a proposal failed a test. Never write "the answer is no" merely because a document is absent. First distinguish REQUIRED_NOW evidence from a FUTURE_TEST. If an outcome cannot yet exist, frame it as the question the article will follow rather than repeatedly telling readers that Spotlight lacks evidence.
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
 "editorial_stance":"PRACTICAL|NEUTRAL|CHALLENGE|CONTRARIAN|DEBATE|UNFILTERED",
 "editorial_strategy":{
   "who_cares":"specific reader group",
   "reader_emotion":"dominant human emotion",
   "main_tension":"truthful tension or unresolved question",
   "why_read":"clear reason to keep reading",
   "share_reason":"why a reader may send it to someone",
   "local_relevance":"how it feels rooted in this publication area",
   "practical_payoff":"what the reader gains",
   "conversation_starter":"specific answerable prompt",
   "avoid":"main editorial trap to avoid"
 },
 "quality_scores":{
   "stop_scroll":0,
   "human_readability":0,
   "friend_test":0,
   "local_identity":0,
   "conversation":0,
   "practical_value":0,
   "evidence_discipline":0
 },
 "related_questions":["distinct follow-up question to bank, not answered in this article"],
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
QUALITY SCORING
- Score each quality field from 1-10 after drafting. Be demanding, not flattering.
- If human_readability, friend_test, conversation or evidence_discipline is below 7, revise the article before returning the JSON.
- Scores are editorial diagnostics, not claims to the reader.

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
  const requiredNow=Array.isArray(research?.required_now_missing)?research.required_now_missing.filter(Boolean):[];
  if(research?.research_status!=='Sufficient')reasons.push('Research stage reported insufficient evidence.');
  if(requiredNow.length)reasons.push(...requiredNow.map(x=>`Required-now evidence missing: ${x}`));
  // Evidence-heavy does not mean arbitrary source-count padding. One strong primary source plus
  // corroborating evidence may be enough when the remaining unknowns are future tests.
  const primaryCount=sources.filter(x=>/official|primary/i.test(String(x.source_type||''))||/\.gov\.uk|gov\.uk|nhs\.uk|police\.uk/i.test(String(x.url||''))).length;
  if(cls==='C — Evidence Heavy'&&sources.length<2&&primaryCount<1)reasons.push('Evidence-heavy article requires stronger article-specific evidence.');
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
    editorial_stance:String(result.editorial_stance||'').trim(),
    editorial_strategy:(result.editorial_strategy&&typeof result.editorial_strategy==='object')?result.editorial_strategy:{},
    quality_scores:(result.quality_scores&&typeof result.quality_scores==='object')?result.quality_scores:{},
    related_questions:Array.isArray(result.related_questions)?result.related_questions.map(x=>String(x||'').trim()).filter(Boolean).slice(0,12):[],
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
    const mode=String(data.mode||'generate').toLowerCase()==='research'?'research':'generate';
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
    const sourceNotes=String(value(fields,'Notes')||'');
    const originalNotes=stripRuntimeBlocks(sourceNotes);
    const key=briefKey(fields,cls);
    const savedResearch=latestCheckpoint(sourceNotes,'research');
    const lockedResearch=lockedResearchFromNotes(sourceNotes);
    const savedWriter=latestCheckpoint(sourceNotes,'writer');
    const reusableResearch=(savedResearch?.brief_key===key)?savedResearch:(lockedResearch?{...lockedResearch,brief_key:key}:null);
    const writerCandidate=(savedWriter?.brief_key===key)?savedWriter:null;
    const runningStage=mode==='research'?'Researching only':'Generating from locked research';
    const runningBlock=[`MASTER ARTICLE RUNNING v2.22`,`Run ID: ${runId}`,`Stage: ${runningStage}`,`Started: ${new Date().toISOString()}`,`END MASTER ARTICLE RUNNING`].join('\n');
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
    // Trace stays in memory during production. Persisting every stage previously
    // added repeated Airtable reads/writes and could push a valid article beyond
    // the browser's 120-second wait. The final trace is written once with the result.
    const saveTrace=async()=>true;
    const traceBlock=()=>[`MASTER ARTICLE TRACE v1`,`Run ID: ${runId}`,...trace.slice(-16),`END MASTER ARTICLE TRACE`].join('\n');
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
    if(mode==='generate' && cls!=='A — Question Only' && !reusableResearch){
      const e=new Error('Research is not complete. Run Research selected article first.');
      e.status=409;
      throw e;
    }
    let research={research_status:'Sufficient',research_summary:'Question-only article; no research required.',sources:[],missing_evidence:[]};
    let researchResponse=null;
    let researchModel=String(process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
    if(cls!=='A — Question Only'){
      if(reusableResearch&&mode==='generate'){
        research=reusableResearch.research;
        researchModel=reusableResearch.model||researchModel;
        traceLine('Research checkpoint reused','DONE',researchModel||'saved');
        await saveTrace();
        log('research_checkpoint_reused',{sourceCount:Array.isArray(research.sources)?research.sources.length:0});
      }else{
        researchModel='FAST-EVIDENCE-RSS-v1';
        traceLine('Evidence collector','DONE',researchModel);
        await saveTrace();
        log('research_started',{productionClass:cls,model:researchModel});
        research=await stage('Fast evidence collection',()=>fastEvidencePack(fields,cls),18000);
        log('research_completed',{model:researchModel,sourceCount:Array.isArray(research.sources)?research.sources.length:0});
        let gate=evidenceGate(fields,cls,research);
        if(!gate.pass){
          research.research_status='Insufficient';
          research.missing_evidence=[...(Array.isArray(research.missing_evidence)?research.missing_evidence:[]),...gate.reasons];
        }
        if(research.research_status!=='Sufficient'||!gate.pass){
          traceLine('Targeted research recovery','START','fast pass insufficient');
          await saveTrace();
          log('research_recovery_started',{sourceCount:research.sources?.length||0,missing:research.missing_evidence?.length||0});
          try{
            const recoveryModel=String(process.env.OPENAI_RESEARCH_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim();
            research=await stage('Targeted web research recovery',()=>recoverEvidencePack(fields,cls,research,recoveryModel),RECOVERY_BUDGET_MS+3000);
            gate=evidenceGate(fields,cls,research);
            if(!gate.pass){
              research.research_status='Insufficient';
              research.missing_evidence=[...(Array.isArray(research.missing_evidence)?research.missing_evidence:[]),...gate.reasons];
            }
            researchModel=research.recovery_model||recoveryModel;
            const resolved=research.resolved_subject||{};
            traceLine('Entity resolved','DONE',[
              resolved.name?`subject=${resolved.name}`:'',
              resolved.responsible_body?`body=${resolved.responsible_body}`:'',
              resolved.reference?`ref=${resolved.reference}`:'',
              resolved.confidence?`confidence=${resolved.confidence}`:''
            ].filter(Boolean).join(' · ')||'no structured entity returned');
            await saveTrace();
            log('research_recovery_completed',{
              status:research.research_status,
              sourceCount:research.sources?.length||0,
              missing:research.missing_evidence?.length||0,
              resolvedSubject:resolved.name||'',
              responsibleBody:resolved.responsible_body||'',
              reference:resolved.reference||'',
              confidence:resolved.confidence||''
            });
          }catch(recoveryError){
            log('research_recovery_failed',{message:String(recoveryError?.message||recoveryError)});
            let independent=null;
            if(independentQuestionRecoveryEligible(fields)){
              traceLine('Independent question recovery','START','original source recovery failed');
              try{
                independent=await withTimeout(fastIndependentQuestionPack(fields,cls),12000,'Independent question recovery');
              }catch(independentError){
                log('independent_question_recovery_failed',{message:String(independentError?.message||independentError)});
              }
            }
            if(independent){
              research=independent;
              researchModel=independent.recovery_model;
              traceLine('Independent question recovery','DONE',`${research.sources?.length||0} sources`);
              log('independent_question_recovery_completed',{sourceCount:research.sources?.length||0});
            }else{
              research.research_status='Insufficient';
              research.recovery_used=true;
              research.research_summary=[research.research_summary,`Entity-first recovery could not complete within the ${Math.round(RECOVERY_BUDGET_MS/1000)}-second budget: ${String(recoveryError?.message||recoveryError).slice(0,220)}`].filter(Boolean).join(' ');
              research.missing_evidence=[...(research.missing_evidence||[]),`Entity-first second-pass research did not complete within ${Math.round(RECOVERY_BUDGET_MS/1000)} seconds.`];
            }
          }
        }
        research=relaxNonCoreEvidenceDemands(fields,research);
        log('research_gate_completed',{status:research.research_status,sourceCount:research.sources.length,missing:research.missing_evidence?.length||0,recoveryUsed:!!research.recovery_used,coreEvidenceRelaxed:!!research.core_evidence_relaxed});
        const checkpoint=researchCheckpointBlock(key,research,researchModel);
        const checkpointNotes=originalNotes?`${originalNotes}\n\n${checkpoint}\n\n${runningBlock}`:`${checkpoint}\n\n${runningBlock}`;
        await withTimeout(
          airtableRequest(TABLES.sections,{
            method:'PATCH',
            body:{records:[{id:record.id,fields:{'Notes':checkpointNotes,'Evidence Status':'Researching','Section Status':'Researching'}}],typecast:true},
            timeoutMs:15000
          }),
          16000,
          'Research checkpoint save'
        );
        traceLine('Research checkpoint saved','DONE');
        await saveTrace();
      }
    }

    research=relaxNonCoreEvidenceDemands(fields,research);

    if(mode==='research'){
      const decision=researchLockDecision(research);
      const retained=(research.sources||[]).map(x=>({title:String(x.title||'').trim(),url:cleanUrl(x.url),supports:stripTags(String(x.supports||'')).trim(),source_type:String(x.source_type||'')})).filter(x=>x.url).slice(0,8);
      const pack=[
        `RESEARCH PACK v1`,
        `Research ID: rp_${runId}`,
        `Run ID: ${runId}`,
        `State: RESEARCH_COMPLETE`,
        `Evidence Class: ${decision.code}`,
        `Human review: ${decision.humanReview?'Required':'Not required'}`,
        `Decision: ${decision.reason}`,
        `Sources retained: ${retained.length}`,
        ...retained.map((src,i)=>`Source ${i+1}: ${src.title||'Untitled source'} | ${src.url} | ${src.source_type||'reported'} | ${src.supports||'Support not summarised'}`),
        `Missing: ${(research.missing_evidence||[]).join('; ')||'None recorded'}`,
        `Locked: ${new Date().toISOString()}`,
        `END RESEARCH PACK`
      ].join('\n');
      const cleanNotes=stripRuntimeBlocks(originalNotes).replace(/\n?RESEARCH PACK v1[\s\S]*?END RESEARCH PACK\s*/g,'').trim();
      const checkpoint=researchCheckpointBlock(key,research,researchModel);
      const service=[`PRODUCTION SERVICE v3.7.3`,`Run ID: ${runId}`,`Stage: RESEARCH`,`Outcome: ${decision.code}`,`State: RESEARCH_COMPLETE`,`Writer: Not started — staged workflow`,`END PRODUCTION SERVICE`].join('\n');
      const notes=[cleanNotes,checkpoint,pack,service,traceBlock()].filter(Boolean).join('\n\n');
      const saved=await airtableRequest(TABLES.sections,{method:'PATCH',body:{records:[{id:record.id,fields:{
        'Source / Reference Link 1':retained[0]?.url||value(fields,'Source / Reference Link 1')||'',
        'Evidence Status':decision.code==='VERIFIED_NOW'?'Verified':decision.code==='ATTRIBUTED_REPORT'?'Reported — Attribution Required':'Researching',
        'Evidence Checked Date':new Date().toISOString().slice(0,10),
        'Section QA Result':['BLOCKED','RESEARCH_INCOMPLETE'].includes(decision.code)?'Fix Required':'Not Checked',
        'Section Status':['BLOCKED','RESEARCH_INCOMPLETE'].includes(decision.code)?'Researching':'Planned',
        'Notes':notes
      }}],typecast:true}});
      return json(200,{ok:true,record:cleanRecord(saved.records[0]),stage:'RESEARCH_COMPLETE',outcome:decision.code,researchId:`rp_${runId}`,sources:retained,humanReview:decision.humanReview});
    }

    // Bounded recovery: do not spend a full writer call on an article whose
    // core evidence is still insufficient after the targeted second pass.
    if(cls!=='A — Question Only'){
      const gateNow=evidenceGate(fields,cls,research);
      const outcomeNow=evidenceOutcome(cls,research,gateNow);
      if(['BLOCKED','RESEARCH_INCOMPLETE'].includes(researchLockDecision(research).code)){
      const retained=(research.sources||[]).map(x=>({
        title:String(x.title||'').trim(),
        url:cleanUrl(x.url),
        supports:stripTags(String(x.supports||'')).trim()
      })).filter(x=>x.url).slice(0,5);
      const missing=[...new Set(outcomeNow.missing||[])].filter(Boolean);
      // A blocked research run must invalidate any older writer/package output.
      // Previously the early return left the prior MASTER ARTICLE PACKAGE in Notes,
      // making a current one-source run appear to contain a fresh zero-source package.
      const priorNotes=removeWriterCheckpoints(originalNotes)
        .replace(/\n?MASTER ARTICLE PACKAGE v1[\s\S]*?END MASTER ARTICLE PACKAGE\s*/g,'')
        .replace(/\n?MASTER ARTICLE BLOCKED v1[\s\S]*?END MASTER ARTICLE BLOCKED\s*/g,'')
        .replace(/\n?PRODUCTION SERVICE v[\d.]+[\s\S]*$/,'')
        .trim();
      const blockedBlock=[
        `MASTER ARTICLE BLOCKED v1`,
        `Run ID: ${runId}`,
        `Reason: Source verification required before writing.`,
        `Sources retained: ${retained.length}`,
        ...retained.map((src,i)=>`Source ${i+1}: ${src.title||'Untitled source'} | ${src.url} | ${src.supports||'Support not summarised'}`),
        `Missing: ${missing.join('; ')||'Further primary/local evidence is required before publication.'}`,
        `END MASTER ARTICLE BLOCKED`
      ].join('\n');
      const serviceNotes=[
        `PRODUCTION SERVICE v2.24`,
        `Run ID: ${runId}`,
        `Class: ${cls}`,
        `Outcome: ${outcomeNow.code}`,
        `Writer: Skipped — evidence gate did not pass`,
        `Evidence: ${String(research.research_summary||'Insufficient evidence after bounded recovery.').trim()}`,
        `Sources retained: ${retained.length}`,
        `Exception: ${missing.join('; ')||'Further primary/local evidence is required before publication.'}`
      ].join('\n');
      const currentRun=`${blockedBlock}\n\n${serviceNotes}`;
      const notesBase=priorNotes?`${priorNotes}\n\n${currentRun}`:currentRun;
      const notes=`${notesBase}\n\n${traceBlock()}`;
      await assertRunOwnership('Research incomplete save ownership check');
      const saved=await withTimeout(
        airtableRequest(TABLES.sections,{
          method:'PATCH',
          body:{records:[{id:record.id,fields:{
            'Source / Reference Link 1':retained[0]?.url||value(fields,'Source / Reference Link 1')||'',
            'Evidence Status':'Researching',
            'Evidence Checked Date':new Date().toISOString().slice(0,10),
            'Section QA Result':'Fix Required',
            'Section Status':'Researching',
            'Section Final Copy':'',
            'Notes':notes
          }}],typecast:true},
          timeoutMs:18000
        }),
        20000,
        'Research incomplete save'
      );
      log('request_completed',{qaResult:outcomeNow.code,sourceCount:retained.length,writerSkipped:true});
      return json(200,{
        ok:true,
        record:cleanRecord(saved.records[0]),
        productionClass:cls,
        qaResult:'Fix Required',
        outcome:outcomeNow.code,
        sources:retained,
        writerSkipped:true,
        exception:missing.join('; ')||'Further primary/local evidence is required before publication.'
      });
    }
    }


    const activeResearchKey=researchKey(research);
    const reusableWriter=(writerCandidate?.research_key&&writerCandidate.research_key===activeResearchKey)?writerCandidate:null;
    if(writerCandidate&&!reusableWriter){
      traceLine('Writer checkpoint invalidated','DONE','research pack changed');
      await saveTrace();
      log('writer_checkpoint_invalidated',{reason:writerCandidate.research_key?'research_key_mismatch':'legacy_checkpoint_without_research_key',sourceCount:research.sources?.length||0});
    }
    const writerModel=String(process.env.OPENAI_WRITER_MODEL||process.env.OPENAI_PRODUCTION_MODEL||reusableWriter?.model||'gpt-5.6-luna').trim();
    let writerRaw='',response={_model_used:writerModel};
    if(reusableWriter){
      writerRaw=String(reusableWriter.raw_output||'');
      response._model_used=reusableWriter.model||writerModel;
      traceLine('Writer checkpoint reused','DONE',response._model_used||'saved');
      await saveTrace();
      log('writer_checkpoint_reused',{outputChars:writerRaw.length});
    }else{
      traceLine('Writer model','DONE',writerModel||'auto-select');
      await saveTrace();
      log('openai_started',{productionClass:cls,useWeb:false,model:writerModel||'auto-select'});
      response=await stage('Writer request',()=>createResponse({input:promptFor(fields,cls,research),useWeb:false,model:writerModel,timeoutMs:50000}),52000);
      writerRaw=outputText(response);
      log('openai_completed',{model:response._model_used||'',outputChars:writerRaw.length});
      const checkpoint=writerCheckpointBlock(key,activeResearchKey,writerRaw,response._model_used||writerModel);
      const latestNow=await airtableRequest(TABLES.sections,{params:{filterByFormula:`RECORD_ID()='${record.id.replace(/'/g,"\\'")}'`,maxRecords:'1'}});
      const currentNotes=String(latestNow.records?.[0]?.fields?.Notes||originalNotes);
      const cleanRuntime=stripRuntimeBlocks(currentNotes);
      const writerNotes=cleanRuntime?`${cleanRuntime}\n\n${checkpoint}\n\n${runningBlock}`:`${checkpoint}\n\n${runningBlock}`;
      await withTimeout(
        airtableRequest(TABLES.sections,{
          method:'PATCH',
          body:{records:[{id:record.id,fields:{'Notes':writerNotes}}],typecast:true},
          timeoutMs:15000
        }),
        16000,
        'Writer checkpoint save'
      );
      traceLine('Writer checkpoint saved','DONE');
      await saveTrace();
    }
    log('json_parse_started');
    const result=parseJsonText(writerRaw);
    log('json_parse_completed',{qaResult:result.qa_result||'',sourceCount:Array.isArray(result.sources)?result.sources.length:0});
    const writerSources=(Array.isArray(result.sources)?result.sources:[]).map(s=>({title:String(s.title||''),url:cleanUrl(s.url),supports:String(s.supports||'')})).filter(s=>s.url);
    const researchSources=(research.sources||[]).map(s=>({title:s.title,url:s.url,supports:s.supports}));
    const merged=[];
    for(const src of [...researchSources,...writerSources])if(src.url&&!merged.some(x=>x.url===src.url))merged.push(src);
    const sources=merged.slice(0,5);
    const gate=evidenceGate(fields,cls,research);
    const lockDecision=researchLockDecision(research);
    const editorialOutcome=evidenceOutcome(cls,research,gate);
    const qa=(result.qa_result==='Pass'&&lockDecision.code!=='BLOCKED')?'Pass':'Fix Required';
    const outcome=qa==='Pass'?{code:lockDecision.code,label:lockDecision.code==='VERIFIED_NOW'?'Verified now':'Attributed report',missing:[],future_tests:editorialOutcome.future_tests||[],optional_missing:editorialOutcome.optional_missing||[]}:editorialOutcome;
    if(outcome.code!=='COMPLETE'){
      result.exception=[String(result.exception||'').trim(),...(outcome.missing||[])].filter(Boolean).join(' ');
      result.evidence_summary=[String(result.evidence_summary||'').trim(),String(research.research_summary||'').trim(),outcome.missing?.length?`Missing required-now evidence: ${outcome.missing.join('; ')}`:''].filter(Boolean).join(' ');
    }
    const priorNotes=removeWriterCheckpoints(originalNotes).replace(/\n?MASTER ARTICLE PACKAGE v1[\s\S]*?END MASTER ARTICLE PACKAGE\s*/g,'').replace(/\n?PRODUCTION SERVICE v[\d.]+[\s\S]*$/,'').trim();
    const block=packageBlock(result,sources,response._model_used);
    const serviceNotes=[block,'',`PRODUCTION SERVICE v3.7.3`,`Run ID: ${runId}`,`Stage: GENERATE`,`Writer research: Disabled — locked Research Pack only`,`Class: ${cls}`,`Outcome: ${outcome.code}`,`Research recovery: ${research?.recovery_used?'Used':'Not needed'}`,`Evidence: ${String(result.evidence_summary||'').trim()||String(research?.research_summary||'').trim()||'No summary returned.'}`,`Missing evidence: ${outcome.missing?.length?outcome.missing.join('; '):'None'}`,`Exception: ${qa==='Pass'?'None':String(result.exception||outcome.label)}`].join('\n');
    const update={
      'Section Title':String(result.article_title||value(fields,'Section Title')).trim(),
      'Section Final Copy':String(result.article_body||'').trim(),
      'CTA Text':String(result.cta_text||value(fields,'CTA Text')||'').trim(),
      'Source / Reference Link 1':sources[0]?.url||value(fields,'Source / Reference Link 1')||'',
      'Evidence Status':qa==='Pass'?(cls==='A — Question Only'?'Question Only':lockDecision.code==='ATTRIBUTED_REPORT'?'Reported — Attribution Required':'Verified'):'Researching',
      'Evidence Checked Date':new Date().toISOString().slice(0,10),
      'Section QA Result':qa,
      'Section Status':qa==='Pass'?'Ready':'Researching',
      'Notes':`${priorNotes?`${priorNotes}\n\n${serviceNotes}`:serviceNotes}\n\n${traceBlock()}`
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
    return json(200,{ok:true,record:cleanRecord(saved.records[0]),productionClass:cls,qaResult:qa,outcome:outcome.code,researchRecovery:!!research?.recovery_used,sources,articlePackage:parseJsonText(block.split('\n').slice(1,-1).join('\n')),exception:qa==='Pass'?'':String(result.exception||outcome.label)});
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
          const failed=[`MASTER ARTICLE FAILED v3.7.1`,`Run ID: ${runId}`,`Error: ${String(error?.message||'Production failed').slice(0,1000)}`,`Failed: ${new Date().toISOString()}`,`END MASTER ARTICLE FAILED`].join('\n');
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