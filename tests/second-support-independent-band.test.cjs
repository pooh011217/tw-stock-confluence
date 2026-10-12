const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/worker.js'), 'utf8');
const start = source.indexOf('function selectSecondSupport(');
const end = source.indexOf('\nfunction analyze(rows)', start);
assert.ok(start > 0 && end > start, 'selection function present');
const select = new Function(source.slice(start, end) + '\nreturn selectSecondSupport;')();
const first = {price: 100, low: 98, high: 100};
const candidate = (price, low, high, age=10, type='pivotLow') => ({price, low, high, age, type});
test('second support rejects overlapping band even when its main price is below S1', () => {
  const overlapping = candidate(95, 94, 99);
  const independent = candidate(94, 93, 96);
  assert.equal(select(first, [overlapping, independent], [overlapping, independent]), independent);
});
test('second support rejects candidate with inverted or missing bounds', () => {
  const invalid = candidate(94, 96, 93);
  const missing = {price: 94, low: 92, age: 10, type: 'pivotLow'};
  const valid = candidate(93, 91, 95);
  assert.equal(select(first, [invalid, missing, valid], [invalid, missing, valid]), valid);
});
test('second support keeps nearest independent range low priority', () => {
  const range = candidate(97, 95, 97, 3, 'rangeLow');
  const lower = candidate(90, 88, 92);
  assert.equal(select(first, [range, lower], [range, lower]), range);
});
