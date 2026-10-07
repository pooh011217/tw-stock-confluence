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
test('TPEX monthly history never accepts the unreliable range relay',async()=>{
 const c=boot();c.assets=assets;c.calls=[];c.rows=fixture.rows;
 vm.runInContext('tpexRange=async()=>{throw new Error("Range must not be used")};tpexMonth=async(code,d)=>{calls.push(code);const prefix=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-`;return rows.filter(r=>r.date.startsWith(prefix))}',c);
 const rows=await vm.runInContext('history({code:"8358",market:"TPEX"},14,"2026-10-06",assets)',c);assert.equal(c.calls.length,6);assert.equal(rows.length,108);assert.equal(rows.at(-1).close,551);
});
test('range excludes known closed dates, but rejects wrong identity, duplicate dates and invalid OHLC',()=>{
 const c=boot();c.calendar=calendar;c.j=rawRange();const get=()=>vm.runInContext('parseTpexRange(j,{code:"8358",market:"TPEX"},"2026-10-06",calendar)',c);
 c.j.rows.push(['115/09/25',100,100,10,11,9,10,0,1]);assert.equal(get().length,108);
 c.j=rawRange();c.j.code='3211';assert.equal(get().length,0);
 c.j=rawRange();c.j.rows.push(c.j.rows[0]);assert.equal(get().length,0);
 c.j=rawRange();c.j.rows[0][6]=9999;assert.equal(get().length,0);
 c.j=rawRange();c.j.rows.push(['115/10/07',100,100,10,11,9,10,0,1]);assert.equal(get().length,0);
});
test('latest completed day uses Taipei midnight and waits for closing data availability',()=>{
 const c=boot();assert.equal(vm.runInContext('taipeiDate()',c),'2026-10-07');assert.equal(vm.runInContext('latestCompletedDate()',c),'2026-10-06');assert.equal(vm.runInContext('latestCompletedDate(new Date("2026-10-07T06:45:00Z"))',c),'2026-10-07');assert.equal(vm.runInContext('latestCompletedDate(new Date("2026-10-11T06:45:00Z"))',c),'2026-10-09');
});
test('all ordinary JSON requests attach a deadline; range deadline is separately bounded',async()=>{
 const c=boot(),deadlines=[];c.AbortSignal={timeout:ms=>{deadlines.push(ms);return {deadline:ms}}};c.fetch=async(url,opts)=>{assert.ok(opts.signal);return new Response('{}')};await vm.runInContext('getJson("https://test/a");',c);await vm.runInContext('getJson("https://test/b",0,18000);',c);assert.deepEqual(deadlines,[15000,18000]);
});
test('optional data cannot delay core analysis by fifteen seconds per request',async()=>{
 const c=boot(),deadlines=[];c.AbortSignal={timeout:ms=>{deadlines.push(ms);return {deadline:ms}}};c.fetch=async()=>{throw new Error('Unavailable optional source')};
 const extra=await vm.runInContext('extras({code:"2351",market:"TWSE"},"2026-10-06")',c);
 assert.deepEqual(deadlines,[5000,5000,5000,5000]);assert.equal(extra.status.institutional,false);assert.equal(extra.status.revenue,false);
});
test('monthly fallback attempts each source within eight seconds',async()=>{
 const c=boot(),deadlines=[];c.AbortSignal={timeout:ms=>{deadlines.push(ms);return {deadline:ms}}};c.fetch=async()=>{throw new Error('Unavailable history source')};
 assert.equal((await vm.runInContext('tpexMonth("6223",new Date("2026-10-01T12:00:00Z"))',c)).length,0);
 assert.deepEqual(deadlines,[8000,8000,8000]);deadlines.length=0;
 assert.equal((await vm.runInContext('twseMonth("2351",new Date("2026-10-01T12:00:00Z"))',c)).length,0);assert.deepEqual(deadlines,[8000,8000]);
});
test('switching stocks ignores an older failure and an older successful response',async()=>{
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>[]});
 const ui=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}}});
 const app=fs.readFileSync('public/app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('$("#analyze").onclick')),ui);
 const requests=[];ui.request=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));ui.rendered=[];
 vm.runInContext('api=()=>request();render=d=>rendered.push(d);',ui);
 const first=vm.runInContext('analyze("2351")',ui),second=vm.runInContext('analyze("2330")',ui);
 requests[1].resolve({code:'2330'});await second;requests[0].reject(new Error('Old request failed'));await first;
 assert.equal(ui.rendered.length,1);assert.equal(ui.rendered[0].code,'2330');assert.equal(nodes.get('#error').textContent,'');
 const third=vm.runInContext('analyze("8150")',ui),fourth=vm.runInContext('analyze("8358")',ui);
 requests[3].resolve({code:'8358'});await fourth;requests[2].resolve({code:'8150'});await third;
 assert.equal(ui.rendered.length,2);assert.equal(ui.rendered[1].code,'8358');
});
test('a multi-stock server invocation is rejected before any history fetch',async()=>{
 const c=boot();let calls=0;c.fetch=async()=>{calls++;throw new Error('Must not request history')};
 const r=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify({action:'scan',codes:'合晶 穩懋 統新 中美晶 鼎元 聯茂 金居'})}),{ASSETS:assets});
 assert.equal(r.status,400);assert.match((await r.json()).error,/逐檔/);assert.equal(calls,0);
});
test('single-stock scan uses selected date and the same verified history as full analysis',async()=>{
 const c=boot();
 const r=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify({action:'scan',codes:'金居',asOf:'2026-10-06'})}),{ASSETS:assets});
 assert.equal(r.status,200);const j=await r.json();assert.equal(j.results.length,1);assert.equal(j.results[0].ok,true);assert.equal(j.results[0].date,'2026-10-06');assert.equal(j.results[0].current,551);
 assert.equal(j.results[0].levels.support1.price,549);assert.equal(j.results[0].levels.support1.bandLow,543);assert.ok(j.results[0].levels.support2.bandHigh<j.results[0].levels.support1.bandLow);assert.equal(j.results[0].levels.resistance2.price,578);
});
test('scan table renders bands on a separate row with blank name and price cells',()=>{
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>[]});
 const ui=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}}});
 const app=fs.readFileSync('public/app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('$("#analyze").onclick')),ui);
 ui.rows=[{ok:true,stock:{name:'金居',code:'8358'},date:'2026-10-06',current:551,levels:{support1:{price:549,bandLow:543,bandHigh:549},support2:{price:536,bandLow:530,bandHigh:536},breakout:{price:564,bandLow:560,bandHigh:570},resistance2:{price:578,bandLow:578,bandHigh:594}}}];
 vm.runInContext('renderScan(rows,1,1)',ui);const html=nodes.get('#scanResult').innerHTML;
 assert.match(html,/<table/);assert.match(html,/<tr class="scan-band"><td><\/td><td><\/td><td>（543–549）<\/td>/);assert.match(html,/（578–594）/);assert.doesNotMatch(html,/scanitem|>價格帶</);
 ui.rows[0].levels.breakout=null;ui.rows[0].levels.resistance1={price:555,bandLow:555,bandHigh:557};vm.runInContext('renderScan(rows,1,1)',ui);assert.match(nodes.get('#scanResult').innerHTML,/第一壓力/);
});
test('seven-stock UI scan sends isolated requests with at most two in flight and retains partial success',async()=>{
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>[]});
 const ui=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}}});
 const app=fs.readFileSync('public/app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('$("#analyze").onclick')),ui);
 ui.date='2026-10-06';vm.runInContext('$("#asOf").value=date',ui);
 let active=0,peak=0;const requests=[];ui.request=async body=>{requests.push(body);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;if(body.codes==='統新')throw new Error('Temporary individual failure');return {results:[{ok:true,query:body.codes,stock:{code:body.codes,name:body.codes},observation:50}]}};
 let latest;ui.paint=(results,done,total)=>{latest={results:[...results],done,total}};vm.runInContext('api=body=>request(body);renderScan=(rows,done,total)=>paint(rows,done,total)',ui);
 await vm.runInContext('scan("合晶 穩懋 統新 中美晶 鼎元 聯茂 金居")',ui);
 assert.equal(requests.length,7);assert.equal(peak,2);assert.ok(requests.every(r=>!r.codes.includes(' ')&&r.asOf==='2026-10-06'));
 assert.equal(latest.done,7);assert.equal(latest.total,7);assert.equal(latest.results.filter(r=>r.ok).length,6);assert.equal(latest.results.filter(r=>!r.ok).length,1);
});

test('current month with a stale partial response continues to the next source',async()=>{
 const c=boot();let calls=0;const raw=rawRange().rows.filter(r=>r[0].startsWith('115/10/'));
 c.fetch=async()=>{calls++;return new Response(JSON.stringify({rows:calls===1?raw.slice(0,1):raw}))};
 const rows=await vm.runInContext('tpexMonth("8358",new Date("2026-10-01T12:00:00Z"),"2026-10-06")',c);
 assert.equal(calls,2);assert.equal(rows.at(-1).date,'2026-10-06');
});
test('a missing final session or an interior trading day cannot silently change calculations',async()=>{
 const c=boot();c.assets=assets;c.rows=fixture.rows.filter(r=>r.date!=='2026-10-05');
 vm.runInContext('tpexMonth=async(code,d)=>{const prefix=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-`;return rows.filter(r=>r.date.startsWith(prefix))}',c);
 await assert.rejects(vm.runInContext('history({code:"8358",market:"TPEX"},14,"2026-10-06",assets)',c),/2026-10-05/);
 c.calendar=calendar;c.rows=[{date:'2026-09-30'}];assert.throws(()=>vm.runInContext('validateHistoryDates(rows,"2026-10-06",taipeiDate(),calendar)',c),/日期不完整/);
});
test('Sino-American Silicon uses verified 10/6 monthly data through both analysis and scan',async()=>{
 const c=boot(),sino=JSON.parse(fs.readFileSync('public/data/history/2026-10-06/5483.json'));
 const sinoAssets={fetch:async request=>{if(new URL(request.url).pathname.endsWith('/history/2026-10-06/5483.json'))return new Response(JSON.stringify(sino));return assets.fetch(request)}};
 for(const input of [{action:'analyze',q:'中美晶',asOf:'2026-10-06'},{action:'scan',codes:'中美晶',asOf:'2026-10-06'}]){
 const response=await c.worker.fetch(new Request('https://test/api/stock',{method:'POST',body:JSON.stringify(input)}),{ASSETS:sinoAssets});assert.equal(response.status,200);const out=await response.json(),a=out.analysis||out.results[0];assert.equal(a.date,'2026-10-06');assert.equal(a.current,215);if(out.results)assert.equal(a.ok,true);
 }
});
