const fs=require('fs'),vm=require('vm'),source=fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),refs=JSON.parse(fs.readFileSync('public/data/photo-references.json')).items;
const cases=JSON.parse(fs.readFileSync('tests/regression-cases.json')).cases;
const inputs=JSON.parse(fs.readFileSync('research/pivot-role-inputs.json'));
const decode=entry=>entry.rows.map(r=>Object.fromEntries(inputs.fields.map((k,i)=>[k,r[i]])));
const stocks=Object.fromEntries(inputs.items.filter(x=>x.group==='photo').map(x=>[x.code,decode(x)]));
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(source,c);return c}
function run(rows,policy){const c=boot();c.rows=JSON.parse(JSON.stringify(rows));c.policy=policy;return JSON.parse(JSON.stringify(vm.runInContext(`(()=>{
 const a=analyze(rows),end=rows.length-1,cur=a.current;
 let cs=analysisCandidates.get(a).filter(c=>c.age<100);
 const add=(p,type,label,age)=>cs.push({price:p,type,label,age,base:2});
 if(policy.volume15)cs=cs.filter(c=>c.type!=="volume"||rows[end-c.age].volRatio>=1.5);
 if(policy.excludeHigh)cs=cs.filter(c=>c.label!=="爆量K高點");
 if(policy.companions)for(let j=Math.max(2,end-99);j<rows.length-2;j++){
  const r=rows[j],n=[rows[j-2],rows[j-1],rows[j+1],rows[j+2]],hi=n.every(x=>r.high>x.high),lo=n.every(x=>r.low<x.low);
  if(hi){add(r.low,"pivotCompanion","樞紐高點K棒低點",end-j);add(r.close,"pivotCompanion","樞紐高點K棒收盤",end-j);add(r.open,"pivotCompanion","樞紐高點K棒開盤",end-j)}
  if(lo){add(r.high,"pivotCompanion","樞紐低點K棒高點",end-j);add(r.close,"pivotCompanion","樞紐低點K棒收盤",end-j);add(r.open,"pivotCompanion","樞紐低點K棒開盤",end-j)}
 }
 if(policy.transform){cs=cs.filter(c=>c.type!=="pivotHigh"||c.price<=cur);
  for(let j=Math.max(2,end-99);j<rows.length-2;j++){const r=rows[j],n=[rows[j-2],rows[j-1],rows[j+1],rows[j+2]];if(n.every(x=>r.high>x.high)&&r.high>cur){const bh=Math.max(r.open,r.close),bl=Math.min(r.open,r.close),p=r.low>cur?r.low:bl>cur?bl:bh>cur?bh:r.high;add(p,"pivotRole","供給結構下緣",end-j)}}
 }
 if(policy.bodyPivots)for(let j=Math.max(2,end-99);j<rows.length-2;j++){const r=rows[j],n=[rows[j-2],rows[j-1],rows[j+1],rows[j+2]];if(n.every(x=>Math.max(r.open,r.close)>Math.max(x.open,x.close)))add(r.low,"bodyPivot","實體樞紐K棒低點",end-j)}
 if(policy.breakRetest)for(let j=Math.max(1,end-99);j<rows.length;j++)if(rows[j].close>rows[j-1].high&&(rows[j].volRatio>=1.5||!policy.requireVolume))add(rows[j-1].high,"retest","收盤突破前一高點",end-j);
 return calibrateVisibleRules(a,rows,cs);
})()`,c)))}
const policies=[];for(const companions of [false,true])for(const transform of [false,true])for(const bodyPivots of [false,true])for(const breakRetest of [false,true])for(const volume15 of [false,true])for(const excludeHigh of [false,true])policies.push({companions,transform,bodyPivots,breakRetest,volume15,excludeHigh,requireVolume:true});
const output=[];
for(const policy of policies){let train=0,total=0,hold=0,holdTotal=0,detail=[];
for(const r of refs){const a=run(stocks[r.code],policy);let m=0;for(const l of r.levels){const act=['breakout','resistance1'].includes(l.key)?a.breakout||a.resistance1:['resistance2','mediumResistance'].includes(l.key)?a.resistance2||a.mediumResistance:a[l.key];m+=act?.price===l.price?1:0;total++;}train+=m;detail.push({code:r.code,match:m,prices:[a.support1?.price,a.support2?.price,(a.breakout||a.resistance1)?.price,(a.resistance2||a.mediumResistance)?.price]});}
for(const r of cases){const item=inputs.items.find(x=>x.group==='historical'&&x.code===r.code&&x.date===r.baseDate);if(!item)continue;const a=run(decode(item),policy);for(const [key,l] of Object.entries(r.expected)){if(!l?.price)continue;const act=['breakout','resistance1'].includes(key)?a.breakout||a.resistance1:['resistance2','mediumResistance'].includes(key)?a.resistance2||a.mediumResistance:a[key];hold+=act?.price===l.price?1:0;holdTotal++;}}
output.push({policy,train,total,hold,holdTotal,detail});}
output.sort((a,b)=>b.train-a.train||Object.entries(a.policy).filter(([k,v])=>k!=='requireVolume'&&v).length-Object.entries(b.policy).filter(([k,v])=>k!=='requireVolume'&&v).length);fs.writeFileSync(process.argv[2]||'/tmp/pivot-role-results.json',JSON.stringify({status:'研究假設，不是原公式；未套用正式系統。歷史對照並非盲測，僅比較提供的主價，不評估未提供欄位、命名或價格帶。',inputSource:inputs.source,variants:output},null,2)+'\n');for(const key of ['companions','transform','bodyPivots','breakRetest','volume15']){const p=output.find(x=>x.policy[key]&&Object.entries(x.policy).filter(([k])=>k!==key&&k!=='requireVolume').every(([,v])=>!v));console.log(key,p.train+'/20',p.hold+'/34')}console.log('best photograph matches',output[0].train+'/20');
