import test from 'node:test';
import assert from 'node:assert/strict';
import { readProgress, writeProgress } from '../src/storage.js';
import { shuffled } from '../src/utils.js';
function memoryStorage(value = null) {
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}
test('progress survives a save and reload', () => {
  const storage = memoryStorage();
  writeProgress({ found: ['太陽'], met: [2], best: { A: 20, B: 13, C: 8 }, sound: false }, storage);
  assert.deepEqual(readProgress(['太陽'], 7, storage), {
    found: ['太陽'],
    met: [2],
    best: { A: 20, B: 13, C: 8 },
    sound: false,
  });
});
test('corrupt or blocked storage does not prevent play', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(writeProgress({}, blocked), false);
  for (const storage of [blocked, memoryStorage('{broken'), memoryStorage('{"version":99}')]) {
    assert.deepEqual(readProgress(['太陽'], 7, storage).best, { A: 0, B: 0, C: 0 });
  }
});
test('untrusted saved values are validated and deduplicated', () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: 1,
      found: ['太陽', '太陽', '<img onerror=alert(1)>'],
      met: [0, 0, 7, -1, '2'],
      best: { A: -3, B: 999, C: 'bad' },
      sound: 'true',
    }),
  );
  assert.deepEqual(readProgress(['太陽'], 7, storage), {
    found: ['太陽'],
    met: [0],
    best: { A: 0, B: 15, C: 0 },
    sound: true,
  });
});
test('shuffle preserves every character and does not mutate its input', () => {
  const values = [0, 1, 2, 3, 4, 5, 6];
  const result = shuffled(values, () => 0.25);
  assert.deepEqual([...result].sort(), values);
  assert.deepEqual(values, [0, 1, 2, 3, 4, 5, 6]);
  assert.notDeepEqual(result, values);
});
