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
      content:String(b.content||''),partner:b.partner,cta:b.cta,button:b.button,url:b.url,articleMeta:b.articleMeta||null
    }));

    const profile=data.profile&&typeof data.profile==='object'?data.profile:{};
    const sectionRange=Array.isArray(profile.targetSections)?profile.targetSections:[12,30];
    const masterRange=Array.isArray(profile.targetMasters)?profile.targetMasters:[5,10];
    const profileName=profile.name||'Local publication';
    const voice=profile.voice||'Research deeply, write simply, sound like normal people talk. Specific local proof with publication-appropriate flavour.';

    const prompt=`You are the final whole-issue editorial QA editor for a UK local newsletter.

PUBLICATION: ${data.publication||''}
PUBLICATION FAMILY / PROFILE: ${profileName}
NORMAL SECTION RANGE FOR THIS PROFILE: ${sectionRange[0]}-${sectionRange[1]}
NORMAL MASTER ARTICLE RANGE FOR THIS PROFILE: ${masterRange[0]}-${masterRange[1]}
VOICE PROFILE: ${voice}
ISSUE PROMISE: ${data.issuePromise||''}

Review the complete running order below. Detect ONLY meaningful issue-level problems that a deterministic checker may miss:
- semantically repeated questions/angles even when wording differs;
- a supporting component that gives away or repeats a nearby Master Article;
- excessive concentration on one theme;
- repeated partner exposure that feels editorially excessive (warning only);
- if a paid partner already has a Master Article in the issue, its Partner Presence must complement it with a distinct action/service/insight rather than summarise the article;
- internal commercial/editorial notes leaking into reader-facing copy;
- weak issue rhythm or several heavy sections together;
- issue architecture outside THIS PUBLICATION PROFILE'S stated section and Master ranges above; treat those ranges as normal ranges, not quotas. Never substitute Spotlight targets for another publication family;
- commercial opportunity should be visible across strong articles/components where natural: authority/expert routes, feature/activation routes, sponsored resources, niche-brand/list-building pathways or other sellable reader-value opportunities. Do NOT require an arbitrary sponsor count and do NOT penalise a strong editorial item merely because it has no obvious commercial route;
- too many oversized/catch-all Master Articles where several distinct reader questions appear to have been crammed into one piece;
- generic supporting copy that does not earn its place;
- duplicated CTAs/social prompts;
- a flat, over-safe, review-template or overly polished issue voice. The universal standard is normal spoken UK English: explain, do not perform expertise. Judge family flavour against the ACTIVE VOICE PROFILE above; never refer to Spotlight unless the active profile is actually Spotlight;
- repeated desk-review constructions such as “our verdict”, “our view”, “strong option”, “worth considering”, “the evidence suggests”, “on balance”, or several paragraphs that sound like formal assessment rather than a human recommendation/explanation;
- localisation failure: reader-facing copy that claims to be local but could be moved to another county/town by changing only the place name, when the subject reasonably allows named local proof;
- for Master Articles, compare the reader-facing title/body with articleMeta (article title, subhead, SEO title/description, slug, newsletter headline and CTA). If those fields clearly describe a DIFFERENT venue, business, development, person or story, report FIX with code ENTITY_IDENTITY_MISMATCH. This is a hard publishing defect, not an editorial preference. Do not use fuzzy similarity: only flag an obvious contradictory identity;
- publication-family leakage: if reader-facing copy names a different Trail Blaze family (for example “Tell Spotlight” inside Taste Trail), report FIX with code WRONG_FAMILY_LANGUAGE.

IMPORTANT PROFILE RULE:
Treat the supplied publication profile, section range, Master range, voice profile and issue promise as authoritative for this QA run. Do not invent a different family identity or report the promise as blank when ISSUE PROMISE above is populated.

IMPORTANT SOURCE RULE:
Information supplied directly by a named featured partner or organisation is valid first-party information. Do NOT flag it merely because it lacks independent public-web corroboration. You may warn only when attribution/qualification is needed or the copy overstates what the supplied information supports.

Never recommend removing a paid partner automatically. Never rewrite or fact-check Master Articles here. A localisation warning is editorial only unless a supporting block is plainly generic and can be safely reframed as a local reader-input prompt.

Return strict JSON only:
{"findings":[{"severity":"FIX|WARNING|PASS","code":"SHORT_CODE","message":"specific concise finding","blocks":["uid"],"safeFix":true|false}]}

Use FIX only for clear publication problems. Use WARNING for editorial judgement. safeFix may be true only for supporting/partner-copy rewrites, never for Master Articles, partner removal, factual changes or commercial commitments.
Also check for over-polished/AI-ish language across the whole issue. An article can be factually excellent and still deserve a VOICE warning if a normal person would not naturally say it that way. Judge it against ordinary spoken UK English, not literary copy. Do not ban normal words used once, but warn when words or constructions such as useful, practical, straightforward, meaningful, valuable, importantly, helpful, navigate, whether, matters, key, crucial, “The question is…”, “That matters because…”, or similar polished patterns are repeated enough to make the issue sound machine-written. Prefer everyday spoken UK English and specificity over adjectives.

Do not report a Master Article as truncated merely because a preview, excerpt or context field is shortened. Only flag incomplete copy when the actual supplied reader-facing content visibly ends mid-word, mid-sentence or with a clear missing continuation. A complete concluding sentence is not truncation.

Internal/commercial leakage and genuinely incomplete reader-facing copy are publication blockers. Format fulfilment for News Brief / Quick Update / What's On is decided deterministically by the application. If you notice a problem there, report it as WARNING only; do not create a FIX for it. Repetition, semantic overlap, generic supporting copy, rhythm, theme concentration, duplicated reader prompts, localisation strength, partner overexposure and human-voice concerns are WARNING-level editorial issues, not hard FIXes. Never escalate those editorial concerns to FIX merely because they are widespread.

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
    const raw=Array.isArray(parsed?.findings)?parsed.findings.filter(f=>f&&['FIX','WARNING','PASS'].includes(f.severity)):[];

    // v3.17.3 hard-fix discipline: whole-issue editorial repetition/voice/balance concerns
    // are warnings. Do not let the AI promote them into publish blockers and cause repair churn.
    const permittedHardFix=f=>{
      const blob=`${f?.code||''} ${f?.message||''}`.toLowerCase();
      if(/internal|commercial|sponsor(?:ship)? (?:note|rate|amount)|pricing|editor-facing|production note/.test(blob))return true;
      if(/mid[- ]?(?:sentence|word)|truncat|incomplete reader-facing|missing continuation/.test(blob))return true;
      if(/partner tip/.test(blob)&&/(no named partner|no partner|unnamed partner)/.test(blob))return true;
      if(/entity_identity_mismatch|entity identity mismatch|different (?:venue|business|development|person|story)|title.*(?:seo|slug|body).*(?:conflict|contradict|different)/.test(blob))return true;
      if(/wrong_family_language|wrong family|family leakage|tell spotlight/.test(blob))return true;
      return false;
    };
    const findings=raw.map(f=>{
      if(f.severity==='FIX'&&!permittedHardFix(f))return {...f,severity:'WARNING'};
      return f;
    });
    return json(200,{ok:true,findings});
  }catch(error){
    console.error('final-qa-failed',{message:error?.message,status:error?.status,details:error?.details});
    return json(Number(error?.status)||500,{ok:false,error:String(error?.message||'Final QA failed.'),details:error?.details});
  }
};
