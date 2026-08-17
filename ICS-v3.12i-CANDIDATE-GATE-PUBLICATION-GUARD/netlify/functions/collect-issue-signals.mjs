const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});

function decodeXml(s=''){
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}
function stripTags(s=''){return decodeXml(String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function cleanArea(publication=''){
  let x=String(publication).trim();
  x=x.replace(/\b(Spotlight|Unfiltered|Newsletter|News|Local Pet Insider|Pet Insider|Taste Trail|Business Pulse|Smart Money|Smart Property News|Home Seller Insider|Property Investor Insider|Rental Insider|Local Health Pulse|Health Pulse|Smile Dentist News)\b/gi,' ');
  x=x.replace(/\s+/g,' ').trim();
  return x||String(publication).trim();
}
function hostOf(url=''){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function textBetween(block,tag){const m=block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?stripTags(m[1]):''}
function attr(block,tag,name){const m=block.match(new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["'][^>]*>`,'i'));return m?decodeXml(m[1]):''}
function parseRss(xml,provider,query,scope){
  const items=String(xml||'').match(/<item\b[\s\S]*?<\/item>/gi)||[];
  return items.slice(0,18).map(item=>{
    let title=textBetween(item,'title');
    let link=textBetween(item,'link')||attr(item,'link','href');
    const pubDate=textBetween(item,'pubDate')||textBetween(item,'published')||textBetween(item,'updated');
    const source=textBetween(item,'source')||attr(item,'source','url')||hostOf(link);
    // Google News titles often end " - Publisher". Keep headline clean when source is separately available.
    if(source&&title.endsWith(` - ${source}`))title=title.slice(0,-(` - ${source}`.length));
    return {scope,signal:title,question:'',why_now:pubDate||'Current discovery result',why_local:'Discovery lead — local relevance must be judged by the planner and verified during article research.',source_title:source||provider,source_url:link,provider,query,published_at:pubDate||''};
  }).filter(x=>x.signal&&x.source_url);
}
async function fetchText(url,timeoutMs=6500){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
  try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 TBOS-Signal-Collector/1.0','accept':'application/rss+xml, application/xml, text/xml, */*'},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}
}
function googleUrl(q){return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`}
function bingUrl(q){return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=en-GB`}
function dedupe(items){
  const seen=new Set(),out=[];
  for(const x of items){const k=x.signal.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,140);if(!k||seen.has(k))continue;seen.add(k);out.push(x)}
  return out;
}
function queryPack(area,issuePromise,sendDate){
  const dateHint=sendDate?` ${sendDate}`:'';
  return [
    {scope:'local',q:`${area} council transport housing health business local news when:14d`},
    {scope:'events',q:`${area} events festival theatre food attraction what's on${dateHint} when:30d`},
    {scope:'national',q:`UK mortgage tax business rates energy household costs NHS travel property regulation when:14d`},
    {scope:'seasonal',q:`${area} summer weather roads tourism family food property money when:30d`},
    {scope:'promise',q:`${area} ${String(issuePromise||'').split(/\s+/).filter(w=>w.length>4).slice(0,6).join(' ')} when:30d`}
  ];
}

export default async(request)=>{
  try{
    if(request.method.toUpperCase()!=='POST')return json(405,{ok:false,error:'Method not allowed'});
    const data=await request.json().catch(()=>({}));
    const publication=String(data.publication||'').trim();
    const issuePromise=String(data.issuePromise||'').trim();
    const sendDate=String(data.sendDate||'').trim();
    if(!publication||!issuePromise)return json(400,{ok:false,error:'publication and issuePromise are required'});
    const area=String(data.area||cleanArea(publication)).trim();
    const queries=queryPack(area,issuePromise,sendDate);
    const google=await Promise.allSettled(queries.map(async q=>parseRss(await fetchText(googleUrl(q.q)), 'Google News',q.q,q.scope)));
    let items=google.flatMap(x=>x.status==='fulfilled'?x.value:[]);
    let provider='Google News RSS';
    if(dedupe(items).length<8){
      const bing=await Promise.allSettled(queries.slice(0,4).map(async q=>parseRss(await fetchText(bingUrl(q.q)), 'Bing News',q.q,q.scope)));
      items=items.concat(bing.flatMap(x=>x.status==='fulfilled'?x.value:[]));provider+=' + Bing News RSS fallback';
    }
    const signals=dedupe(items).slice(0,24);
    if(signals.length<5)return json(502,{ok:false,error:`Signal collector found only ${signals.length} usable discovery leads.`,area,provider});
    return json(200,{ok:true,area,provider,collectedAt:new Date().toISOString(),discoveryOnly:true,signals});
  }catch(error){
    console.error('collect-issue-signals-failed',{message:error?.message});
    return json(500,{ok:false,error:String(error?.message||'Signal collection failed.')});
  }
};
