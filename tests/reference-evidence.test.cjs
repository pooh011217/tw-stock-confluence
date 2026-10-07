const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function boot(){const c=vm.createContext({Response,Request,URL,Headers,setTimeout,console});vm.runInContext(fs.readFileSync('src/worker.js','utf8').replace('export default','globalThis.worker='),c);return c}
test('reference evidence distinguishes a companion price on a confirmed low-pivot candle from a calculated candidate',()=>{
 const c=boot();c.rows=[{date:'1',high:870,low:836},{date:'2',high:868,low:805},{date:'3',open:782,high:811,low:782,close:807},{date:'4',high:866,low:839},{date:'5',high:786,low:785}];c.cs=[];const e=vm.runInContext('referencePriceEvidence(807,{},rows,cs)',c);assert.equal(e.reason,'pivot-candle-boundary-not-used');assert.equal(e.directMatches[0].pivotLow,true);assert.deepEqual(Array.from(e.directMatches[0].fields),['close']);assert.equal(e.exactCandidates.length,0);
});
test('raw occurrence without pivot/volume qualification is not automatically called an effective level',()=>{
 const c=boot();c.rows=[{date:'1',high:110,low:90},{date:'2',high:111,low:91},{date:'3',high:109,low:92,close:101},{date:'4',high:112,low:90},{date:'5',high:113,low:89}];const e=vm.runInContext('referencePriceEvidence(101,{},rows,[])',c);assert.equal(e.reason,'not-qualified-by-current-rules');const absent=vm.runInContext('referencePriceEvidence(999,{},rows,[])',c);assert.equal(absent.reason,'no-direct-ohlc-match');assert.equal(absent.rangeStart,'1');
});
test('existing but unselected structural prices are identified without replacing the analysis result',()=>{
 const c=boot();c.rows=[{date:'2026-10-05',high:543,low:505,close:543},{date:'2026-10-06',high:578,low:548,close:551}];c.cs=[{price:543,type:'volume',label:'爆量K收盤',age:1}];c.a={current:551,support1:{price:549}};const before=JSON.stringify(c.a);const e=vm.runInContext('referencePriceEvidence(543,a,rows,cs)',c);assert.equal(e.reason,'candidate-but-not-selected');assert.equal(e.exactCandidates[0].date,'2026-10-05');assert.equal(JSON.stringify(c.a),before);
});
test('the unselected close of an older support pivot reports the existing twenty-session cutoff',()=>{
 const c=boot();c.rows=Array.from({length:90},(_,i)=>({date:String(i).padStart(3,'0'),open:850,high:900,low:820,close:850}));c.rows[7]={date:'007',open:782,high:811,low:782,close:807};const e=vm.runInContext('referencePriceEvidence(807,{current:762},rows,[])',c);assert.equal(e.directMatches[0].pivotLow,true);assert.equal(e.directMatches[0].age,82);assert.match(e.directMatches[0].exclusion,/限近20日.*82日/);
});
