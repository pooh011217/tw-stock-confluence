const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/worker.js','utf8');
const ctx=vm.createContext({Response,Request,URL,Headers,setTimeout,console});
vm.runInContext(source.replace('export default','globalThis.worker='),ctx);
const fixtures={2368:{support1:1260,support2:1240,breakout:1300,resistance1:null,resistance2:1400},8299:{support1:2055,support2:2010,breakout:null,resistance1:2080,resistance2:2160}};
for(const [code,expected] of Object.entries(fixtures))test('production pipeline regression '+code,()=>{
 const rows=JSON.parse(fs.readFileSync('tests/fixtures/2026-10-08/'+code+'.json','utf8'));
 ctx.rows=rows;
 const output=vm.runInContext('calibrateAvReview(rows,"guarded-breakout")',ctx);
 assert.equal(output.date,'2026-10-08');
 const actual=Object.fromEntries(Object.keys(expected).map(key=>[key,output[key]?.price??null]));
 assert.deepEqual(actual,expected,'This test freezes the existing engine output, not photo target prices. Any intentional formula change requires a cross-date A/B report before updating this baseline.');
 assert.ok(!(output.breakout&&output.resistance1),'breakout and first resistance are mutually exclusive');
});
