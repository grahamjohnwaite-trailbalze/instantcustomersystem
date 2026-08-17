import {createResponse,outputText,parseJsonText} from './_openai.mjs';
import {json,publicError,readJson} from './_airtable.mjs';

const safe=v=>String(v??'').trim();

function promptFor(body){
  const c=body.component||{};
  const partner=c.hasPartner?`\nPARTNER CONTEXT\nPartner: ${safe(c.partner)||'[not yet named]'}\nRole/category: ${safe(c.partnerRole)||'[not yet set]'}\nPartner CTA: ${safe(c.partnerCta)}\nPartner URL: ${safe(c.partnerUrl)}\nThe partner helps answer or support the reader need. Do not turn the component into an advert unless the component type is PARTNER FEATURE.`:'\nPARTNER CONTEXT\nNo partner is attached. Do not introduce one.';
  return `You are the production editor inside Trail Blaze's Issue Canvas. Generate ONE finished newsletter component ready to paste into Letterman.

PUBLICATION CONTEXT
Publication: ${safe(body.publication)}
Issue number: ${safe(body.issueNumber)}
Send date: ${safe(body.sendDate)}
Issue promise/theme: ${safe(body.theme)}

COMPONENT
Type: ${safe(c.type)}
Working title: ${safe(c.title)}
Reader job/purpose: ${safe(c.purpose)}
Local proof/source available: ${safe(c.proof)}
Primary CTA: ${safe(c.cta)}
${partner}

NEIGHBOURING BLOCKS IN RUNNING ORDER
${JSON.stringify(body.neighbours||[],null,2)}

AVAILABLE PRODUCED ARTICLES FOR CONTEXT ONLY
${JSON.stringify(body.availableArticles||[],null,2)}

RULES
- UK English. Human, lively, specific and useful; no generic AI filler.
- Respect the named publication and its geography/niche. Do not merely swap place names.
- This is a newsletter component, not a 650-word master article. Usually 45-180 words unless the type genuinely needs less.
- Make it flow naturally beside the neighbouring blocks and avoid repeating their job or hook.
- Use the issue theme as context, not as a phrase to mechanically repeat.
- Never invent facts, businesses, quotes, prices, dates, reader consensus or local proof.
- If proof is missing for a factual claim, either avoid the claim or visibly mark a precise verification placeholder.
- One primary action/button maximum.
- Local Proof / Source is internal evidence guidance, not a mandatory printed footer.
- POLL: give one sharp question and 3-4 meaningful answer options.
- QUIZ: give a specific question and a clearly marked verified-answer placeholder if the answer is not supported.
- Q&A: ask a real reader question and give a useful answer bounded by available evidence.
- OPENING NOTE: set up this exact issue in 2-4 short paragraphs without cliché.
- CLOSING QUESTION: end on one specific question worth answering.
- READER RECOMMENDATION: ask for a named recommendation plus a reason/useful detail.
- FACEBOOK DISCUSSION: create a standalone stop-and-comment prompt connected to the issue.
- PARTNER FEATURE: useful content first, partner second; no empty promotional claims.

Return ONLY JSON:
{"title":"","content":"","cta":"","button":"","qa_result":"Pass or Fix Required","exception":""}`;
}

export async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'Method not allowed'});
  try{
    const body=await readJson(event);
    const response=await createResponse({input:promptFor(body),useWeb:false});
    const result=parseJsonText(outputText(response));
    return json(200,{ok:true,title:safe(result.title),content:safe(result.content),cta:safe(result.cta),button:safe(result.button),qa_result:safe(result.qa_result)||'Pass',exception:safe(result.exception),model_used:response._model_used||''});
  }catch(error){return publicError(error)}
}
