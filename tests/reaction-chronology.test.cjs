const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/reaction.js'), 'utf8')
  .replace(/export\s*\{[^}]*\};?\s*$/, '');
const ctx = vm.createContext({});
vm.runInContext(source + '\nthis.recentReactionBands = recentReactionBands;', ctx);
const row = (date, low, high) => ({date, low, high, close:100});

test('future and undated OHLC cannot form D-day reaction bands', () => {
 const analysis = {date:'2026-10-15',current:100,atr14:2,rows:[
  row('2026-10-14',95,105),row('2026-10-15',95,105),
  row('2026-10-16',95,105),row(undefined,95,105)
 ]};
 const actual=ctx.recentReactionBands(analysis);
 assert.equal(actual.usedRows,2);
 assert.equal(actual.support.length,1);
 assert.equal(actual.resistance.length,1);
 assert.equal(actual.support[0].uniqueSessions,2);
 assert.equal(actual.resistance[0].uniqueSessions,2);
});
test('shuffled rows use chronological last N sessions, not input order', () => {
 const analysis={date:'2026-10-15',current:100,atr14:2,rows:[
  row('2026-10-15',95,105),row('2026-10-13',80,120),row('2026-10-14',95,105)
 ]};
 const actual=ctx.recentReactionBands(analysis,2);
 assert.equal(actual.usedRows,2);
 assert.equal(actual.support.length,1);
 assert.equal(actual.support[0].price,95);
 assert.equal(actual.resistance.length,1);
 assert.equal(actual.resistance[0].price,105);
});

test('missing or malformed base date cannot admit any reaction rows', () => {
 for (const date of [undefined, null, '', '2026/10/15']) {
  const analysis={date,current:100,atr14:2,rows:[row('2026-10-14',95,105),row('2026-10-15',95,105),row('2026-10-16',95,105)]};
  const actual=ctx.recentReactionBands(analysis);
  assert.equal(actual.usedRows,0);
  assert.equal(actual.support.length,0);
  assert.equal(actual.resistance.length,0);
 }
});

test('breakout preserves independent second and medium resistance', () => {
 const level=price=>({price,bandLow:price,bandHigh:price,distance:(price-100)/100,sources:[]});
 const analysis={date:'2026-10-15',current:100,rows:[],breakout:level(105),resistance2:level(108),mediumResistance:level(115)};
 vm.runInContext('this.applyRecentReactionOverlay=applyRecentReactionOverlay;',ctx);
 ctx.applyRecentReactionOverlay({analysis});
 assert.equal(analysis.breakout.price,105);
 assert.equal(analysis.resistance2.price,108);
 assert.equal(analysis.mediumResistance.price,115);
});
