function tickSize(p){return p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5}
function tradePrice(value,mode='nearest'){
 if(!Number.isFinite(value)||value<=0)return null;
 const tick=tickSize(value),units=value/tick;
 const n=mode==='floor'?Math.floor(units+1e-8):mode==='ceil'?Math.ceil(units-1e-8):Math.round(units);
 return Number((n*tick).toFixed(2));
}
function reactionTolerance(a){
 const cur=a?.current;if(!Number.isFinite(cur)||cur<=0)return null;
 const atr=Number.isFinite(a?.atr14)?a.atr14:0,tick=tickSize(cur);
 return Math.min(cur*.0175,Math.max(cur*.006,atr*.30,tick*2));
}
function recentReactionBands(a,sessions=12){
 const cur=a?.current,tolerance=reactionTolerance(a),all=Array.isArray(a?.rows)?a.rows:[];
 const rows=all.filter(r=>!a?.date||!r?.date||r.date<=a.date).slice(-sessions);
 if(!Number.isFinite(cur)||cur<=0||!Number.isFinite(tolerance)||rows.length<2)return {support:[],resistance:[],tolerance,window:sessions,usedRows:rows.length};
 const points=[];
 const add=(raw,kind,side,role,date,age)=>{if(!Number.isFinite(raw)||raw<=0)return;const price=tradePrice(raw);if(!price||price===cur)return;points.push({raw,price,kind,side,role,date,age})};
 for(let i=0;i<rows.length;i++){
  const r=rows[i],later=rows.slice(i+1),age=rows.length-1-i;
  if(Number.isFinite(r.low)&&r.low<cur)add(r.low,'low','support','direct-low',r.date,age);
  if(Number.isFinite(r.high)&&r.high>cur)add(r.high,'high','resistance','direct-high',r.date,age);
  if(Number.isFinite(r.high)&&r.high<cur&&later.some(x=>Number.isFinite(x.close)&&x.close>r.high))add(r.high,'high','support','broken-high-retest',r.date,age);
  if(Number.isFinite(r.low)&&r.low>cur&&later.some(x=>Number.isFinite(x.close)&&x.close<r.low))add(r.low,'low','resistance','broken-low-retest',r.date,age);
 }
 const cluster=side=>{
  const arr=points.filter(p=>p.side===side).sort((x,y)=>side==='support'?y.price-x.price||x.age-y.age:x.price-y.price||x.age-y.age),groups=[];
  for(const p of arr){
   const last=groups.at(-1),tick=Math.max(tickSize(p.price),last?tickSize(last.anchor):0);
   if(last&&Math.abs(p.price-last.anchor)<=tolerance+tick+1e-8){last.low=Math.min(last.low,p.price);last.high=Math.max(last.high,p.price);last.points.push(p);continue}
   groups.push({side,anchor:p.price,low:p.price,high:p.price,points:[p]});
  }
  return groups.map(g=>{
   const dates=[...new Set(g.points.map(p=>p.date).filter(Boolean))],direct=g.points.filter(p=>p.role===(side==='support'?'direct-low':'direct-high'));
   return {...g,price:side==='support'?g.high:g.low,bandLow:tradePrice(g.low,'floor'),bandHigh:tradePrice(g.high,'ceil'),uniqueSessions:dates.length,dates,pointCount:g.points.length,directSessions:[...new Set(direct.map(p=>p.date).filter(Boolean))].length,roles:[...new Set(g.points.map(p=>p.role))],qualified:dates.length>=2&&direct.length>0};
  }).filter(g=>g.qualified);
 };
 return {support:cluster('support'),resistance:cluster('resistance'),tolerance,window:sessions,usedRows:rows.length,noLookahead:true};
}
function overlaps(level,band){
 if(!level||!band)return false;const low=Number.isFinite(level.bandLow)?level.bandLow:level.price,high=Number.isFinite(level.bandHigh)?level.bandHigh:level.price,tick=Math.max(tickSize(low),tickSize(high),tickSize(band.bandLow),tickSize(band.bandHigh));
 return band.bandLow<=high+tick+1e-8&&band.bandHigh>=low-tick-1e-8;
}
function reactionLevel(a,band,side){
 const price=tradePrice(side==='support'?band.bandHigh:band.bandLow);
 return {price,bandLow:band.bandLow,bandHigh:band.bandHigh,distance:(price-a.current)/a.current,sources:[`近${band.uniqueSessions}個交易日OHLC反應區`],score:null,confidence:null,strength:'近期反應共振',isStructural:true,reactionReference:{uniqueSessions:band.uniqueSessions,dates:band.dates,roles:band.roles,tolerance:reactionTolerance(a),noLookahead:true}};
}
function mergeLevel(a,key,band,side,{preservePrice=false}={}){
 const level=a?.[key];if(!level||!overlaps(level,band))return {key,accepted:false,reason:level?'no-overlap':'level-not-formed'};
 const before={price:level.price,bandLow:level.bandLow,bandHigh:level.bandHigh},low=Math.min(level.bandLow??level.price,band.bandLow),high=Math.max(level.bandHigh??level.price,band.bandHigh),edge=tradePrice(side==='support'?high:low),price=preservePrice?level.price:edge;
 level.price=price;level.bandLow=tradePrice(low,'floor');level.bandHigh=tradePrice(high,'ceil');level.distance=(price-a.current)/a.current;level.sources=[...new Set([...(level.sources||[]),`近${band.uniqueSessions}個交易日OHLC反應區`])];level.reactionReference={uniqueSessions:band.uniqueSessions,dates:band.dates,roles:band.roles,tolerance:reactionTolerance(a),noLookahead:true};
 if(a.selectionAudit?.levels?.[key]){a.selectionAudit.levels[key].price=price;a.selectionAudit.levels[key].bandLow=level.bandLow;a.selectionAudit.levels[key].bandHigh=level.bandHigh}
 return {key,accepted:true,before,after:{price,bandLow:level.bandLow,bandHigh:level.bandHigh},band};
}
function firstIndependent(bands,level){const high=level?.bandHigh??level?.price;return bands.find(b=>!level||b.bandLow>high+Math.max(tickSize(b.bandLow),tickSize(high))+1e-8)||null}
function applyRecentReactionOverlay(payload){
 const a=payload?.analysis;if(!a)return payload;const review=recentReactionBands(a),checks=[];
 const supportBands=review.support.filter(b=>(a.current-b.price)/a.current<=.20+1e-8),resistanceBands=review.resistance.filter(b=>(b.price-a.current)/a.current<=.20+1e-8);
 for(const key of ['support1','support2']){const level=a[key],band=level&&supportBands.find(b=>overlaps(level,b));if(band)checks.push(mergeLevel(a,key,band,'support'))}
 if(!a.support1&&supportBands[0]){a.support1=reactionLevel(a,supportBands[0],'support');checks.push({key:'support1',accepted:true,created:true,band:supportBands[0]})}
 if(!a.support2&&a.support1){const b=supportBands.find(x=>x.bandHigh<a.support1.bandLow-Math.max(tickSize(x.bandHigh),tickSize(a.support1.bandLow))+1e-8);if(b){a.support2=reactionLevel(a,b,'support');checks.push({key:'support2',accepted:true,created:true,band:b})}}
 let firstKey=a.breakout?'breakout':a.resistance1?'resistance1':a.mediumResistance?'mediumResistance':null;
 if(firstKey){const level=a[firstKey],band=resistanceBands.find(b=>overlaps(level,b));if(band)checks.push(mergeLevel(a,firstKey,band,'resistance',{preservePrice:firstKey==='breakout'}))}
 if(!firstKey&&resistanceBands[0]){const l=reactionLevel(a,resistanceBands[0],'resistance');if(l.distance<=.10+1e-8){a.resistance1=l;firstKey='resistance1';checks.push({key:'resistance1',accepted:true,created:true,band:resistanceBands[0]})}else{a.mediumResistance=l;firstKey='mediumResistance';checks.push({key:'mediumResistance',accepted:true,created:true,band:resistanceBands[0]})}}
 const first=a.breakout||a.resistance1||a.mediumResistance;
 if(a.resistance2){const band=resistanceBands.find(b=>overlaps(a.resistance2,b));if(band)checks.push(mergeLevel(a,'resistance2',band,'resistance'))}
 else if(first){const b=firstIndependent(resistanceBands,first);if(b){const l=reactionLevel(a,b,'resistance');if(l.distance<=.10+1e-8){a.resistance2=l;checks.push({key:'resistance2',accepted:true,created:true,band:b})}else if(!a.mediumResistance&&l.distance<=.20+1e-8){a.mediumResistance=l;checks.push({key:'mediumResistance',accepted:true,created:true,band:b})}}}
 if(a.breakout)a.resistance1=null;
 const keys=['support1','support2','breakout','resistance1','resistance2','mediumResistance'];a.levelStatus=Object.fromEntries(keys.map(k=>[k,a[k]?'已形成':'尚未形成']));
 a.reactionReview={version:'recent-ohlc-reaction-v1',window:review.window,usedRows:review.usedRows,tolerance:review.tolerance,noLookahead:true,requiresDistinctSessions:true,createsOnlyRepeatedReactionBands:true,supportBands:review.support,resistanceBands:review.resistance,checks};
 a.rulePolicy={...(a.rulePolicy||{}),recentReactionOverlay:'最近12個交易日高低點反應區；至少2個不同交易日且含直接高/低點才成立。已突破前高／跌破前低可作角色轉換證據；不讀取次日資料。'};
 return payload;
}
export {reactionTolerance,recentReactionBands,applyRecentReactionOverlay};
