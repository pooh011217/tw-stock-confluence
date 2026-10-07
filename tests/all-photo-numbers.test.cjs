const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const refs=JSON.parse(fs.readFileSync('public/data/photo-references.json')),chips=JSON.parse(fs.readFileSync('public/data/chips/2026-10-06.json'));
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
function asset(){return {fetch:async()=>new Response(JSON.stringify(refs))}}
test('MA confluence requires a real support and never crosses current; raw eligibility precedes tick rounding',()=>{
 const c=boot();c.cs=[{type:'ma',label:'MA120',price:149.867},{type:'ma',label:'above',price:151},{type:'ma',label:'remote',price:170}];c.l={price:148,bandLow:148,bandHigh:148,sources:['pivot']};const l=vm.runInContext('expandSupportConfluence(l,cs,150.5,.0125)',c);assert.equal(l.price,150);assert.equal(l.bandLow,148);assert.equal(l.bandHigh,150);assert.equal(l.confluenceAdjustment.anchor,148);assert.equal(l.confluenceAdjustment.contributors.length,1);assert.equal(vm.runInContext('expandSupportConfluence(null,cs,150.5,.0125)',c),null);c.cs=[{type:'ma',label:'rounded current',price:150.4}];assert.equal(vm.runInContext('expandSupportConfluence(l,cs,150.5,.02).price',c),148);
});
test('both gap directions report exact historical boundaries and subsequent full fill dates',()=>{
 const c=boot();c.rows=[{date:'a',high:100,low:95},{date:'b',high:105,low:102},{date:'c',high:98,low:96},{date:'d',high:103,low:94}];const g=vm.runInContext('gapStructures(rows)',c);assert.equal(g[0].direction,'up');assert.equal(g[0].low,100);assert.equal(g[0].high,102);assert.equal(g[0].filledDate,'c');assert.equal(g[1].direction,'down');assert.equal(g[1].low,98);assert.equal(g[1].high,102);assert.equal(g[1].filledDate,'d');assert.equal(g[1].selectionStatus,'diagnostic-only');
});
test('40-photo benchmark counts 220 observed numeric fields and separates the older 611 reference',async()=>{
 const c=boot();c.assets=asset();let numeric=0,main=0,bands=0,priceHits=0,bandHits=0,formulas=0,foreignHits=0;for(const r of refs.items.filter(r=>r.batch==='40-photo-oct6')){
  const snapshot=JSON.parse(fs.readFileSync(`public/data/history/${r.date}/${r.code}.json`));c.rows=snapshot.rows;const a=vm.runInContext('calibrateVisibleRules(analyze(rows),rows)',c);c.a=a;c.stock={code:r.code};c.raw=chips.items.find(x=>x.code===r.code).institutional;c.extra={institutional:vm.runInContext("institutionalFrom(raw)",c)};
  const cmp=await vm.runInContext('comparePhotoReference(a,stock,assets,[],rows,extra)',c);foreignHits+=cmp.metrics.filter(m=>m.key==="foreignNetLots"&&m.matches).length;numeric+=cmp.numericSummary.total;main+=cmp.totalPrices;bands+=cmp.totalBands;priceHits+=cmp.matchedPrices;bandHits+=cmp.matchedBands;for(const l of cmp.comparisons)if(l.comparisonScope==='40-photo-oct6'&&l.distanceFormula){assert.equal(l.distanceFormula.matches,true,`${r.code} ${l.key} distance formula`);formulas++}
  assert.equal(cmp.numericSummary.total,cmp.numericSummary.matched+cmp.numericSummary.different+cmp.numericSummary.unavailable);
  if(r.code==='2408'){assert.equal(a.support1.price,524);assert.equal(a.support1.bandLow,521)}
  if(r.code==='4919'){assert.equal(a.support1.price,150);assert.equal(a.support1.bandLow,148)}
  if(r.code==='8358'){assert.equal(cmp.totalPrices,3);assert.equal(cmp.comparisons.find(x=>x.key==='mediumResistance').comparisonScope,'earlier-photo')}
 }
 assert.equal(numeric,220);assert.equal(main,65);assert.equal(bands,36);assert.equal(priceHits,23);assert.equal(bandHits,10);assert.equal(formulas,56);assert.equal(foreignHits,13);
});
test('percent and metric mismatches and missing data cannot be reported as complete agreement',async()=>{
 const c=boot();c.assets={fetch:async()=>new Response(JSON.stringify({items:[{code:'x',date:'2026-10-06',current:100,levels:[{key:'resistance1',price:105,bandLow:105,bandHigh:106,observedDistancePct:5}],visibleMetrics:{close:100,changePct:1,volumeRatio:2,foreignNetLots:10}}]}))};c.a={date:'2026-10-06',current:100,changePct:.01,resistance1:{price:105,bandLow:105,bandHigh:107},volumeRatio:1.9};const cmp=await vm.runInContext('comparePhotoReference(a,{code:"x"},assets,[],[],{})',c);assert.equal(cmp.comparisons[0].priceMatches,true);assert.equal(cmp.comparisons[0].allVisibleFieldsMatch,false);assert.equal(cmp.numericSummary.different,2);assert.equal(cmp.numericSummary.unavailable,1);
});
