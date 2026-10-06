const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const source=fs.readFileSync('src/worker.js','utf8');
function boot(code=source){const ctx=vm.createContext({console,Response,Request,URL,Headers,setTimeout});vm.runInContext(code.replace('export default','globalThis.worker='),ctx);return ctx}
const ctx=boot();
function c(price,type='pivotLow',age=5,low=price){return {price,low,high:price,type,age}}
function pick(first,raw,zones=raw){ctx.input={first,raw,zones};const r=vm.runInContext('selectSecondSupport(input.first,input.raw,input.zones)',ctx);return r?JSON.parse(JSON.stringify(r)):null}
test('overlapping preferred range low is skipped for independent support',()=>{const first=c(100,'volume',0,95),overlap=c(98,'rangeLow'),lower=c(92);assert.equal(pick(first,[overlap,lower]).price,92)});
test('touching support bands are not two independent areas',()=>{const first=c(100,'volume',0,95);assert.equal(pick(first,[c(95,'rangeLow'),c(90)]).price,90)});
test('valid 3 percent range candidate keeps its original priority',()=>{const first=c(100,'volume',0,99);assert.equal(pick(first,[c(98,'rangeLow',60),c(97.5)]).price,98)});
test('recent support retains priority over older candidate',()=>{const first=c(100,'volume',0,95);assert.equal(pick(first,[c(94,'pivotLow',80),c(92,'pivotLow',10)]).price,92)});
test('known separated 251.5 / 245.5 structure remains valid',()=>{const first=c(251.5,'pivotHigh',5,250);assert.equal(pick(first,[c(249.5,'rangeLow',50),c(245.5,'pivotLow',10)]).price,249.5);assert.equal(pick(first,[c(245.5,'pivotLow',10)]).price,245.5)});
test('fallback searches for lower independent zone instead of fixed second array item',()=>{const first=c(100,'volume',0,99);assert.equal(pick(first,[],[c(101),c(99.5),c(98)]).price,98)});
test('missing independent second support is null, never fabricated',()=>{assert.equal(pick(c(100,'volume',0,95),[c(98),c(100)]),null);assert.equal(pick(null,[c(90)]),null)});
function history(seed){return Array.from({length:120},(_,i)=>{const close=100+Math.sin(i*.43+seed)*12+Math.cos(i*.19)*8+i*.1;return {date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:close-.4,close,high:close+2,low:close-2,volume:1000+(i%7)*300}})}
test('support calculation and nonpressure indicators stay unchanged; second support bands are separated',()=>{const old=boot(execFileSync('git',['show','41c3855:src/worker.js'],{encoding:'utf8'})),next=boot();for(let seed=0;seed<12;seed++){old.input=history(seed);next.input=history(seed);const a=JSON.parse(JSON.stringify(vm.runInContext('analyze(input)',old))),b=JSON.parse(JSON.stringify(vm.runInContext('analyze(input)',next)));if(b.support2){assert.ok(b.support2.price<b.support1.price);assert.ok(b.support2.bandHigh<b.support1.bandLow)}else assert.match(b.support2Note,/待確認/);delete a.support2;delete b.support2;delete b.support2Note;for(const key of ["breakout","resistance2","resistance2Role","mediumResistance","pressureNote"]){delete a[key];delete b[key]}assert.deepEqual(b,a)}});
test('unconfirmed second support has an explanation in the actual renderer',()=>{const nodes=new Map(),node=()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>[]});const ui=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}}});const app=fs.readFileSync('public/app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('$("#analyze").onclick')),ui);ui.data={stock:{code:'8150',name:'南茂'},analysis:{current:105,support1:{price:100,bandLow:95,bandHigh:100,sources:[]},support2:null,support2Note:'尚未找到獨立第二支撐，待確認。'},score:{}};vm.runInContext('render(data)',ui);assert.match(nodes.get('#analysisResult').innerHTML,/第二支撐｜待確認/);assert.match(nodes.get('#analysisResult').innerHTML,/尚未找到獨立第二支撐/)});
