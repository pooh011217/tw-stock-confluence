import base from './worker.js';

const VERSION='3.3.44.22';

function tickSize(p){return p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5}
function tradePrice(value){
 if(!Number.isFinite(value)||value<=0)return null;
 const tick=tickSize(value);
 return Number((Math.round(value/tick)*tick).toFixed(2));
}
function classicPivot(a){
 if(!a||![a.high,a.low,a.current].every(Number.isFinite)||a.high<a.low)return null;
 const P=(a.high+a.low+a.current)/3,range=a.high-a.low;
 return {P,S1:2*P-a.high,S2:P-range,R1:2*P-a.low,R2:P+range,high:a.high,low:a.low,close:a.current};
}
function firstPressureKey(a){return a.breakout?'breakout':a.resistance1?'resistance1':a.mediumResistance?'mediumResistance':null}
function secondPressureKey(a,first){if(a.resistance2)return'resistance2';if(a.mediumResistance&&first!=='mediumResistance')return'mediumResistance';return null}
function applyPivotToLevel(a,key,label,raw){
 const level=a?.[key];
 if(!level||!Number.isFinite(raw))return {key,label,raw,rounded:tradePrice(raw),accepted:false,reason:'level-not-formed'};
 const rounded=tradePrice(raw),low=Number.isFinite(level.bandLow)?level.bandLow:level.price,high=Number.isFinite(level.bandHigh)?level.bandHigh:level.price,tick=tickSize(rounded);
 const sameSide=key.startsWith('support')?rounded<a.current:rounded>a.current;
 const adjacent=rounded>=low-tick-1e-8&&rounded<=high+tick+1e-8;
 const accepted=sameSide&&adjacent;
 const audit={key,label,raw:Number(raw.toFixed(4)),rounded,before:level.price,bandBefore:[low,high],accepted,reason:!sameSide?'wrong-side':!adjacent?'outside-structural-band':'pivot-inside-or-one-tick-from-structural-band'};
 if(!accepted)return audit;
 level.price=rounded;
 level.bandLow=Math.min(low,rounded);
 level.bandHigh=Math.max(high,rounded);
 level.distance=(rounded-a.current)/a.current;
 level.sources=[...new Set([...(level.sources||[]),`前日經典Pivot ${label}〔主價校正；非獨立結構〕`])];
 level.pivotReference={label,raw:Number(raw.toFixed(4)),rounded,isHistoricalEvidence:false,usesBaseDayHLCOnly:true};
 if(a.selectionAudit?.levels?.[key]){
  a.selectionAudit.levels[key].price=rounded;
  a.selectionAudit.levels[key].bandLow=level.bandLow;
  a.selectionAudit.levels[key].bandHigh=level.bandHigh;
 }
 audit.after=rounded;audit.bandAfter=[level.bandLow,level.bandHigh];
 return audit;
}
function applyClassicPivotOverlay(payload){
 const a=payload?.analysis,pivot=classicPivot(a);
 if(!a||!pivot)return payload;
 const first=firstPressureKey(a),second=secondPressureKey(a,first),checks=[];
 checks.push(applyPivotToLevel(a,'support1','S1',pivot.S1));
 checks.push(applyPivotToLevel(a,'support2','S2',pivot.S2));
 if(first)checks.push(applyPivotToLevel(a,first,'R1',pivot.R1));
 if(second)checks.push(applyPivotToLevel(a,second,'R2',pivot.R2));
 a.classicPivot={...Object.fromEntries(Object.entries(pivot).filter(([k])=>['P','S1','S2','R1','R2'].includes(k)).map(([k,v])=>[k,Number(v.toFixed(4))])),formula:'P=(H+L+C)/3；S1=2P-H；S2=P-(H-L)；R1=2P-L；R2=P+(H-L)',basis:{date:a.date,high:a.high,low:a.low,close:a.current},status:'10/14照片確認的經典Floor Pivot；只校正既有結構帶內或相鄰一個跳動單位的主價，不單獨創建位點',noLookahead:true};
 a.pivotReview={version:'classic-pivot-guard-v1',checks,accepted:checks.filter(x=>x.accepted).map(x=>x.key),referenceTargetsAsInputs:false,createsNewLevels:false,roleChanged:false,bandExpansionMaximum:'one legal trading tick'};
 if(a.rulePolicy)a.rulePolicy={...a.rulePolicy,pivotOverlay:'經典Pivot僅作既有結構主價校正；不建立新位點、不改角色，最多擴帶一個合法跳動單位'};
 payload.version=VERSION;
 return payload;
}
function scanResultFromAnalyze(x){
 const {stock,analysis,extra,score}=x,supportGap=analysis.support1?Math.abs(analysis.support1.distance):null,breakoutGap=analysis.breakout?analysis.breakout.distance:null,inst=extra?.institutional||{},tags=[];
 if(supportGap!=null&&supportGap<=.015)tags.push('接近支撐');
 if(breakoutGap!=null&&breakoutGap>=0&&breakoutGap<=.02)tags.push('接近突破');
 if(analysis.volumeBreakout)tags.push('量價突破');
 if((inst.foreign||0)>0&&(inst.trust||0)>0)tags.push('外投同買');
 if((inst.total||0)>0)tags.push('法人偏多');
 if(analysis.trend==='偏多')tags.push('技術偏多');
 if(score.structure>=70)tags.push('高共振');
 let observation=score.structure+(tags.includes('接近支撐')?6:0)+(tags.includes('接近突破')?6:0)+(tags.includes('量價突破')?8:0)+(tags.includes('外投同買')?5:0);observation=Math.max(0,Math.min(100,Math.round(observation)));
 return {ok:true,stock,date:analysis.date,current:analysis.current,changePct:analysis.changePct,trend:analysis.trend,structure:score.structure,observation,levelStatus:analysis.levelStatus,rulePolicy:analysis.rulePolicy,levels:Object.fromEntries(['support1','support2','breakout','resistance1','resistance2','mediumResistance','limitUpReference'].map(k=>[k,analysis[k]?{price:analysis[k].price,bandLow:analysis[k].bandLow,bandHigh:analysis[k].bandHigh,distance:analysis[k].distance,isStructural:analysis[k].isStructural}:null])),support:analysis.support1?{price:analysis.support1.price,distance:analysis.support1.distance,confidence:analysis.support1.confidence}:null,breakout:analysis.breakout?{price:analysis.breakout.price,distance:analysis.breakout.distance,confidence:analysis.breakout.confidence}:null,volumeRatio:analysis.volumeRatio,tags};
}
async function baseAnalyze(request,input,env,ctx){
 const url=new URL(request.url),body={action:'analyze',q:input.q||input.codes||'',asOf:input.asOf,model:input.model||'standard'};
 const req=new Request(url.toString(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const response=await base.fetch(req,env,ctx);if(!response.ok)return {response};
 const data=await response.json();if(body.model==='standard')applyClassicPivotOverlay(data);else data.version=VERSION;
 return {data};
}
export default {async fetch(request,env,ctx){
 const u=new URL(request.url);
 if(u.pathname!=='/api/stock'||request.method!=='POST')return base.fetch(request,env,ctx);
 let input;try{input=await request.clone().json()}catch{return base.fetch(request,env,ctx)}
 if(input.action==='analyze'){
  const response=await base.fetch(request,env,ctx);if(!response.ok)return response;const data=await response.json();if((input.model||'standard')==='standard')applyClassicPivotOverlay(data);else data.version=VERSION;return new Response(JSON.stringify(data),{headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}});
 }
 if(input.action==='scan'){
  const q=String(input.codes||'').split(/[\s,，;；]+/).map(x=>x.trim()).filter(Boolean)[0]||'';
  const {data,response}=await baseAnalyze(request,{...input,q},env,ctx);
  if(response){let message='分析失敗';try{message=(await response.json()).error||message}catch{}return new Response(JSON.stringify({results:[{ok:false,query:q,error:message}],version:VERSION}),{headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}})}
  return new Response(JSON.stringify({results:[scanResultFromAnalyze(data)],version:VERSION}),{headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}});
 }
 const response=await base.fetch(request,env,ctx);if(!response.ok)return response;const data=await response.json();if(data&&typeof data==='object')data.version=VERSION;return new Response(JSON.stringify(data),{headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store'}});
}};
