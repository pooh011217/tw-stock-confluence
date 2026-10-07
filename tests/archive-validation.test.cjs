const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const snapshot=JSON.parse(fs.readFileSync('public/data/history/2026-10-05/2351.json'));
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);c.assets={fetch:async()=>new Response(JSON.stringify(snapshot))};vm.runInContext('resolve=async()=>({code:"2351",name:"順德",market:"TWSE"});history=async()=>{throw new Error("snapshot must remain calculation source")};latestCompletedDate=()=>"2026-10-06"',c);return c}
test('a past snapshot loads independent next-session OHLC and checks without changing predicted levels',async()=>{
 const c=boot();vm.runInContext('twseMonth=async()=>[]',c);const before=await vm.runInContext('analyzeOne("2351","2026-10-05",assets)',c);c.next={date:'2026-10-06',open:224,high:230,low:220,close:225,volume:100000};vm.runInContext('twseMonth=async()=>[next]',c);const after=await vm.runInContext('analyzeOne("2351","2026-10-05",assets)',c);
 assert.deepEqual(JSON.parse(JSON.stringify(after.analysis)),JSON.parse(JSON.stringify(before.analysis)));assert.equal(after.backtest.actual.close,225);assert.equal(after.backtest.predictionFor,'2026-10-06');assert.equal(after.backtest.validationStatus,'available');assert.ok(after.backtest.checks.breakout);assert.ok(Number.isFinite(after.backtest.maePct));assert.match(after.source,/隔日實績已驗證/);
});
test('unavailable validation never turns into zero error or prevents use of the valid snapshot',async()=>{
 const c=boot();vm.runInContext('twseMonth=async()=>{throw new Error("validation source unavailable")}',c);const d=await vm.runInContext('analyzeOne("2351","2026-10-05",assets)',c);assert.equal(d.analysis.current,222);assert.equal(d.backtest.actual,null);assert.equal(d.backtest.checks,null);assert.equal(d.backtest.maePct,null);assert.equal(d.backtest.bandHitRate,null);assert.equal(d.backtest.validationStatus,'unavailable');assert.match(d.source,/隔日實績尚未載入/);
});
test('an uncompleted next session is not fetched or inferred from the future',async()=>{
 const c=boot();vm.runInContext('latestCompletedDate=()=>"2026-10-05";twseMonth=async()=>{throw new Error("must not fetch the future")}',c);const d=await vm.runInContext('analyzeOne("2351","2026-10-05",assets)',c);assert.equal(d.backtest.actual,null);assert.equal(d.backtest.validationStatus,'not-yet-completed');
});
test('archive-validation repair leaves every level calculation function unchanged',()=>{
 const c=boot(),old=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(execFileSync('git',['show','8a13ca7:src/worker.js'],{encoding:'utf8'}).replace('export default','globalThis.worker='),old);for(const name of ['analyze','derivePhotoPressure','calibrateVisibleRules','selectSecondSupport','selectPressureLevels','structuralBands','tradePrice'])assert.equal(vm.runInContext(name+'.toString()',c),vm.runInContext(name+'.toString()',old));
});
