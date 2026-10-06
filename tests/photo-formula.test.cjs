const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fixture=JSON.parse(fs.readFileSync('public/data/history/2026-10-05/2351.json'));
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
function run(rows){const c=boot();c.rows=rows;return JSON.parse(JSON.stringify(vm.runInContext('derivePhotoPressure(rows,analyze(rows))',c)))}
test('photo hypothesis reproduces visible Shunde prices and one-decimal distance labels',()=>{
 const a=run(structuredClone(fixture.rows));assert.equal(a.photoPolicy.matched,true);
 assert.equal(a.photoPolicy.tolerance,6.5);assert.equal(a.breakout.price,226.5);
 assert.equal(a.breakout.bandLow,226.5);assert.equal(a.breakout.bandHigh,233);
 assert.equal(a.resistance2.price,241.5);assert.equal(a.photoPolicy.secondSource.date,'2026-09-18');
 assert.equal((a.breakout.distance*100).toFixed(1),'2.0');assert.equal((a.resistance2.distance*100).toFixed(1),'8.8');
 assert.equal(a.resistance1,null);assert.equal(a.mediumResistance,null);assert.equal(a.breakout.confidence,null);
 assert.ok(a.resistance2.bandLow>a.breakout.bandHigh);
});
test('translated OHLC shifts every reconstructed anchor without symbol/date/price overrides',()=>{
 const rows=fixture.rows.map(r=>({...r,open:r.open+10,high:r.high+10,low:r.low+10,close:r.close+10})),a=run(rows);
 assert.equal(a.breakout.price,236.5);assert.equal(a.breakout.bandHigh,243);assert.equal(a.resistance2.price,251.5);assert.equal(a.photoPolicy.tolerance,6.5);
});
test('group does not chain beyond the original volatility window',()=>{
 const a=run(structuredClone(fixture.rows));assert.ok(a.breakout.bandHigh<=a.breakout.price+a.photoPolicy.tolerance);
 assert.equal(a.breakout.bandHigh,233);assert.notEqual(a.breakout.bandHigh,236);
});
test('photo mode uses a dated snapshot and standard mode remains independently selectable',async()=>{
 const c=boot();c.assets={fetch:async()=>new Response(JSON.stringify(fixture))};
 vm.runInContext('resolve=async()=>({code:"2351",name:"順德",market:"TWSE"});history=async()=>{throw new Error("snapshot required")}',c);
 const photo=await vm.runInContext('analyzeOne("2351","2026-10-05",assets,"photo-inferred")',c);
 const standard=await vm.runInContext('analyzeOne("2351","2026-10-05",assets,"standard")',c);
 assert.equal(photo.analysis.breakout.price,226.5);assert.equal(photo.analysis.resistance2.price,241.5);
 assert.equal(standard.analysis.breakout.price,226);assert.equal(standard.analysis.resistance2.price,239.5);
 for(const key of ['support1','support2'])assert.deepEqual(JSON.parse(JSON.stringify(photo.analysis[key])),JSON.parse(JSON.stringify(standard.analysis[key])));
 assert.equal(photo.backtest.actual,null);assert.equal(photo.backtest.noLookahead,true);assert.equal(photo.backtest.bandHitRate,null);
 await assert.rejects(vm.runInContext('analyzeOne("2351","2026-10-05",assets,"bad-mode")',c),/無效/);
});
