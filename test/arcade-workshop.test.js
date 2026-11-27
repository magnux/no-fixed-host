import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrate, jump, startShift, stepShift } from '../src/arcade/prototypes/night-shift.js';
import { makePattern, readPattern, scramblePattern, turnMask } from '../src/arcade/prototypes/proof-of-pattern.js';

test('a maintenance drone can walk and jump the full shift, calibrating each post', () => {
  const drone = startShift(() => .5);
  const dt = 1 / 120;
  function walkTo(x) {
    for (let i = 0; drone.x < x && i < 600; i++) stepShift(drone, dt, 1);
    assert.ok(drone.x >= x);
  }
  function jumpTo(x) {
    jump(drone);
    walkTo(x);
    for (let i = 0; drone.deck === null && i < 300; i++) stepShift(drone, dt, 0);
    assert.notEqual(drone.deck, null);
  }
  function align(expected) {
    let result;
    for (let i = 0; i < 600; i++) {
      result = calibrate(drone);
      if (result !== 'miss') break;
      stepShift(drone, dt, 0);
    }
    assert.equal(result, expected);
  }
  walkTo(118); jumpTo(202); align('locked');
  walkTo(239); jumpTo(319);
  walkTo(339); jumpTo(410); align('locked');
  walkTo(452); jumpTo(542); align('complete');
  assert.deepEqual(drone.serviced, [true, true, true]);
  assert.equal(drone.falls, 0);
});

test('walking off a walkway uses a spare at the last calibrated station', () => {
  const drone = startShift(() => 0);
  assert.equal(calibrate(drone), 'away');
  Object.assign(drone, { x: 202, y: 208, deck: 1 });
  assert.equal(calibrate(drone), 'locked');
  for (let i = 0; i < 600 && drone.falls === 0; i++) stepShift(drone, 1 / 120, 1);
  assert.equal(drone.falls, 1);
  assert.equal(drone.deck, 1);
  assert.equal(drone.x, 202);
  assert.deepEqual(drone.serviced, [true, false, false]);
});

test('every transformed observation puzzle scrambles and retains a solution', () => {
  for (let template = 0; template < 2; template++) for (let turns = 0; turns < 4; turns++) for (const mirror of [true, false]) {
    const model = makePattern(template, turns, mirror);
    const solution = [...model.masks];
    assert.equal(readPattern(model).complete, true);
    for (const draw of [0, .2, .7, .999]) {
      model.masks = [...solution];
      scramblePattern(model, () => draw);
      assert.equal(readPattern(model).complete, false);
      assert.ok(model.masks.filter((m, i) => m !== solution[i]).length >= 4);
      for (let i = 0; i < 9; i++) {
        const choices = [0, 1, 2, 3].map(n => turnMask(model.masks[i], n));
        assert.ok(choices.includes(solution[i]));
      }
    }
  }
});
