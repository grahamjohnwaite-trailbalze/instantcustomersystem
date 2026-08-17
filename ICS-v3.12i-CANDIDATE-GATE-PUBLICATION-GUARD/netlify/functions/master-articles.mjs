import {TABLES,cleanRecord,json,listAll,publicError} from './_airtable.mjs';

function asArray(value){
  if(Array.isArray(value)) return value.map(String);
  if(value===undefined||value===null||value==='') return [];
  return [String(value)];
}
function intersects(a,b){const set=new Set(asArray(a));return asArray(b).some(x=>set.has(x))}
function isProduced(fields={}){
  const notes=String(fields.Notes||'');
  const finalCopy=String(fields['Section Final Copy']||fields['Final Copy']||'').trim();
  const status=String(fields['Section Status']||'').trim().toLowerCase();
  const destination=String(fields['Action Destination URL']||'').trim();
  const hasPackage=/MASTER ARTICLE PACKAGE(?: v1)?/i.test(notes);
  const hasLettermanShape=/\b(article_(?:body|subhead)|newsletter_(?:headline|teaser)|seo_title|url_path)\b/i.test(notes);
  const substantialCopy=finalCopy.length>=350;
  const readyPublished=(status==='ready'||status==='published') && (destination||finalCopy.length>=150);
  return hasPackage || hasLettermanShape || substantialCopy || readyPublished;
}

export default async(request)=>{
  try{
    const url=new URL(request.url);
    const issueId=url.searchParams.get('issueId');
    if(!issueId)return json(400,{ok:false,error:'issueId is required.'});

    const issues=(await listAll(TABLES.issues)).map(cleanRecord);
    const current=issues.find(x=>x.id===issueId);
    if(!current)return json(404,{ok:false,error:'Current issue was not found.'});

    const publicationLinks=asArray(current.fields.Publication);
    if(!publicationLinks.length)return json(200,{ok:true,records:[],count:0,diagnostic:'Current issue has no publication link.'});

    const publicationIssueIds=new Set(
      issues.filter(x=>intersects(x.fields.Publication,publicationLinks)).map(x=>x.id)
    );

    const candidates=(await listAll(TABLES.sections))
      .map(cleanRecord)
      .filter(({fields})=>asArray(fields.Issues).some(id=>publicationIssueIds.has(id)))
      .filter(({fields})=>isProduced(fields))
      .sort((a,b)=>String(b.createdTime||'').localeCompare(String(a.createdTime||'')));

    // Keep one library entry per Airtable record/title. Older duplicate production
    // records should not make the same Letterman article appear twice.
    const seenIds=new Set(),seenTitles=new Set(),records=[];
    for(const record of candidates){
      const title=String(record.fields?.['Section Title']||'').trim().toLowerCase().replace(/\s+/g,' ');
      if(seenIds.has(record.id)||(title&&seenTitles.has(title)))continue;
      seenIds.add(record.id);if(title)seenTitles.add(title);records.push(record);
    }

    return json(200,{ok:true,records,count:records.length,issueCount:publicationIssueIds.size});
  }catch(error){return publicError(error,'master-articles')}
};
