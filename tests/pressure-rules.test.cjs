const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({Response,Request,URL,Headers,setTimeout,console});
vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),ctx);
function zone(price,type='pivotHigh',low=price,high=price){return {price,type,low,high,side:'resistance',score:3,sources:['前高／樞紐高'],age:5}}
function select(input){ctx.input={cur:100,tol:.0125,key:null,shelf:null,resist:[],cands:[],recentFloorLows:[],...input};return JSON.parse(JSON.stringify(vm.runInContext('selectPressureLevels(input)',ctx)))}
test('ordinary pressures are paired and retain known 255.5 / 265 shelf calculation',()=>{const first=zone(255.5,'shelf'),second=zone(265);const r=select({cur:250,shelf:first,resist:[first,second],recentFloorLows:[265]});assert.equal(r.firstResistance.price,255.5);assert.equal(r.secondResistance.price,265);assert.equal(r.mediumResistance,null);assert.equal(r.pressureMode,'ordinary')});
test('breakout removes both ordinary pressures and independently preserves medium pressure',()=>{const key=zone(168,'pivotHigh',167,169),mid=zone(185.5);const r=select({cur:160,key,resist:[key,zone(173),mid]});assert.equal(r.firstResistance,null);assert.equal(r.secondResistance,null);assert.equal(r.mediumResistance.price,185.5);assert.equal(r.pressureMode,'breakout')});
test('breakout without qualifying medium structure has no placeholder ordinary pressure',()=>{const key=zone(105);const r=select({key,resist:[key,zone(108)]});assert.equal(r.firstResistance,null);assert.equal(r.secondResistance,null);assert.equal(r.mediumResistance,null)});
test('second pressure must be above first and outside its price band',()=>{const first=zone(106,'shelf',105,109);const r=select({shelf:first,resist:[first,zone(108,'pivotHigh',107,110),zone(114,'pivotHigh',112,115)]});assert.equal(r.secondResistance.price,114);assert.ok(r.secondResistance.low>r.firstResistance.high)});
test('one historical pressure does not fabricate a second or publish a lone first',()=>{const first=zone(105);const r=select({resist:[first],cands:[first]});assert.equal(r.firstResistance,null);assert.equal(r.secondResistance,null);assert.equal(r.pressureMode,'unconfirmed');assert.match(r.pressureNote,/待確認/)});
test('medium requires real structure, not a standalone moving average or round number',()=>{const key=zone(104);const r=select({key,resist:[key,zone(112,'round'),zone(114,'ma')]});assert.equal(r.mediumResistance,null)});
test('output classification obeys pressure invariants across historical and synthetic series',()=>{for(let seed=0;seed<20;seed++){ctx.rows=Array.from({length:100},(_,i)=>{const close=100+Math.sin(i*.43+seed)*12+Math.cos(i*.19)*8+i*(seed%3-1)*.1;return {date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),open:close-.4,close,high:close+2,low:close-2,volume:1000+(i%7)*300}});const a=vm.runInContext('analyze(rows)',ctx);if(a.breakout){assert.equal(a.resistance1,null);assert.equal(a.resistance2,null)}else{assert.equal(Boolean(a.resistance1),Boolean(a.resistance2));if(a.resistance1)assert.ok(a.resistance2.bandLow>a.resistance1.bandHigh);assert.equal(a.mediumResistance,null)}}});
const ui=vm.createContext({localStorage:{getItem:()=>null,setItem:()=>{}},document:{querySelector:()=>null},console});
const app=fs.readFileSync('public/app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('$("#analyze").onclick')),ui);
function html(a){ui.input=a;return vm.runInContext('pressureLevels(input).join("")',ui)}
function packed(price,distance=.05){return {price,bandLow:price,bandHigh:price,confidence:50,distance,sources:[]}}
test('breakout UI hides first and second, showing only optional medium',()=>{const h=html({breakout:packed(105),resistance1:packed(108),resistance2:packed(110),mediumResistance:packed(115,.15)});assert.match(h,/關鍵突破／壓力共振區/);assert.match(h,/中期壓力/);assert.doesNotMatch(h,/第一壓力|第二壓力/)});
test('ordinary second stays labelled second even if distant',()=>{const h=html({resistance1:packed(105),resistance2:packed(120,.2)});assert.match(h,/第一壓力/);assert.match(h,/第二壓力/);assert.doesNotMatch(h,/中期壓力|關鍵突破/)});
test('incomplete ordinary pair is not rendered as a misleading lone level',()=>{assert.equal(html({resistance1:packed(105)}),'')});
