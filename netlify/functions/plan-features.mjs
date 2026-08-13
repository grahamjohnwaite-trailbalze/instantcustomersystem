import {json,publicError,readJson} from './_airtable.mjs';
import {createResponse,outputText,parseJsonText} from './_openai.mjs';

const clean=v=>String(v||'').replace(/\s+/g,' ').trim();

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await readJson(request);
    const publication=clean(data.publicationName)||'Trail Blaze publication';
    const promise=clean(data.issuePromise)||'This week in the local area';
    const selected=(Array.isArray(data.selectedMasterTitles)?data.selectedMasterTitles:[]).map(clean).filter(Boolean);
    const all=(Array.isArray(data.allMasterTitles)?data.allMasterTitles:[]).map(clean).filter(Boolean);
    const count=Math.max(4,Math.min(6,Number(data.count)||4));
    const prompt=`You are the commissioning editor for ${publication}.

Plan exactly ${count} SHORT FEATURE ARTICLES for the same issue.

ISSUE PROMISE
${promise}

MASTERS ALREADY SELECTED FOR THE NEWSLETTER
${selected.map((x,i)=>`${i+1}. ${x}`).join('\n')||'None supplied'}

OTHER MASTER TOPICS ALREADY PRODUCED / BANKED
${all.map((x,i)=>`${i+1}. ${x}`).join('\n')||'None supplied'}

A Feature Article is a permanent 300–450 word article with its own URL, SEO package and social use. It is not filler and not a long Master Article.

UNIVERSAL READER RULE
If it does not entertain, reward, surprise, help, tempt, amuse or make people want to read on, it does not get in. Earn attention before asking for it. Do not expect readers to donate comments, votes or time without first giving them something worth having.

COMMISSIONING RULES
- Every Feature must stand alone as something a reader might click, save, send to a friend or talk about.
- Do NOT repeat, summarise or merely shorten any selected Master.
- The issue promise is an anchor, not the subject of every Feature. Bring in lighter local-life, food, places, money, family, nostalgia, humour, discovery or useful-service angles where they fit the publication.
- Give each Feature ONE clear job and a distinct emotional flavour.
- Prefer named local proof, prices, places, events, businesses, routes, quirks, comparisons or everyday tests that can be researched.
- Avoid generic "city centre needs reasons to stay" style commentary and abstract editorial bridges.
- Do not invent facts. This is only a brief; the production engine will research each Feature separately.
- Keep the Feature suitable for a permanent indexed article rather than a poll or tiny newsletter component.
- One of the ${count} can be playful/amusing; one should be highly useful/saveable; one should be discovery/temptation led; one should invite conversation only after delivering real value.

Return JSON only:
{"features":[{"title":"clickable natural headline","question":"one precise reader question","reader_value":"what the reader gets","local_proof":"specific proof the research stage should seek","evidence":"what must be verified","life_lane":"Local Life|Food & Hospitality|Places & Discovery|Money & Consumer|Home & Property|Family & Community|Motoring & Travel|Fun & Curiosity|Business & People","writing_mode":"NEWS EXPLAINER|RECOMMENDATION / DISCOVERY|COMPARISON / VALUE|PRACTICAL SERVICE|HUMAN / COMMUNITY|DEBATE / READER VOICE","cta_text":"optional natural CTA or blank"}]}`;
    const response=await createResponse({input:prompt,useWeb:false,timeoutMs:50000});
    const parsed=parseJsonText(outputText(response));
    const features=(Array.isArray(parsed?.features)?parsed.features:[]).slice(0,count).map((x,i)=>({
      title:clean(x.title)||`Short Feature ${i+1}`,
      question:clean(x.question),reader_value:clean(x.reader_value),local_proof:clean(x.local_proof),evidence:clean(x.evidence),
      life_lane:clean(x.life_lane)||'Open',writing_mode:clean(x.writing_mode)||'PRACTICAL SERVICE',cta_text:clean(x.cta_text)
    }));
    if(features.length<count)return json(502,{ok:false,error:`Feature planner returned ${features.length}/${count} briefs.`});
    return json(200,{ok:true,features,model:response._model_used||''});
  }catch(error){return publicError(error,'plan-features')}
};
