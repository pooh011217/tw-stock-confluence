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
 if(code==='2368')assert.equal(output.pressureMode,'breakout','2368 photo-aligned breakout role must not regress to ordinary resistance');
 if(code==='8299')assert.equal(output.pressureMode,'ordinary','8299 ordinary resistance role must not regress to breakout');
 for(const key of ['support1','support2','breakout','resistance1','resistance2']){
  const level=output[key];if(!level)continue;
  assert.ok(level.bandLow<=level.price&&level.price<=level.bandHigh,key+' main price must be inside its band');
 }
 if(output.support1&&output.support2)assert.ok(output.support2.bandHigh<output.support1.bandLow,'independent second support must not overlap first');
 if(output.resistance2&&(output.breakout||output.resistance1))assert.ok(output.resistance2.bandLow>(output.breakout||output.resistance1).bandHigh,'independent second resistance must not overlap first');
});
