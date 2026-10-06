const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
const candidate=(price,type='pivotHigh')=>({price,type,base:2,label:type,age:3,low:price,high:price});
function corrected(candidates,base={}){const c=boot();c.a={current:100,tolerance:.0125,...base};c.rows=[{high:150},{high:105}];c.candidates=candidates;return JSON.parse(JSON.stringify(vm.runInContext('calibrateVisibleRules(a,rows,candidates)',c)))}
test('support boundaries accept 10 and 20 percent, excluding more distant structures',()=>{
 const a=corrected([candidate(90),candidate(80),candidate(77)]);
 assert.equal(a.support1.price,90);assert.equal(a.support2.price,80);assert.equal(a.remoteSupports[0].price,77);assert.ok(a.support2.bandHigh<a.support1.bandLow);
});
test('the next independent pressure above ten percent is medium with a blank near second',()=>{
 const a=corrected([candidate(105),candidate(114)],{breakout:{price:105,bandLow:105,bandHigh:105}});
 assert.equal(a.resistance1.price,105);assert.equal(a.resistance2,null);assert.equal(a.mediumResistance.price,114);
 const boundary=corrected([candidate(105),candidate(110)]);assert.equal(boundary.resistance2.price,110);assert.equal(boundary.mediumResistance,null);
});
test('merging is bounded by the initial anchor and does not chain through moving averages',()=>{
 const a=corrected([candidate(105),candidate(106),candidate(107),candidate(106.5,'ma'),candidate(106.5,'round')]);
 assert.equal(a.resistance1.bandHigh,106);assert.equal(a.resistance2.price,107);assert.ok(a.resistance2.bandLow>a.resistance1.bandHigh);
});
test('tick calibration crosses bands legally and floors the official 40.60 example to 44.65',()=>{
 const c=boot();assert.equal(vm.runInContext('tradePrice(40.60*1.1,"floor")',c),44.65);assert.equal(vm.runInContext('tradePrice(49.99)',c),50);assert.equal(vm.runInContext('tradePrice(101.646,"floor")',c),101.5);
});
test('new-high limit reference is nonstructural and never fills a resistance slot',()=>{
 const c=boot();c.a={current:100,tolerance:.0125};c.rows=[{high:99},{high:100}];c.candidates=[];const a=vm.runInContext('calibrateVisibleRules(a,rows,candidates)',c);
 assert.equal(a.limitUpReference.price,110);assert.equal(a.limitUpReference.isStructural,false);assert.equal(a.resistance1,null);assert.equal(a.resistance2,null);assert.equal(a.mediumResistance,null);
});
test('missing structures remain unformed and only averages cannot create support or pressure',()=>{
 const a=corrected([candidate(95,'ma'),candidate(105,'round')]);assert.equal(a.support1,null);assert.equal(a.resistance1,null);assert.equal(a.levelStatus.support1,'尚未形成');
});
