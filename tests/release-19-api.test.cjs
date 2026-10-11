const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
for(const code of ['2301','2368','8299','6213','8150','6182'])test('released default analysis and scan reproduce approved review without future leakage '+code,async()=>{
 const c=vm.createContext({Response,Request,URL,Headers,setTimeout});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);
 c.fixture=JSON.parse(fs.readFileSync('tests/fixtures/2026-10-08/'+code+'.json'));c.stock={code,name:code,market:['8299','6182'].includes(code)?'TPEX':'TWSE'};
 vm.runInContext('resolve=async()=>stock;archivedHistory=async()=>null;tradingCalendar=async()=>null;history=async()=>JSON.parse(JSON.stringify(fixture));nextActualSession=async()=>({date:"2026-10-12",open:99999,high:100000,low:1,close:88888});extras=async()=>({});comparePhotoReference=async()=>null',c);
 const expected=JSON.parse(JSON.stringify(vm.runInContext('calibrateAvReview(fixture)',c))),call=async input=>{const r=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify(input)}),{ASSETS:null});assert.equal(r.status,200);return r.json()};
 const full=await call({action:'analyze',q:code,asOf:'2026-10-08'}),scan=await call({action:'scan',codes:code,asOf:'2026-10-08'});
 assert.equal(full.version,'3.3.44.19');assert.equal(full.analysis.date,'2026-10-08');assert.equal(full.analysis.current,expected.current);assert.equal(full.backtest.actual.close,88888);assert.ok(full.backtest.noLookahead);
 assert.equal(scan.results[0].ok,true);assert.equal(scan.version,'3.3.44.19');
 for(const k of ['support1','support2','breakout','resistance1','resistance2','mediumResistance']){assert.deepEqual(full.analysis[k],expected[k]);assert.equal(!!scan.results[0].levels[k],!!expected[k]);if(expected[k])for(const field of ['price','bandLow','bandHigh'])assert.equal(scan.results[0].levels[k][field],expected[k][field])}
 assert.deepEqual(full.analysis.avReview,expected.avReview);
});
test('release UI and offline shell point to the new default and one cache version',()=>{const html=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/sw.js','utf8'),app=fs.readFileSync('public/app.js','utf8');assert.match(html,/V3\.3\.44\.19/);assert.match(html,/value="standard">共振＋AV交叉校正（推定）/);assert.match(html,/app.js\?v=3\.3\.44\.19/);assert.match(sw,/app.js\?v=3\.3\.44\.19/);assert.match(app,/sw.js\?v=3\.3\.44\.19/);assert.doesNotMatch(app,/\$\{audit.support2Priority\}/);new vm.Script(app)});
