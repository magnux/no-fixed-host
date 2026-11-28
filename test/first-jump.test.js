import assert from 'node:assert/strict';
import test from 'node:test';
import { candidates, jumpLimit, listenersAt, packetAt, packetRadius, pulseJump, selectRelay, sensorRadius, startJump, tickJump } from '../src/migration.js';

function launch(state) {
  for (let i = 0; i < 4; i++) pulseJump(state);
}
function fly(state, dt = .016) {
  let nextLift = .416;
  let time = 0;
  while (state.phase === 'flying' && state.outcome === 'active') {
    if (time + 1e-8 >= nextLift) {
      pulseJump(state);
      nextLift += .672;
    }
    tickJump(state, dt);
    time += dt;
  }
}

test('four links can be flown over different paths and at different frame rates', () => {
  for (const [path, dt] of [[[0,1,0,0], 1/60], [[1,2,1,0], .016], [[1,1,1,0], 1/30]]) {
    const state = startJump();
    for (const target of path) {
      assert.ok(candidates(state).includes(target));
      selectRelay(state, target);
      launch(state);
      assert.equal(state.phase, 'flying');
      fly(state, dt);
    }
    assert.equal(state.outcome, 'complete');
    assert.deepEqual(state.trail, [0, ...path]);
  }
});
test('charge leaks between taps, an airborne route is committed, and a packet without lift falls', () => {
  const state = startJump();
  pulseJump(state);
  tickJump(state, .5);
  assert.ok(state.energy > 0 && state.energy < 28);
  selectRelay(state, 2);
  assert.equal(state.choice, 0);
  launch(state);
  selectRelay(state, 1);
  assert.equal(state.choice, 0);
  tickJump(state, 2);
  assert.equal(state.outcome, 'expired');
  assert.match(state.reason, /Carrier lost/);
});
test('live listener rings catch on contact even on coarse frames, and launch starts the port timer', () => {
  const state = startJump();
  tickJump(state, 2.752);
  assert.equal(state.elapsed, 0);
  launch(state);
  tickJump(state, 1.25);
  assert.equal(state.outcome, 'traced');
  const eye = listenersAt(state.time)[state.hop], p = packetAt(state);
  assert.ok(Math.hypot(p.x-eye.x, p.y-eye.y) <= sensorRadius + packetRadius);
  const docked = startJump();
  pulseJump(docked);
  tickJump(docked, jumpLimit + 1);
  assert.equal(docked.outcome, 'expired');
  assert.match(docked.reason, /closed its port/);
});
