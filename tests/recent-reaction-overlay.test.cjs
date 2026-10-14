const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){
 const src=fs.readFileSync('src/reaction.js','utf8').replace(/export \{[^}]+\};?\s*$/,'');
 const c=vm.createContext({console});vm.runInContext(src,c);return c;
}
test('recent reaction band requires repeated distinct sessions and ignores future rows',()=>{
 const c=boot();
 c.a={current:100,atr14:2,date:'2026-10-14',rows:[
  {date:'2026-10-09',low:95,high:103,close:99},
  {date:'2026-10-12',low:95.2,high:104,close:100},
  {date:'2026-10-13',low:97,high:104.5,close:101},
  {date:'2026-10-14',low:99.5,high:106,close:100},
  {date:'2026-10-15',low:80,high:120,close:110}
 ]};
 const r=vm.runInContext('recentReactionBands(a)',c);
 assert.equal(r.noLookahead,true);assert.equal(r.usedRows,4);
 assert.ok(r.support.some(x=>x.uniqueSessions>=2&&x.bandLow===95&&x.bandHigh===95.2));
 const pressure=r.resistance.find(x=>x.uniqueSessions>=2&&x.bandLow<=104&&x.bandHigh>=104.5);
 assert.ok(pressure);assert.ok(pressure.bandHigh-pressure.bandLow<=1.5+1e-8,'anchor-bounded band must not chain outward');
 assert.ok(r.support.every(x=>x.bandLow>80));assert.ok(r.resistance.every(x=>x.bandHigh<120));
});
test('one isolated wick cannot manufacture a support or resistance',()=>{
 const c=boot();c.a={current:100,atr14:2,date:'2026-10-14',rows:[
  {date:'2026-10-12',low:94,high:102,close:99},
  {date:'2026-10-13',low:97,high:106,close:101},
  {date:'2026-10-14',low:99.5,high:108,close:100}
 ]};
 const r=vm.runInContext('recentReactionBands(a)',c);assert.equal(r.support.length,0);assert.equal(r.resistance.length,0);
});
test('overlay creates only qualified repeated reaction zones and preserves breakout/first-pressure exclusivity',()=>{
 const c=boot();c.p={analysis:{current:100,atr14:2,date:'2026-10-14',rows:[
  {date:'2026-10-09',low:95,high:104,close:99},
  {date:'2026-10-12',low:95.2,high:104.5,close:100},
  {date:'2026-10-13',low:97,high:107,close:101},
  {date:'2026-10-14',low:99.5,high:108,close:100}
 ],support1:null,support2:null,breakout:{price:104,bandLow:104,bandHigh:104.5,distance:.04,sources:['前高']},resistance1:{price:103,bandLow:103,bandHigh:103,distance:.03,sources:['舊壓力']},resistance2:null,mediumResistance:null,selectionAudit:{levels:{}},rulePolicy:{}}};
 vm.runInContext('applyRecentReactionOverlay(p)',c);
 assert.ok(c.p.analysis.support1);assert.equal(c.p.analysis.support1.bandLow,95);assert.equal(c.p.analysis.support1.bandHigh,95.2);
 assert.ok(c.p.analysis.breakout);assert.equal(c.p.analysis.resistance1,null);
 assert.equal(c.p.analysis.reactionReview.noLookahead,true);
});
test('standard production pipeline applies reaction overlay before guarded Pivot',()=>{
 const src=fs.readFileSync('src/main.js','utf8');
 assert.match(src,/import \{applyRecentReactionOverlay\} from '\.\/reaction\.js'/);
 assert.match(src,/function finalizeStandard\(payload\)\{applyRecentReactionOverlay\(payload\);applyClassicPivotOverlay\(payload\)/);
 assert.match(src,/3\.3\.44\.23/);
});
