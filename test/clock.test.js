import assert from 'node:assert/strict';
import test from 'node:test';
import { FAST_RATES, MinuteClock, nextFastRate } from '../src/ui/clock.js';

test('playback counts one-minute ticks at the same rate across display refresh rates', () => {
  for (const rate of [1, ...FAST_RATES]) {
    for (const fps of [24, 60, 144]) {
      const clock = new MinuteClock();
      clock.setRate(rate, 0);
      let total = 0;
      for (let frame = 1; frame <= fps; frame++) {
        const count = clock.takeTicks(frame * 1000 / fps);
        assert.ok(count <= Math.ceil(rate / fps), 'one frame accumulated too many ticks');
        total += count;
      }
      assert.equal(total, rate);
    }
  }
});

test('changing speed preserves fractional progress and pause discards elapsed background time', () => {
  const clock = new MinuteClock();
  clock.setRate(1, 0);
  for (const time of [200, 400, 600, 800]) assert.equal(clock.takeTicks(time), 0);
  clock.setRate(60, 800);
  assert.equal(clock.takeTicks(804), 1);
  clock.setRate(0, 804);
  assert.equal(clock.takeTicks(90_000), 0);
  clock.setRate(60, 90_000);
  assert.equal(clock.takeTicks(90_010), 0);
  assert.equal(clock.takeTicks(90_020), 1);
  assert.equal(clock.takeTicks(120_020), 0, 'a suspended frame triggered catch-up');
  assert.equal(clock.takeTicks(120_120), 6);
  assert.deepEqual([0, 1, 60, 360, 1440].map(nextFastRate), [60, 60, 360, 1440, 60]);
});
