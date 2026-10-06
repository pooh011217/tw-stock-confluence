const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const fixture=JSON.parse(fs.readFileSync('public/data/history/2026-10-06/8358.json'));
const calendar=JSON.parse(fs.readFileSync('public/data/trading-sessions.json'));
const directory=JSON.parse(fs.readFileSync('public/data/stock-directory.json'));
const fixedNow='2026-10-06T18:45:00Z';
class FixedDate extends Date{constructor(...args){super(...(args.length?args:[fixedNow]))}static now(){return new Date(fixedNow).getTime()}}
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console,Date:FixedDate,fetch:async()=>{throw new Error('Unexpected network request')}});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
const assets={fetch:async request=>{const p=new URL(request.url).pathname;const j=p.endsWith('/stock-directory.json')?directory:p.endsWith('/trading-sessions.json')?calendar:p.endsWith('/history/2026-10-06/8358.json')?fixture:null;return new Response(JSON.stringify(j),{status:j?200:404})}};
function rawRange(){return {ok:true,code:'8358',end:'2026-10-06',rows:fixture.rows.map(r=>{const [y,m,d]=r.date.split('-');return [`${Number(y)-1911}/${m}/${d}`,r.volume/1000,r.turnover/1000,r.open,r.high,r.low,r.close,0,r.trades]})}}
test('latest Jinju analysis works by both short name and code while external directory/history are unavailable',async()=>{
 const c=boot();vm.runInContext('extras=async()=>({status:{institutional:false,margin:false,valuation:false,revenue:false}})',c);
 for(const q of ['金居','8358']){const response=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify({action:'analyze',q})}),{ASSETS:assets});assert.equal(response.status,200);const d=await response.json();assert.equal(d.stock.code,'8358');assert.equal(d.stock.name,'金居');assert.equal(d.analysis.date,'2026-10-06');assert.equal(d.analysis.current,551);assert.match(d.source,/TPEx/);assert.equal(d.backtest,null)}
});
test('bundled search resolves Jinju promptly without requiring six remote directory calls',async()=>{
 const c=boot();const r=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify({action:'search',q:'金居'})}),{ASSETS:assets});const j=await r.json();assert.equal(j.results[0].code,'8358');assert.equal(j.results[0].name,'金居');
});
test('TPEX history reads one validated range before attempting monthly retries',async()=>{
 const c=boot();let calls=0;c.fetch=async url=>{calls++;assert.match(url,/tpex\/range/);return new Response(JSON.stringify(rawRange()))};c.assets=assets;
 const rows=await vm.runInContext('history({code:"8358",market:"TPEX"},14,"2026-10-06",assets)',c);assert.equal(calls,1);assert.equal(rows.length,88);assert.equal(rows.at(-1).close,551);
});
test('range excludes known closed dates, but rejects wrong identity, duplicate dates and invalid OHLC',()=>{
 const c=boot();c.calendar=calendar;c.j=rawRange();const get=()=>vm.runInContext('parseTpexRange(j,{code:"8358",market:"TPEX"},"2026-10-06",calendar)',c);
 c.j.rows.push(['115/09/25',100,100,10,11,9,10,0,1]);assert.equal(get().length,88);
 c.j=rawRange();c.j.code='3211';assert.equal(get().length,0);
 c.j=rawRange();c.j.rows.push(c.j.rows[0]);assert.equal(get().length,0);
 c.j=rawRange();c.j.rows[0][6]=9999;assert.equal(get().length,0);
 c.j=rawRange();c.j.rows.push(['115/10/07',100,100,10,11,9,10,0,1]);assert.equal(get().length,0);
});
test('latest completed day uses Taipei midnight and waits for closing data availability',()=>{
 const c=boot();assert.equal(vm.runInContext('taipeiDate()',c),'2026-10-07');assert.equal(vm.runInContext('latestCompletedDate()',c),'2026-10-06');assert.equal(vm.runInContext('latestCompletedDate(new Date("2026-10-07T06:45:00Z"))',c),'2026-10-07');assert.equal(vm.runInContext('latestCompletedDate(new Date("2026-10-11T06:45:00Z"))',c),'2026-10-09');
});
test('all ordinary JSON requests attach a deadline; range deadline is separately bounded',async()=>{
 const c=boot(),deadlines=[];c.AbortSignal={timeout:ms=>{deadlines.push(ms);return {deadline:ms}}};c.fetch=async(url,opts)=>{assert.ok(opts.signal);return new Response('{}')};await vm.runInContext('getJson("https://test/a");',c);await vm.runInContext('getJson("https://test/b",0,25000);',c);assert.deepEqual(deadlines,[15000,25000]);
});
