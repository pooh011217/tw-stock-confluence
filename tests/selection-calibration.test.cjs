const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
function boot(source=fs.readFileSync('src/worker.js','utf8')){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(source.replace('export default','globalThis.worker='),c);return c}
function run(code,source){const c=boot(source);c.rows=JSON.parse(fs.readFileSync(`tests/fixtures/${code}-2026-10-06.json`));return JSON.parse(JSON.stringify(vm.runInContext('(()=>{const a=analyze(rows);return calibrateVisibleRules(a,rows)})()',c)))}
test('complete dated history preserves original second-support priority instead of replacing it by closest band',()=>{
 const before=execFileSync('git',['show','112a5f4:src/worker.js'],{encoding:'utf8'});
 for(const [code,previous,price,low] of [['6285',251,250.5,248.5],['2472',224,221,220]]){
  const old=run(code,before),a=run(code);assert.equal(old.support2.price,previous);assert.equal(a.support2.price,price);assert.equal(a.support2.bandLow,low);assert.equal(a.support2.bandHigh,price);assert.ok(a.support2.bandHigh<a.support1.bandLow);
  assert.deepEqual(a.support1,old.support1);
  for(const k of ['current','previous','ma5','ma10','ma20','ma60','atr14','rsi14','technicalScore','macd','signal','volumeRatio'])assert.equal(a[k],old[k]);
  assert.match(a.selectionAudit.support2Priority,/保留既有公式/);
  assert.ok(a.selectionAudit.levels.support2.candidates.some(c=>c.price===price));
 }
});
test('a breakout candidate in a higher separate band cannot relabel the nearest ordinary pressure',()=>{
 const a=run('2472');assert.equal(a.breakout,null);assert.equal(a.resistance1.price,229);assert.equal(a.selectionAudit.breakoutAnchor,235.5);assert.equal(a.selectionAudit.breakoutSharesFirstBand,false);assert.equal(a.resistance2.price,232);
 const b=run('6285');assert.equal(b.breakout.price,258);assert.equal(b.resistance1,null);assert.equal(b.selectionAudit.breakoutSharesFirstBand,true);
});
test('invalid, overlapping or unbacked preferred supports fall back to an independent structure',()=>{
 for(const preferred of [{price:97,bandLow:96,bandHigh:98},{price:93.3,bandLow:93,bandHigh:93.3},{price:79,bandLow:79,bandHigh:79}]){
  const c=boot();c.a={current:100,tolerance:.0125,support2:preferred};c.rows=[{high:110},{high:102}];c.cs=[98,97,94].map(price=>({price,type:'pivotHigh',base:2,label:'前高轉支撐',age:0}));const a=vm.runInContext('calibrateVisibleRules(a,rows,cs)',c);assert.equal(a.support2.price,94);assert.ok(a.support2.bandHigh<a.support1.bandLow);
 }
});
test('the raw calculator and pressure reconstruction formulas remain byte-identical',()=>{
 const current=fs.readFileSync('src/worker.js','utf8'),before=execFileSync('git',['show','112a5f4:src/worker.js'],{encoding:'utf8'});
 const extract=(s,name)=>{const c=boot(s);return vm.runInContext(`${name}.toString()`,c)};
 for(const name of ['analyze','derivePhotoPressure','selectSecondSupport','selectPressureLevels','structuralBands','tradePrice','atr','sma','volumeProfileNode'])assert.equal(extract(current,name),extract(before,name));
});
