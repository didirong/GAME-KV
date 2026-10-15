import test from 'node:test';
import assert from 'node:assert/strict';
import { assets } from '../src/assets.js';
import { loadingPose, creditsMotion } from '../src/presentation.js';
test('characters enter from outside in order and finish inside the poster', () => {
  for (let index = 0; index < 7; index++) {
    const before = loadingPose(index, index * 0.24);
    assert.equal(before.opacity, 0);
    assert.equal(before.left, -26);
    assert.equal(loadingPose(index, index * 0.24 + 0.01).opacity, 1);
    const settled = loadingPose(index, 3),
      width = (17 * assets.sprites[index].w) / assets.sprites[index].h;
    assert.ok(settled.left >= 0 && settled.left + width <= 92);
    assert.equal(settled.left, 0.5 + index * 12.1);
    assert.equal(loadingPose(index, 1, true).bounce, 0);
  }
  assert.equal(loadingPose(0, 0.2).opacity, 1);
  assert.equal(loadingPose(1, 0.2).opacity, 0);
  assert.equal(loadingPose(6, 1).opacity, 0); // a cache hit must not skip the entrance sequence
});
test('credits stop with their last line above the controls across device sizes', () => {
  for (const width of [284, 390, 430, 512]) {
    const viewport = width * 2,
      content = width * 9,
      motion = creditsMotion(viewport, content, width);
    assert.equal(motion.from, viewport);
    assert.ok(Math.abs(content + motion.to - (viewport - width * 0.28)) < 0.000001);
    assert.ok(motion.duration >= 55000 && Number.isFinite(motion.duration));
  }
});
