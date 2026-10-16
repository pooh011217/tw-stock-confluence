#!/usr/bin/env node
// Compare frozen external photo reference with system D-day analysis export.
// Input JSON: {results:[{stock:{code},analysis:{date,support1,support2,breakout,resistance1,resistance2,mediumResistance}}]}
// D+1 OHLC must NEVER be passed into this comparison.
const fs=require('node:fs');
const reference=[
 ['3406','玉晶光',1095,1070,1130,1175,'breakout'],
 ['3026','禾伸堂',806,770,832,867,'breakout'],
 ['8046','南電',1340,1310,1400,1520,'resistance1','mediumResistance'],
 ['3037','欣興',1065,1035,1105,1140,'breakout'],
 ['2472','立隆電',226.5,216,233.5,244,'resistance1'],
 ['6274','台燿',1620,1580,1660,1720,'resistance1'],
 ['6285','啟碁',240.5,234,246,254,'resistance1'],
 ['3264','欣銓',266,261,271,281.5,'resistance1'],
 ['2327','國巨',572,556,581,603,'resistance1'],
 ['6197','佳必琪',354,344,359,369.5,'resistance1'],
 ['6257','矽格',257.5,249,262,276,'resistance1']
];
if(process.argv.length<3){console.error('Usage: node scripts/compare-photo-20261015.cjs <system-2026-10-15.json>');process.exit(2)}
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const arr=Array.isArray(data)?data:Array.isArray(data.results)?data.results:[data];
const byCode=new Map(arr.map(x=>[String(x.stock?.code||x.code||x.analysis?.code||x.stockCode||''),x]));
const expectedCodes=new Set(reference.map(x=>x[0]));
const absent=[...expectedCodes].filter(code=>!byCode.has(code));
if(absent.length)throw Error('Missing stock output: '+absent.join(','));
if(byCode.size!==arr.length)throw Error('Duplicate stock code or missing code in system export');
let total=0,matched=0,missing=0,roleDiff=0,sumAbsPct=0,compared=0;
console.log('stock,field,reference,system,delta,absolute_pct,role_mismatch,band_low,band_high');
for(const [code,name,s1,s2,p1,p2,pressureKey,upperKey] of reference){
 const entry=byCode.get(code),a=entry?.analysis||entry?.levels||entry;
 const baseDate=entry?.analysis?.date||entry?.date;
 if(baseDate!=='2026-10-15')throw Error(code+': invalid D date '+baseDate);
 const expected=[['support1',s1],['support2',s2],[pressureKey,p1],[upperKey||'resistance2',p2]];
 for(const [key,value] of expected){
  const level=a?.[key]||null;
  const other=key==='breakout'?'resistance1':key==='resistance1'?'breakout':key==='mediumResistance'?'resistance2':key==='resistance2'?'mediumResistance':null;
  const actual=level?.price;
  if(actual!=null&&!Number.isFinite(actual))throw Error(code+': invalid numeric price for '+key);
  const mismatch=!level&&!!other&&!!a?.[other];
  total++;if(mismatch)roleDiff++;
  if(actual==null)missing++;else {compared++;sumAbsPct+=Math.abs(actual-value)/value*100;if(Math.abs(actual-value)<1e-8)matched++;}
  const diff=actual==null?'':Number((actual-value).toFixed(4));
  const pct=actual==null?'':Number((Math.abs(actual-value)/value*100).toFixed(4));
  console.log([code+' '+name,key,value,actual??'',diff,pct,mismatch,level?.bandLow??'',level?.bandHigh??''].join(','));
 }
}
console.error(JSON.stringify({total,matched,missing,roleDiff,priceMatchRate:matched/total,meanAbsPhotoPct:compared?sumAbsPct/compared:null},null,2));
