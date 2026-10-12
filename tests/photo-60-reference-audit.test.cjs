const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const refs=JSON.parse(fs.readFileSync('public/data/photo-references-2026-10-08.json','utf8'));
const worker=fs.readFileSync('src/worker.js','utf8');
function boot(){
 const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});
 vm.runInContext(worker.replace('export default','globalThis.worker='),c);
 return c;
}
const fixture=code=>JSON.parse(fs.readFileSync(`tests/fixtures/2026-10-08/${code}.json`,'utf8'));
const levels=a=>Object.fromEntries(['support1','support2','breakout','resistance1','resistance2','mediumResistance'].map(k=>[k,a[k]?[a[k].price,a[k].bandLow,a[k].bandHigh]:null]));
test('60-photo 10/8 reference dataset is independent of engine calculations',()=>{
 assert.equal(refs.photoCount,60);
 assert.equal(refs.photoStockCount,26);
 assert.equal(refs.items.length,26);
 assert.equal(new Set(refs.items.map(x=>x.code)).size,26);
 assert.equal(refs.items.flatMap(x=>x.levels).length,100);
 assert.equal(refs.items.flatMap(x=>x.levels).filter(x=>x.bandLow!=null&&x.bandHigh!=null).length,53);
 assert.ok(refs.items.every(x=>x.date==='2026-10-08'&&x.predictionFor==='2026-10-12'));
 assert.ok(!worker.slice(worker.indexOf('function analyze('),worker.indexOf('function analyze(')+15000).includes('photo-references-2026-10-08.json'),'photo targets must not enter analyze engine');
});
test('volume profile cannot independently create a structural support or widen its band',()=>{
 const c=boot();
 c.candidates=[
 {type:'volumeProfile',price:99,low:95,base:3,label:'VP',age:0},
 {type:'pivotLow',price:90,low:90,base:2,label:'pivot',age:1}
 ];
 const result=JSON.parse(JSON.stringify(vm.runInContext('structuralBands(candidates,100,"support",.0125)',c)));
 assert.equal(result.length,1);
 assert.deepEqual(result.map(x=>[x.price,x.low,x.high]),[[90,90,90]]);
});
test('10/8 8299 first-support band uses independently observed structure 2050–2055',()=>{
 const c=boot();c.rows=fixture('8299');
 const a=vm.runInContext('calibrateAvReview(rows)',c);
 assert.equal(a.date,'2026-10-08');
 assert.deepEqual([a.support1.price,a.support1.bandLow,a.support1.bandHigh],[2055,2050,2055]);
 assert.equal(a.support2.price,2010);
 assert.equal(a.resistance1.price,2080);
 assert.equal(a.resistance2.price,2160);
});
test('10/8 2368 support and breakout still use dated structural inputs',()=>{
 const c=boot();c.rows=fixture('2368');
 const a=vm.runInContext('calibrateAvReview(rows)',c);
 assert.deepEqual([a.support1.price,a.support1.bandLow,a.support1.bandHigh],[1260,1245,1260]);
 assert.deepEqual([a.breakout.price,a.breakout.bandLow,a.breakout.bandHigh],[1300,1300,1335]);
 assert.equal(a.resistance2.price,1400);
 assert.equal(a.resistance1,null);
});
test('other four 10/8 offline fixtures preserve previously reviewed primary prices',()=>{
 const expected={
 '2301':{support1:296,support2:289,breakout:298,resistance2:322},
 '6182':{support1:128.5,support2:125.5,breakout:131.5,resistance2:134.5},
 '6213':{support1:765,support2:null,breakout:818,resistance2:null},
 '8150':{support1:127,support2:125,resistance1:128.5,resistance2:133}
 };
 const c=boot();
 for(const [code,points] of Object.entries(expected)){
  c.rows=fixture(code);const a=vm.runInContext('calibrateAvReview(rows)',c);
  assert.equal(a.date,'2026-10-08');
  for(const [key,price] of Object.entries(points))assert.equal(a[key]?.price??null,price,`${code} ${key}`);
 }
});
