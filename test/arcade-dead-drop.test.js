import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRace, dispatch, ghostAt, recordBest, steerTo, stepRace,
} from '../src/arcade/prototypes/dead-drop-circuit.js';

const boulevard = [[480,224], [510,220], [530,203], [536,170], [536,99], [523,79], [502,64]];
const depot = [[200,224], [218,224], [273,178], [267,141], [331,63]];
const handoff = [[109,63], [84,74], [69,99], [69,145]];

function deliver(branch, wait = 0) {
  const race = createRace();
  dispatch(race);
  const course = [...branch, ...handoff];
  let next = 0;
  for (let frame = 0; frame < 2400 && race.phase === 'racing'; frame++) {
    let [x, y] = course[next];
    if (Math.hypot(x - race.x, y - race.y) < 11 && next < course.length - 1) [x, y] = course[++next];
    stepRace(race, race.time < wait ? {} : steerTo(race, { x, y }), 1 / 60);
  }
  return race;
}

test('both city routes deliver with the public steering controls and the depot saves time', () => {
  const long = deliver(boulevard), short = deliver(depot);
  assert.equal(long.phase, 'complete');
  assert.equal(short.phase, 'complete');
  assert.equal(long.shortcut, false);
  assert.equal(short.shortcut, true);
  assert.equal(short.gate, 3);
  assert.ok(short.time + 2 < long.time);
});

test('missing the first window gives a late delivery, and the last call closes the route', () => {
  assert.equal(deliver(boulevard, 10).phase, 'partial');
  assert.equal(deliver(depot, 40).phase, 'failed');
  const parked = createRace();
  for (let i = 0; i < 2500; i++) stepRace(parked, { gas: true }, 1 / 60);
  assert.equal(parked.phase, 'ready');
  assert.equal(parked.time, 0);
  // A straight cross-city line meets the curb and cannot trigger any gates.
  dispatch(parked);
  for (let i = 0; i < 240; i++) stepRace(parked, steerTo(parked, { x: 100, y: 64 }), 1 / 60);
  assert.equal(parked.gate, 0);
  assert.ok(parked.y > 201);
});

test('ghost replays recorded position and retains the fastest finished run only', () => {
  const baseline = deliver(boulevard), record = recordBest(null, baseline);
  assert.ok(record);
  assert.equal(recordBest(record, deliver(depot, 40)), record);
  assert.equal(recordBest(record, deliver(boulevard, 10)), record);
  const faster = recordBest(record, deliver(depot));
  assert.ok(faster.time < record.time);
  const [a, b] = faster.trace.slice(8, 10);
  const ghost = ghostAt(faster, (a.t + b.t) / 2);
  assert.ok(Math.abs(ghost.x - (a.x + b.x) / 2) < 0.0001);
  assert.ok(Math.abs(ghost.y - (a.y + b.y) / 2) < 0.0001);
  assert.equal(ghostAt(faster, faster.time + 1), null);
});
