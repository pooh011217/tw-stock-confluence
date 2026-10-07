const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
const fixture=JSON.parse(fs.readFileSync('public/data/history/2026-10-06/8358.json'));
test('the six-month Jinju snapshot includes all twenty May sessions and a complete calendar',async()=>{
 const c=boot(),calendar=JSON.parse(fs.readFileSync('public/data/trading-sessions.json'));c.assets={fetch:async req=>new Response(JSON.stringify(new URL(req.url).pathname.endsWith('trading-sessions.json')?calendar:fixture))};
 const a=await vm.runInContext('archivedHistory({code:"8358",market:"TPEX"},"2026-10-06",assets)',c);assert.equal(a.rows.length,108);assert.equal(a.rows[0].date,'2026-05-04');assert.equal(a.rows.filter(r=>r.date.startsWith('2026-05')).length,20);
 const expected=calendar.sessions.filter(d=>d>='2026-05-01'&&d<='2026-10-06');assert.deepEqual(a.rows.map(r=>r.date),expected);
});
test('snapshots missing the beginning or an interior session are rejected rather than recalculated silently',async()=>{
 for(const rows of [fixture.rows.filter(r=>r.date>='2026-06-01'),fixture.rows.filter(r=>r.date!=='2026-05-15')]){
  const c=boot(),calendar=JSON.parse(fs.readFileSync('public/data/trading-sessions.json'));c.assets={fetch:async req=>new Response(JSON.stringify(new URL(req.url).pathname.endsWith('trading-sessions.json')?calendar:{...fixture,rows}))};
  assert.equal(await vm.runInContext('archivedHistory({code:"8358",market:"TPEX"},"2026-10-06",assets)',c),null);
 }
});
test('latest and dated analysis use the same anchored calculation window, excluding older and future rows',async()=>{
 const c=boot();c.fixture=JSON.parse(fs.readFileSync('tests/fixtures/2472-2026-10-06.json'));c.fixture.unshift({date:'2025-01-02',open:2000,high:2500,low:1900,close:2200,volume:1e8});c.fixture.push({date:'2026-10-07',open:228,high:5000,low:1,close:3000,volume:1e9});c.calls=[];
 vm.runInContext('resolve=async()=>({code:"2472",name:"立隆電",market:"TWSE"});archivedHistory=async()=>null;tradingCalendar=async()=>null;latestCompletedDate=()=>"2026-10-06";history=async(s,m,d)=>{calls.push({m,d});return JSON.parse(JSON.stringify(fixture))};extras=async()=>({});',c);
 const latest=await vm.runInContext('analyzeOne("2472",null)',c),dated=await vm.runInContext('analyzeOne("2472","2026-10-06")',c);
 assert.deepEqual(JSON.parse(JSON.stringify(latest.analysis)),JSON.parse(JSON.stringify(dated.analysis)));
 assert.deepEqual(JSON.parse(JSON.stringify(c.calls)),[{m:14,d:'2026-10-06'},{m:14,d:'2026-10-06'}]);assert.equal(dated.historyWindow.startDate,'2025-09-01');assert.equal(dated.historyWindow.usedRows,266);assert.equal(dated.analysis.current,228);assert.equal(dated.backtest.actual,null);
});
test('future validation becomes available without shifting the historical calculation window',async()=>{
 const c=boot();c.fixture=JSON.parse(fs.readFileSync('tests/fixtures/2472-2026-10-06.json'));c.calls=[];c.actual={date:'2026-10-07',open:228,high:5000,low:1,close:3000,volume:1e9};
 vm.runInContext('resolve=async()=>({code:"2472",name:"立隆電",market:"TWSE"});archivedHistory=async()=>null;tradingCalendar=async()=>null;latestCompletedDate=()=>"2026-10-06";history=async(s,m,d)=>{calls.push({m,d});return JSON.parse(JSON.stringify(fixture))};nextActualSession=async()=>null',c);
 const before=await vm.runInContext('analyzeOne("2472","2026-10-06")',c);vm.runInContext('latestCompletedDate=()=>"2026-11-06";nextActualSession=async()=>actual',c);const after=await vm.runInContext('analyzeOne("2472","2026-10-06")',c);
 assert.deepEqual(JSON.parse(JSON.stringify(after.analysis)),JSON.parse(JSON.stringify(before.analysis)));assert.equal(after.backtest.actual.close,3000);assert.equal(after.backtest.predictionFor,'2026-10-07');assert.ok(c.calls.every(x=>x.m===14&&x.d==='2026-10-06'));
});
test('validation retrieves only the first future completed session through independent monthly calls',async()=>{
 for(const market of ['TWSE','TPEX']){const c=boot();c.calls=[];vm.runInContext('latestCompletedDate=()=>"2026-10-06";twseMonth=tpexMonth=async(code,d)=>{const month=d.toISOString().slice(0,7);calls.push(month);return month==="2026-09"?[{date:"2026-09-30",close:100}]:[{date:"2026-10-07",close:999},{date:"2026-10-02",close:102},{date:"2026-10-01",close:101}]}',c);c.market=market;const next=await vm.runInContext('nextActualSession({code:"1234",market},"2026-09-30")',c);assert.equal(next.date,'2026-10-01');assert.deepEqual(Array.from(c.calls),['2026-09','2026-10']);}
});
test('calendar/window repair leaves all pricing and selection formulas byte-identical to V44.11',()=>{
 const c=boot(),old=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(execFileSync('git',['show','0b4b9c1:src/worker.js'],{encoding:'utf8'}).replace('export default','globalThis.worker='),old);
 for(const name of ['analyze','derivePhotoPressure','selectSecondSupport','selectPressureLevels','structuralBands','tradePrice'])assert.equal(vm.runInContext(name+'.toString()',c),vm.runInContext(name+'.toString()',old));
});
