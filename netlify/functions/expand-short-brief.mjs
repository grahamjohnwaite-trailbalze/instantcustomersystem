import {createResponse,outputText,parseJsonText} from './_openai.mjs';

const json=(statusCode,body)=>new Response(JSON.stringify(body),{status:statusCode,headers:{'content-type':'application/json'}});

export default async(request)=>{
  try{
    if(request.method!=='POST')return json(405,{ok:false,error:'POST required'});
    const body=await request.json();
    const title=String(body.title||'').trim();
    const question=String(body.question||'').trim();
    const commercial=String(body.commercial||'').trim();
    const expert=String(body.expert||'').trim();
    const sponsor=String(body.sponsor||'').trim();
    const niches=String(body.niches||'').trim();
    const location=String(body.location||'').trim();
    if(!title||!question)return json(400,{ok:false,error:'Title and reader question are required.'});
    const prompt=`You are the editorial brief expander for Trail Blaze Operating System (TBOS). Turn a short approved article decision into a strong production brief for a local Spotlight publication.

INPUT
Working title: ${title}
Reader question: ${question}
Location lock: ${location}
Commercial routes: ${commercial||'Not supplied'}
Default expert persona/role: ${expert||'Not supplied'}
Sponsor override role: ${sponsor||'Not supplied'}
Niche/reuse pathways: ${niches||'Not supplied'}

RULES
- UK English. Write naturally and specifically, not generic template prose.
- Answer the actual subject. Infer the real decision/problem from the title and question.
- Geography is ${location}. Never substitute another same-name location.
- Localisation: use location strongly in SEO/research instructions, but conversational copy normally only once unless genuine local proof needs more.
- Local proof must be useful, not forced. Prefer official local data, named places, prices, rules, services, roads, venues or decisions where they improve the answer.
- Do not name a single unsponsored commercial business merely to prove locality.
- Commercial pathway must explain Authority opportunity + Activation opportunity naturally.
- The expert persona is an editorial device only. Never fabricate a quote, credential or professional claim. A real sponsor can replace the role later.
- Evidence required must identify the best authoritative source types/bodies for this exact subject, not say merely “reliable sources”.
- Primary next action and CTA must fit this exact article, not generic “save this check”.
- Avoid AI clichés such as quietly, useful, practical, meaningful, straightforward, key question, important distinction, and excessive “whether”.
- Keep each field concise but production-ready.

Return ONLY JSON exactly in this shape:
{
  "reader_hook":"",
  "universal_reader_problem":"",
  "reader_type":"",
  "decision_constraint":"",
  "emotional_outcome":"Curious|Reassured|Warned|Recognised|Clearer|Confident|Motivated|Amused|Concerned|Hopeful|Ready To Act",
  "reader_value":"",
  "local_proof_needed":"",
  "evidence_required":"",
  "commercial_lane":"Authority|Featured Partner|Activation|Community|None",
  "commercial_pathway":"",
  "primary_next_action":"",
  "cta_type":"None|Button|Link|Reply|Comment|Nominate|Vote|Save|Share",
  "cta_text":"",
  "social_question_shape":"",
  "archive_similarity_note":"",
  "reuse_localisation_potential":"Local only|Reusable|Niche adaptable|Multi-edition"
}`;
    const response=await createResponse({input:prompt,useWeb:false,model:String(process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna').trim(),timeoutMs:30000});
    const result=parseJsonText(outputText(response));
    return json(200,{ok:true,brief:result});
  }catch(e){
    console.error('expand-short-brief failed',e);
    return json(500,{ok:false,error:String(e?.message||e||'Short brief expansion failed')});
  }
};
