import assert from 'node:assert/strict';
import test from 'node:test';
import { calibrate, crossingOpen, jump, machineryPose, startShift, stepShift } from '../src/arcade/prototypes/night-shift.js';
import { makePattern, newTraceRun, readPattern, scramblePattern, submitTrace, tickTrace, turnMask } from '../src/arcade/prototypes/proof-of-pattern.js';

function randomSeed(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('generated shifts can be cleared by walking, waiting for a green lamp and jumping', () => {
  const dt = 1 / 120;
  const layouts = new Set();
  for (let seed = 0; seed < 80; seed++) {
    const drone = startShift(randomSeed(seed * 7357));
    layouts.add(JSON.stringify(drone.decks));
    const walkTo = x => {
      for (let i = 0; drone.x < x && i < 600; i++) assert.equal(stepShift(drone, dt, 1), false);
      assert.ok(drone.x >= x);
    };
    for (let gap = 0; gap < drone.decks.length - 1; gap++) {
      walkTo(drone.decks[gap].right - 21);
      const machine = drone.machinery.find(item => item.gap === gap);
      if (machine) {
        for (let i = 0; i < 720 && !crossingOpen(machine, drone.elapsed); i++) assert.equal(stepShift(drone, dt, 0), false);
        assert.ok(crossingOpen(machine, drone.elapsed));
      }
      jump(drone);
      walkTo(drone.decks[gap + 1].left + 15);
      for (let i = 0; drone.deck === null && i < 240; i++) assert.equal(stepShift(drone, dt, 0), false);
      assert.equal(drone.deck, gap + 1);
      const station = drone.stations.find(post => post.deck === drone.deck);
      if (!station) continue;
      walkTo(station.x);
      let result = calibrate(drone);
      for (let i = 0; i < 400 && result === 'miss'; i++) {
        stepShift(drone, dt, 0);
        result = calibrate(drone);
      }
      assert.equal(result, gap === drone.decks.length - 2 ? 'complete' : 'locked');
    }
    assert.ok(drone.serviced.every(Boolean));
    assert.equal(drone.falls, 0);
  }
  assert.equal(layouts.size, 80);
});

test('contact with either moving machine and falling both return a spare to the checkpoint', () => {
  const drone = startShift(() => 0);
  assert.equal(calibrate(drone), 'away');
  const post = drone.stations[0];
  Object.assign(drone, { x: post.x, y: drone.decks[post.deck].y, deck: post.deck });
  assert.equal(calibrate(drone), 'locked');
  for (const machine of drone.machinery) {
    const low = machineryPose(machine, 0), high = machineryPose(machine, 2);
    assert.notDeepEqual(low, high);
    const head = machineryPose(machine, drone.elapsed);
    Object.assign(drone, { x: head.x, y: head.y + 10, deck: null });
    assert.equal(stepShift(drone, 0, 0), true);
    assert.equal(drone.x, post.x);
  }
  Object.assign(drone, { x: 5, y: 310, deck: null });
  assert.equal(stepShift(drone, 1 / 120, 0), true);
  assert.equal(drone.falls, 3);
  assert.equal(drone.x, post.x);
  assert.deepEqual(drone.serviced, [true, false, false]);
});

test('every transformed observation puzzle scrambles and retains a solution', () => {
  for (let template = 0; template < 3; template++) for (let turns = 0; turns < 4; turns++) for (const mirror of [true, false]) {
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

function solveCapture(run) {
  const sample = run.order[run.recorded];
  for (let rotation = 0; rotation < 4; rotation++) for (const mirror of [true, false]) {
    const solved = makePattern(sample, rotation, mirror);
    if (JSON.stringify([solved.source, solved.probes]) !== JSON.stringify([run.model.source, run.model.probes])) continue;
    for (let cell = 0; cell < 9; cell++) {
      let mask = run.model.masks[cell];
      for (let turns = 0; mask !== solved.masks[cell] && turns < 3; turns++) mask = turnMask(mask);
      assert.equal(mask, solved.masks[cell]);
      run.model.masks[cell] = mask;
    }
    return;
  }
  assert.fail('no matching capture');
}

test('the receiver needs three different solved traces within one shared sweep window', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const run = newTraceRun(randomSeed(seed));
    const fingerprints = new Set();
    for (let capture = 0; capture < 3; capture++) {
      assert.equal(readPattern(run.model).complete, false);
      fingerprints.add(run.model.finding);
      tickTrace(run, 21);
      solveCapture(run);
      assert.equal(submitTrace(run), 'recorded');
      assert.equal(run.recorded, capture + 1);
      assert.equal(run.outcome, capture === 2 ? 'complete' : null);
    }
    assert.equal(run.remaining, 37);
    assert.equal(fingerprints.size, 3);
    tickTrace(run, 1000);
    assert.equal(run.outcome, 'complete');
  }
});

test('rejected samples spend time and the sweep preserves only archived evidence', () => {
  const missed = newTraceRun(() => .2);
  tickTrace(missed, 96);
  assert.equal(submitTrace(missed), 'miss');
  assert.equal(missed.remaining, 0);
  assert.equal(missed.outcome, 'failed');
  const partial = newTraceRun(() => .6);
  solveCapture(partial);
  submitTrace(partial);
  tickTrace(partial, 100);
  assert.equal(partial.outcome, 'partial');
  assert.equal(submitTrace(partial), undefined);
  assert.equal(partial.recorded, 1);
});
