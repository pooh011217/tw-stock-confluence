const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'../src/worker.js'),'utf8');
const line=src.split('\n').find(x=>x.includes('const keyCandidates=cands.filter('));
assert.ok(line,'breakout candidate selection exists');
const expression=line.slice(line.indexOf('cands.filter('),line.indexOf(',key=keyCandidates'));
const evaluate=new Function('cands','cur','tol','return '+expression+';');
const candidate=(price,type,label)=>({price,type,label,side:'resistance'});
test('single pivot does not qualify as confluence',()=>{
 const cands=[candidate(103,'pivotHigh','前高／樞紐高')];
 assert.equal(evaluate(cands,100,.012).length,0);
});
test('distinct nearby structural sources qualify',()=>{
 const cands=[candidate(103,'pivotHigh','前高／樞紐高'),candidate(103.5,'gap','缺口上緣')];
 assert.equal(evaluate(cands,100,.012).length,2);
});
test('same source, moving average, or volume profile alone do not qualify',()=>{
 const cands=[candidate(103,'pivotHigh','前高／樞紐高'),candidate(103.2,'pivotHigh','前高／樞紐高'),candidate(103.1,'ma','MA5'),candidate(103.3,'volumeProfile','成交量密集區')];
 assert.equal(evaluate(cands,100,.012).length,0);
});
