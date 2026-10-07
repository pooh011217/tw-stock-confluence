const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const refs=JSON.parse(fs.readFileSync('public/data/photo-references.json')),fixture=JSON.parse(fs.readFileSync('public/data/history/2026-10-06/8358.json')),calendar=JSON.parse(fs.readFileSync('public/data/trading-sessions.json')),directory=JSON.parse(fs.readFileSync('public/data/stock-directory.json'));
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
function assets(reference){return {fetch:async req=>{const p=new URL(req.url).pathname,j=p.endsWith('/photo-references.json')?reference:p.endsWith('/8358.json')?fixture:p.endsWith('/trading-sessions.json')?calendar:p.endsWith('/stock-directory.json')?directory:null;return new Response(JSON.stringify(j),{status:j?200:404})}}}
test('reference prices never enter calculations: arbitrary photo edits only change comparison results',async()=>{
 const c=boot();c.assets=assets(refs);const before=await vm.runInContext('analyzeOne("8358","2026-10-06",assets)',c);
 const edited=structuredClone(refs);edited.items.find(x=>x.code==='8358').levels.forEach(x=>x.price=9999);c.assets=assets(edited);const after=await vm.runInContext('analyzeOne("8358","2026-10-06",assets)',c);
 assert.deepEqual(JSON.parse(JSON.stringify(before.analysis)),JSON.parse(JSON.stringify(after.analysis)));assert.equal(after.analysis.current,551);assert.equal(after.analysis.breakout.price,564);assert.equal(after.analysis.resistance2.price,578);assert.equal(before.photoComparison.comparisons.at(-1).key,'mediumResistance');assert.equal(before.photoComparison.comparisons.at(-1).actualKey,'resistance2');assert.equal(before.photoComparison.comparisons.at(-1).nameMatches,false);
});
test('unknown photograph band is not treated as a zero-width band; off-date photos do not apply',async()=>{
 const c=boot();c.assets=assets(refs);c.a={date:'2026-10-06',current:551,breakout:{price:570,bandLow:570,bandHigh:578}};
 const cmp=await vm.runInContext('comparePhotoReference(a,{code:"8358"},assets)',c);const row=cmp.comparisons.find(x=>x.key==='breakout');assert.equal(row.priceMatches,true);assert.equal(row.bandProvided,false);assert.equal(row.bandMatches,null);
 c.a.date='2026-10-05';assert.equal(await vm.runInContext('comparePhotoReference(a,{code:"8358"},assets)',c),null);
});
test('the five photograph records contain 20 primary prices and exactly 12 visible bands',()=>{
 const prior=refs.items.filter(x=>['6285','2472','3583','6197','8358'].includes(x.code));assert.equal(prior.length,5);assert.equal(prior.flatMap(x=>x.levels).length,20);assert.equal(prior.flatMap(x=>x.levels).filter(x=>x.bandLow!=null).length,12);
 const support=refs.items.find(x=>x.code==='8358').levels[0];assert.equal(Number(((support.price-551)/551*100).toFixed(1)),-1.5);
 const medium=refs.items.find(x=>x.code==='8358').levels.at(-1);assert.equal(Number(((medium.price-551)/551*100).toFixed(1)),10.9);
});
