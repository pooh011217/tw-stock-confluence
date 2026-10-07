const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
const raw=days=>({stat:'OK',data:days.map(day=>[`115/10/${day}`,1000,100000,100,105,95,101,0,10])});
test('TWSE stale successful primary response must continue to fresh relay',async()=>{
 const c=boot();let calls=0;c.fetch=async()=>new Response(JSON.stringify(raw(++calls===1?['01','02']:['01','02','05','06'])));
 const rows=await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-06")',c);
 assert.equal(rows.at(-1).date,'2026-10-06');assert.equal(calls,2);
});
test('TWSE stale cached month is refreshed after a later completed session',async()=>{
 const c=boot();let calls=0;c.fetch=async()=>new Response(JSON.stringify(raw(++calls===1?['01']:['01','02'])));
 await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-01")',c);
 const rows=await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-02")',c);
 assert.equal(rows.at(-1).date,'2026-10-02');assert.equal(calls,2);
});
test('TWSE invalid OHLC cannot satisfy the required last session',async()=>{
 const c=boot();let calls=0;c.fetch=async()=>{const data=raw(['01','02']);if(++calls===1)data.data[1][6]=999;return new Response(JSON.stringify(data))};
 const rows=await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-02")',c);
 assert.equal(rows.at(-1).close,101);assert.equal(calls,2);
});
test('month responses sort by actual date and reject conflicting duplicate sessions',()=>{
 const c=boot();c.j=raw(['06','01','02']);let rows=vm.runInContext('parseTwseMonth(j,"20261001")',c);assert.deepEqual(Array.from(rows,r=>r.date),['2026-10-01','2026-10-02','2026-10-06']);
 c.j=raw(['01','01']);c.j.data[1][6]=102;assert.equal(vm.runInContext('parseTwseMonth(j,"20261001")',c).length,0);
});
test('listed history forwards each verified calendar month end to the data source',async()=>{
 const c=boot();c.calls=[];
 vm.runInContext('tradingCalendar=async()=>({coverageEnd:"2026-10-06",sessions:["2026-09-30","2026-10-01","2026-10-06"]});twseMonth=async(code,d,required)=>{calls.push(required);return []}',c);
 await vm.runInContext('history({code:"2472",market:"TWSE"},2,"2026-10-06")',c);
 assert.deepEqual(Array.from(c.calls),['2026-09-30','2026-10-06']);
});
test('all stale monthly sources still fail the final date check and cannot silently calculate',async()=>{
 const c=boot();c.fetch=async()=>new Response(JSON.stringify(raw(['01'])));
 c.rows=await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-06")',c);
 assert.throws(()=>vm.runInContext('validateHistoryDates(rows,"2026-10-06","2026-10-06",{coverageEnd:"2026-10-06",sessions:["2026-10-01","2026-10-06"]})',c),/日期不完整/);
});
test('next-session validation refreshes a month cached before the next day was complete',async()=>{
 const c=boot();let calls=0;c.fetch=async()=>new Response(JSON.stringify(raw(++calls===1?['01']:['01','02'])));
 await vm.runInContext('twseMonth("2472",new Date("2026-10-01T12:00:00Z"),"2026-10-01")',c);
 vm.runInContext('latestCompletedDate=()=>"2026-10-02"',c);
 const actual=await vm.runInContext('nextActualSession({code:"2472",market:"TWSE"},"2026-10-01")',c);
 assert.equal(actual.date,'2026-10-02');assert.equal(calls,2);
});
