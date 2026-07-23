import {createResponse,outputText,parseJsonText} from './_openai.mjs';

const json=(status,body)=>new Response(JSON.stringify(body),{
  status,
  headers:{'content-type':'application/json; charset=utf-8'}
});

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const blocks=Array.isArray(data.blocks)?data.blocks:[];
    if(!blocks.length)return json(400,{ok:false,error:'blocks are required.'});

    const compact=blocks.map(b=>({
      order:b.order,uid:b.uid,kind:b.kind,type:b.type,title:b.title,purpose:b.purpose,
      content:String(b.content||'').slice(0,1800),partner:b.partner,cta:b.cta,button:b.button,url:b.url
    }));

    const prompt=`You are the final whole-issue editorial QA editor for a UK local newsletter.

PUBLICATION: ${data.publication||''}
ISSUE PROMISE: ${data.issuePromise||''}

Review the complete running order below. Detect ONLY meaningful issue-level problems that a deterministic checker may miss:
- semantically repeated questions/angles even when wording differs;
- a supporting component that gives away or repeats a nearby Master Article;
- excessive concentration on one theme;
- repeated partner exposure that feels editorially excessive (warning only);
- if a paid partner already has a Master Article in the issue, its Partner Presence must complement it with a distinct action/service/insight rather than summarise the article;
- internal commercial/editorial notes leaking into reader-facing copy;
- weak issue rhythm or several heavy sections together;
- generic supporting copy that does not earn its place;
- duplicated CTAs/social prompts;
- localisation failure: reader-facing copy that claims to be local but could be moved to another county/town by changing only the place name, when the subject reasonably allows named local proof.

IMPORTANT SOURCE RULE:
Information supplied directly by a named featured partner or organisation is valid first-party information. Do NOT flag it merely because it lacks independent public-web corroboration. You may warn only when attribution/qualification is needed or the copy overstates what the supplied information supports.

Never recommend removing a paid partner automatically. Never rewrite or fact-check Master Articles here. A localisation warning is editorial only unless a supporting block is plainly generic and can be safely reframed as a local reader-input prompt.

Return strict JSON only:
{"findings":[{"severity":"FIX|WARNING|PASS","code":"SHORT_CODE","message":"specific concise finding","blocks":["uid"],"safeFix":true|false}]}

Use FIX only for clear publication problems. Use WARNING for editorial judgement. safeFix may be true only for supporting/partner-copy rewrites, never for Master Articles, partner removal, factual changes or commercial commitments.
Also check for over-polished/AI-ish language across the whole issue. Judge it against ordinary spoken UK English, not literary copy. Do not ban normal words used once, but warn when words or constructions such as useful, practical, straightforward, meaningful, valuable, importantly, helpful, navigate, whether, matters, key, crucial, “The question is…”, “That matters because…”, or similar polished patterns are repeated enough to make the issue sound machine-written. Prefer everyday spoken UK English and specificity over adjectives.

Do not report a Master Article as truncated merely because a preview, excerpt or context field is shortened. Only flag incomplete copy when the actual supplied reader-facing content visibly ends mid-word, mid-sentence or with a clear missing continuation. A complete concluding sentence is not truncation.

Internal/commercial leakage and genuinely incomplete reader-facing copy are publication blockers. Repetition, rhythm, partner overexposure and human-voice concerns are editorial issues, not technical failures.

Do not emit generic PASS findings; if there are no extra editorial problems return {"findings":[]}.

RUNNING ORDER:
${JSON.stringify(compact)}`;

    const response=await createResponse({
      input:prompt,
      useWeb:false,
      model:process.env.OPENAI_QA_MODEL||process.env.OPENAI_COMPONENT_MODEL||process.env.OPENAI_PRODUCTION_MODEL||'gpt-5.6-luna',
      timeoutMs:65000
    });
    const parsed=parseJsonText(outputText(response));
    const findings=Array.isArray(parsed?.findings)?parsed.findings.filter(f=>f&&['FIX','WARNING','PASS'].includes(f.severity)):[];
    return json(200,{ok:true,findings});
  }catch(error){
    console.error('final-qa-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Final QA failed.'),details:error?.details});
  }
};
