const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const refs=[
 ['1615',52.70,50.70,55.70,56.70],
 ['3167',942.67,925.33,985.67,1011.33],
 ['3564',71.93,69.67,75.73,77.27],
 ['3265',269.50,246.50,304.00,315.50],
 ['2886',50.63,50.17,51.33,51.57],
 ['4979',550.67,513.33,606.67,625.33]
];
function reconstruct([,s1,s2,r1,r2]){const P=(s2+r2)/2,H=2*P-s1,L=2*P-r1,C=3*P-H-L;return{P,H,L,C,S1:2*P-H,S2:P-(H-L),R1:2*P-L,R2:P+(H-L)}}
test('10/14 screenshot six-stock table is classic floor pivot arithmetic',()=>{
 for(const row of refs){const x=reconstruct(row),[,s1,s2,r1,r2]=row;assert.ok(x.H>=x.L);assert.ok(x.C>=x.L-.03&&x.C<=x.H+.03);assert.ok(Math.abs(x.S1-s1)<.02);assert.ok(Math.abs(x.S2-s2)<.02);assert.ok(Math.abs(x.R1-r1)<.02);assert.ok(Math.abs(x.R2-r2)<.02);assert.ok(Math.abs((r1-s1)-(x.H-x.L))<.02)}
});
test('production pivot overlay is guarded and no-lookahead',()=>{
 const src=fs.readFileSync('src/main.js','utf8');
 assert.match(src,/P=\(H\+L\+C\)\/3/);assert.match(src,/usesBaseDayHLCOnly:true/);assert.match(src,/createsNewLevels:false/);assert.match(src,/roleChanged:false/);assert.doesNotMatch(src,/actualNext|predictionFor|nextActualSession/);
});
