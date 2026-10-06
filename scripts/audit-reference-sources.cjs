// Evidence for reference comparisons, never an input to the forecasting engine.
const fs=require('node:fs'),path=require('node:path');
const [reportFile,snapshotDir]=process.argv.slice(2);
const report=JSON.parse(fs.readFileSync(reportFile));
const periods=[5,10,13,20,30,60,120],fields=['open','high','low','close'];
const actions=JSON.parse(fs.readFileSync('public/data/ex-rights-2026-10-05.json'));
const tick=p=>p<10?.01:p<50?.05:p<100?.1:p<500?.5:p<1000?1:5;
const round=p=>Number((Math.round(p/tick(p))*tick(p)).toFixed(4));
const same=(a,b)=>Math.abs(a-b)<1e-7;
const fieldNames={open:'開盤',high:'最高',low:'最低',close:'收盤'};
report.sourceAudit={
 status:'hypotheses-only',
 scope:`僅查核 ${report.baseDate} 收盤以前行情；同價紀錄只能提供線索，不能證明原公式或選取理由。`,
 methods:['日K開高低收精確同價','當日收盤SMA／EMA：5、10、13、20、30、60、120日','已驗證除權息比例調整後的日K同價'],
 corrections:['大同第二壓力：當日高點加入已確認樞紐區時，優先採區內最近歷史爆量K收盤作主價，保留整個價帶。','禾伸堂第一支撐：缺口區內已有確認樞紐低點時，以樞紐低點界定下緣。兩條規則仍為推定。'],
 unresolved:[]
};
for(const result of report.results){
 if(result.status!=='compared')continue;
 const snapshot=JSON.parse(fs.readFileSync(path.join(snapshotDir,result.code+'.json')));
 const rows=snapshot.rows.filter(r=>r.date<=report.baseDate);
 const events=actions.events.filter(e=>e.code===result.code&&e.market===snapshot.market&&e.date<=report.baseDate);
 const ma=periods.filter(n=>rows.length>=n).flatMap(n=>{
  const simple=rows.slice(-n).reduce((s,r)=>s+r.close,0)/n;
  const exponential=rows.slice(1).reduce((s,r)=>r.close*2/(n+1)+s*(1-2/(n+1)),rows[0].close);
  return [{kind:`SMA${n}`,value:round(simple)},{kind:`EMA${n}`,value:round(exponential)}];
 });
 for(const [key,check] of Object.entries(result.checks)){
  if(!check.expected)continue;
  const targets=new Map();
  for(const [role,label] of [['price','主價'],['bandLow','價帶下緣'],['bandHigh','價帶上緣']]){
   const p=check.expected[role];if(p==null||same(check.actual?.[role]??NaN,p))continue;
   if(!targets.has(p))targets.set(p,[]);targets.get(p).push(label);
  }
  for(const [price,roles] of targets){
   const direct=[],adjusted=[];
   for(const r of rows)for(const f of fields){
    if(same(r[f],price))direct.push({date:r.date,field:fieldNames[f]});
    const factor=events.filter(e=>e.date>r.date).reduce((a,e)=>a*e.factor,1);
    if(factor!==1&&same(round(r[f]*factor),price))adjusted.push({date:r.date,field:fieldNames[f]});
   }
   report.sourceAudit.unresolved.push({code:result.code,name:result.name,key,price,roles,direct,adjusted,movingAverages:ma.filter(m=>same(m.value,price)),finding:direct.length?'存在同價日K，仍需確認其被選為位點的條件。':adjusted.length?'存在權息調整後同價日K，調整方式仍需確認。':ma.some(m=>same(m.value,price))?'存在指定均線同價，但不能證明原系統使用此均線。':'在本次檢查的日K、權息調整及指定均線中未找到同價來源；不能唯一反推。'});
  }
 }
}
fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({unresolvedPrices:report.sourceAudit.unresolved.length,directSourceClues:report.sourceAudit.unresolved.filter(x=>x.direct.length).length,methods:report.sourceAudit.methods}));
