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
 const baseDate=typeof a?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)?a.date:null;
 const rows=baseDate?all.filter(r=>typeof r?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<=baseDate).sort((x,y)=>x.date.localeCompare(y.date)).slice(-sessions):[];
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
function independentBelow(candidate,upper){
 if(!candidate||!upper)return false;const ch=candidate.bandHigh??candidate.price,ul=upper.bandLow??upper.price,tick=Math.max(tickSize(ch),tickSize(ul));return ch<ul-tick-1e-8;
}
function independentAbove(candidate,lower){
 if(!candidate||!lower)return false;const cl=candidate.bandLow??candidate.price,lh=lower.bandHigh??lower.price,tick=Math.max(tickSize(cl),tickSize(lh));return cl>lh+tick+1e-8;
}
function cloneLevel(level){return level?{...level,sources:[...(level.sources||[])],reactionReference:level.reactionReference?{...level.reactionReference}:undefined}:null}
function reactionLevel(a,band,side){
 const price=tradePrice(side==='support'?band.bandHigh:band.bandLow);
 return {price,bandLow:band.bandLow,bandHigh:band.bandHigh,distance:(price-a.current)/a.current,sources:[`${band.uniqueSessions}個交易日重複OHLC反應區`],score:null,confidence:null,strength:'近期反應共振',isStructural:true,reactionReference:{uniqueSessions:band.uniqueSessions,dates:band.dates,roles:band.roles,tolerance:reactionTolerance(a),noLookahead:true}};
}
function mergeLevel(a,key,band,side,{preservePrice=false}={}){
 const level=a?.[key];if(!level||!overlaps(level,band))return {key,accepted:false,reason:level?'no-overlap':'level-not-formed'};
 const before={price:level.price,bandLow:level.bandLow,bandHigh:level.bandHigh},low=Math.min(level.bandLow??level.price,band.bandLow),high=Math.max(level.bandHigh??level.price,band.bandHigh),edge=tradePrice(side==='support'?high:low),price=preservePrice?level.price:edge;
 level.price=price;level.bandLow=tradePrice(low,'floor');level.bandHigh=tradePrice(high,'ceil');level.distance=(price-a.current)/a.current;level.sources=[...new Set([...(level.sources||[]),`${band.uniqueSessions}個交易日重複OHLC反應區`])];level.reactionReference={uniqueSessions:band.uniqueSessions,dates:band.dates,roles:band.roles,tolerance:reactionTolerance(a),noLookahead:true};
 if(a.selectionAudit?.levels?.[key]){a.selectionAudit.levels[key].price=price;a.selectionAudit.levels[key].bandLow=level.bandLow;a.selectionAudit.levels[key].bandHigh=level.bandHigh}
 return {key,accepted:true,before,after:{price,bandLow:level.bandLow,bandHigh:level.bandHigh},band};
}
function mergeExistingWithReaction(a,key,bands,side,checks,{preservePrice=false}={}){
 const level=a?.[key];if(!level)return;
 const band=bands.find(b=>overlaps(level,b));if(!band)return;
 checks.push(mergeLevel(a,key,band,side,{preservePrice}));
}
function distinctLevels(levels,side){
 const ordered=levels.filter(Boolean).sort((x,y)=>side==='support'?y.price-x.price:x.price-y.price),out=[];
 for(const level of ordered){if(out.some(x=>overlaps(x,level)))continue;out.push(level)}return out;
}
function selectSupportLevels(a,supportBands,checks){
 mergeExistingWithReaction(a,'support1',supportBands,'support',checks);
 mergeExistingWithReaction(a,'support2',supportBands,'support',checks);
 const existing=[cloneLevel(a.support1),cloneLevel(a.support2)],reaction=supportBands.filter(b=>!existing.some(l=>l&&overlaps(l,b))).map(b=>reactionLevel(a,b,'support'));
 const pool=distinctLevels([...existing,...reaction].filter(l=>l&&l.price<a.current&&(a.current-l.price)/a.current<=.20+1e-8),'support');
 const first=pool[0]||null,second=first?pool.find(l=>independentBelow(l,first))||null:null;
 const before={support1:a.support1?.price??null,support2:a.support2?.price??null};
 a.support1=first;a.support2=second;
 if(first&&!second)a.support2Note='尚未找到低於第一支撐價格帶的獨立第二支撐，待確認。';else if(!first)a.support2Note='第一支撐結構不足，第二支撐待確認。';else a.support2Note='';
 if(before.support1!==a.support1?.price||before.support2!==a.support2?.price)checks.push({key:'support-ranking',accepted:true,reason:'nearest-qualified-independent-structure',before,after:{support1:a.support1?.price??null,support2:a.support2?.price??null}});
}
function selectPressureLevels(a,resistanceBands,checks){
 mergeExistingWithReaction(a,'breakout',resistanceBands,'resistance',checks,{preservePrice:true});
 mergeExistingWithReaction(a,'resistance1',resistanceBands,'resistance',checks);
 mergeExistingWithReaction(a,'resistance2',resistanceBands,'resistance',checks);
 mergeExistingWithReaction(a,'mediumResistance',resistanceBands,'resistance',checks);
 const existing=[cloneLevel(a.resistance1),cloneLevel(a.resistance2),cloneLevel(a.mediumResistance)],reaction=resistanceBands.filter(b=>![a.breakout,...existing].some(l=>l&&overlaps(l,b))).map(b=>reactionLevel(a,b,'resistance'));
 const before={breakout:a.breakout?.price??null,resistance1:a.resistance1?.price??null,resistance2:a.resistance2?.price??null,mediumResistance:a.mediumResistance?.price??null};
 if(a.breakout){
  a.resistance1=null;
  const above=distinctLevels([...existing,...reaction].filter(l=>l&&l.price>a.current&&independentAbove(l,a.breakout)&&(l.price-a.current)/a.current<=.20+1e-8),'resistance');
  const second=above.find(l=>(l.price-a.current)/a.current<=.10+1e-8)||null;
  a.resistance2=second;
  a.mediumResistance=above.find(l=>(l.price-a.current)/a.current>.10+1e-8&&independentAbove(l,second||a.breakout))||null;
 }else{
  const pool=distinctLevels([...existing,...reaction].filter(l=>l&&l.price>a.current&&(l.price-a.current)/a.current<=.20+1e-8),'resistance'),first=pool[0]||null;
  if(!first){a.resistance1=null;a.resistance2=null;a.mediumResistance=null}
  else if((first.price-a.current)/a.current>.10+1e-8){a.resistance1=null;a.resistance2=null;a.mediumResistance=first}
  else{
   a.resistance1=first;
   const second=pool.find(l=>independentAbove(l,first))||null;
   a.resistance2=second&&(second.price-a.current)/a.current<=.10+1e-8?second:null;
   const mediumStart=a.resistance2||first;
   a.mediumResistance=pool.find(l=>independentAbove(l,mediumStart)&&(l.price-a.current)/a.current>.10+1e-8)||null;
  }
 }
 const after={breakout:a.breakout?.price??null,resistance1:a.resistance1?.price??null,resistance2:a.resistance2?.price??null,mediumResistance:a.mediumResistance?.price??null};
 if(Object.keys(before).some(k=>before[k]!==after[k]))checks.push({key:'pressure-ranking',accepted:true,reason:a.breakout?'breakout-kept-first-then-nearest-independent-upper-structure':'nearest-qualified-independent-structure',before,after});
}
function syncSelectionAudit(a){
 if(!a.selectionAudit)return;const out={};for(const key of ['support1','support2','breakout','resistance1','resistance2','mediumResistance']){const l=a[key];if(l)out[key]={price:l.price,bandLow:l.bandLow,bandHigh:l.bandHigh,sources:[...(l.sources||[])]}}
 a.selectionAudit.finalPublishedLevelsAfterReaction=out;
}
function applyRecentReactionOverlay(payload){
 const a=payload?.analysis;if(!a)return payload;const review=recentReactionBands(a),checks=[];
 const supportBands=review.support.filter(b=>(a.current-b.price)/a.current<=.20+1e-8),resistanceBands=review.resistance.filter(b=>(b.price-a.current)/a.current<=.20+1e-8);
 selectSupportLevels(a,supportBands,checks);
 selectPressureLevels(a,resistanceBands,checks);
 if(a.breakout)a.resistance1=null;
 const keys=['support1','support2','breakout','resistance1','resistance2','mediumResistance'];a.levelStatus=Object.fromEntries(keys.map(k=>[k,a[k]?'已形成':'尚未形成']));
 syncSelectionAudit(a);
 a.reactionReview={version:'recent-ohlc-reaction-v2',window:review.window,usedRows:review.usedRows,tolerance:review.tolerance,noLookahead:true,requiresDistinctSessions:true,createsOnlyRepeatedReactionBands:true,rankingPolicy:'原始結構與合格近期反應區共同依距現價最近、價格帶互相獨立排序；突破共振區存在時保留其第一帶角色。',supportBands:review.support,resistanceBands:review.resistance,checks};
 a.rulePolicy={...(a.rulePolicy||{}),recentReactionOverlay:'最近12個交易日高低點反應區；至少2個不同交易日且含直接高/低點才成立。與原始結構共同按距現價最近且價格帶獨立排序；已突破前高／跌破前低只作角色轉換證據；不讀取次日資料。'};
 return payload;
}
export {reactionTolerance,recentReactionBands,applyRecentReactionOverlay};
