const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('src/worker.js','utf8');
const fixtures=[
 [{公司代號:'8150',公司名稱:'南茂科技股份有限公司',公司簡稱:'南茂'},{公司代號:'1303',公司名稱:'南亞塑膠工業股份有限公司',公司簡稱:'南亞'},{公司代號:'2408',公司名稱:'南亞科技股份有限公司',公司簡稱:'南亞科'}],
 [{SecuritiesCompanyCode:'6182',CompanyName:'合晶科技股份有限公司',CompanyAbbreviation:'合晶'}],
 [{Code:'8150',Name:'南茂科技股份有限公司'},{Code:'1303',Name:'南亞塑膠工業股份有限公司'}],[],
 [{Code:'8150',Name:'南茂科技股份有限公司',CompanyName:'南茂科技股份有限公司'}],[]
];
function boot(code=source, rows=fixtures){let calls=0;const context=vm.createContext({console,Response,Request,URL,Headers,setTimeout,fetch:async()=>new Response(JSON.stringify(rows[(calls++)%6]),{status:200})});vm.runInContext(code.replace('export default','globalThis.worker='),context);return context}
const json=x=>JSON.parse(JSON.stringify(x));
test('official abbreviation survives later full names, even when full name field is first',async()=>{const c=boot();const d=json(await vm.runInContext('directory()',c));assert.equal(d.find(s=>s.code==='8150').name,'南茂');assert.equal(d.find(s=>s.code==='6182').name,'合晶');assert.equal(d.find(s=>s.code==='8150').fullName,'南茂科技股份有限公司');assert.ok(d.every(s=>!s.name.includes('有限公司')))});
test('later official abbreviation upgrades a code-only fallback',async()=>{const c=boot(source,[[{Code:'8150',Name:'南茂科技股份有限公司'}],[],[{公司代號:'8150',公司簡稱:'南茂'}],[],[],[]]);assert.equal((await vm.runInContext('directory()',c))[0].name,'南茂')});
test('search API works for code, partial code, short name and full name',async()=>{const c=boot();for(const q of ['8150','815','南茂','南茂科技股份有限公司']){const r=await c.worker.fetch(new Request('https://example.test/api/stock',{method:'POST',body:JSON.stringify({action:'search',q})}),{});assert.equal(r.status,200);const data=await r.json();assert.equal(data.results[0].code,'8150');assert.equal(data.results[0].name,'南茂')}assert.equal((await vm.runInContext('searchStocks("南亞")',c))[0].code,'1303');assert.equal((await vm.runInContext('searchStocks("")',c)).length,0)});
test('ambiguous names require selection instead of silently selecting a stock',async()=>{const c=boot();await assert.rejects(vm.runInContext('resolve("南")',c),/多個符合/);assert.equal((await vm.runInContext('resolve("南亞")',c)).code,'1303')});
function history(){return Array.from({length:120},(_,i)=>{const close=90+i*.23+Math.sin(i)*2;return {date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:close-.4,close,high:close+1,low:close-1,volume:100000+(i%9)*40000,turnover:10000000,trades:100}})}
test('support correction preserves first support and indicator calculations from V3.3.39',()=>{const old=boot(execFileSync('git',['show','70bd8d0:src/worker.js'],{encoding:'utf8'})),next=boot();old.input=history();next.input=history();const omit=a=>{for(const key of ['support2','support2Note','breakout','resistance1','resistance2','resistance2Role','mediumResistance','pressureMode','pressureNote'])delete a[key];return a};assert.deepEqual(omit(json(vm.runInContext('analyze(input)',next))),omit(json(vm.runInContext('analyze(input)',old))))});
test('historical estimate excludes future data and uses next session only for validation',async()=>{const c=boot(),rows=history(),base=rows.at(-1).date;const actual={...rows.at(-1),date:'2026-05-01',close:999,high:1000,low:900};c.fixture=[...rows,actual];vm.runInContext('history=async()=>structuredFixture;nextActualSession=async(s,base)=>fixture.find(r=>r.date>base)||null;resolve=async()=>({code:"8150",name:"南茂",market:"TWSE"})'.replace('structuredFixture','fixture'),c);c.base=base;const result=await vm.runInContext('analyzeOne("8150",base)',c);assert.equal(result.analysis.current,rows.at(-1).close);assert.equal(result.backtest.actual.close,999);assert.equal(result.backtest.usedRows,120);assert.equal(result.backtest.noLookahead,true);assert.ok(result.analysis.rows.every(r=>r.date<=base));if(result.analysis.breakout)assert.equal(result.analysis.resistance1,null)});
