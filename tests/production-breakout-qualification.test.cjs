const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('src/worker.js','utf8');
const start=source.indexOf('function calibratePhotoResearchV3(');
const expression=source.slice(start).split('\n').find(line=>line.includes('const keys=candidates.filter('));
assert.ok(expression,'production calibration must select breakout keys');
const filter=expression.slice(expression.indexOf('candidates.filter('),expression.indexOf('.sort((x,y)'));
const choose=new Function('candidates','cur','return '+filter+';');
const c=(price,type,label)=>({price,type,label,side:'resistance'});
test('production breakout rejects a single unconfirmed pivot',()=>{
 assert.equal(choose([c(103,'pivotHigh','前高／樞紐高')],100).length,0);
});
test('production breakout accepts two distinct structural sources within tolerance',()=>{
 assert.equal(choose([c(103,'pivotHigh','前高／樞紐高'),c(103.5,'gap','缺口上緣')],100).length,2);
});
test('production breakout rejects MA and volume-profile as sole confluence peers',()=>{
 assert.equal(choose([c(103,'pivotHigh','前高／樞紐高'),c(103.2,'ma','MA5'),c(103.3,'volumeProfile','成交量密集區')],100).length,0);
});
