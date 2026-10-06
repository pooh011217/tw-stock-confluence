const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const fixture=JSON.parse(fs.readFileSync('public/data/history/2026-10-05/2351.json'));
function boot(source=fs.readFileSync('src/worker.js','utf8')){
 const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});
 vm.runInContext(source.replace('export default','globalThis.worker='),c);return c;
}
test('Shunde retains V3.3.44 support and breakout, exposing the skipped independent pressure',()=>{
 const old=boot(execFileSync('git',['show','026022d:src/worker.js'],{encoding:'utf8'})),next=boot();
 old.rows=structuredClone(fixture.rows);next.rows=structuredClone(fixture.rows);
 const before=JSON.parse(JSON.stringify(vm.runInContext('analyze(rows)',old))),after=JSON.parse(JSON.stringify(vm.runInContext('analyze(rows)',next)));
 assert.equal(after.date,'2026-10-05');assert.equal(after.current,222);
 for(const key of ['support1','support2','breakout'])assert.deepEqual(after[key],before[key]);
 assert.equal(before.resistance2,null);assert.equal(before.mediumResistance.price,247);
 assert.equal(after.resistance1,null);assert.equal(after.mediumResistance,null);
 assert.equal(after.resistance2.price,235.5);assert.equal(after.resistance2.bandLow,233);assert.equal(after.resistance2.bandHigh,236);
 assert.ok(after.resistance2.bandLow>after.breakout.bandHigh);
 assert.ok(fixture.rows.some(r=>r.close===after.resistance2.price));
 assert.ok(fixture.rows.every(r=>r.date<='2026-10-05'));
});
test('dated snapshot validates identity, ordered dates and OHLC before use',async()=>{
 for(const mutate of [j=>j,j=>({...j,code:'3211'}),j=>({...j,baseDate:'2026-10-06'}),j=>({...j,rows:[...j.rows,{...j.rows.at(-1),date:'2026-10-06'}]}),j=>({...j,rows:[...j.rows.slice(0,-1),{...j.rows.at(-1),close:9999}]}),j=>({...j,rows:j.rows.slice(-10)})]){
  const c=boot(),data=mutate(structuredClone(fixture));c.assets={fetch:async()=>new Response(JSON.stringify(data))};
  const result=await vm.runInContext('archivedHistory({code:"2351",market:"TWSE"},"2026-10-05",assets)',c);
  assert.equal(Boolean(result),data===undefined?false:data.code==='2351'&&data.baseDate==='2026-10-05'&&data.rows.length===265&&data.rows.at(-1).close===222);
 }
});
test('historical API uses snapshot without substituting stale history or future performance',async()=>{
 const c=boot();c.assets={fetch:async()=>new Response(JSON.stringify(fixture))};
 vm.runInContext('resolve=async()=>({code:"2351",name:"順德",market:"TWSE"});history=async()=>{throw new Error("stale source must not be used")}',c);
 const d=await vm.runInContext('analyzeOne("2351","2026-10-05",assets)',c);
 assert.equal(d.stock.name,'順德');assert.equal(d.backtest.baseDate,'2026-10-05');assert.equal(d.backtest.noLookahead,true);
 assert.equal(d.analysis.resistance2.price,235.5);assert.equal(d.backtest.actual,null);assert.equal(d.backtest.checks,null);assert.equal(d.backtest.bandHitRate,null);
 assert.match(d.source,/快照/);
});
