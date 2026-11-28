import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRace,
  dispatch,
  route,
  steerTo,
  stepRace,
  recordBest,
  ghostAt,
} from '../src/arcade/prototypes/dead-drop-circuit.js';

function deliver(seed, delay = 0) {
  const race = createRace(seed);
  dispatch(race);
  let anchor = race.nearest,
    destination = anchor;
  for (let frame = 0; frame < 6600 && race.phase === 'racing'; frame++) {
    const stop = race.stops[race.gate];
    const current = race.city.nodes[destination];
    if (Math.hypot(current.x - race.x, current.y - race.y) < 5.5) {
      anchor = destination;
      destination = route(race.city, anchor, stop, race.closed)[1] ?? stop;
    }
    if (race.closed >= 0 && race.city.nodes[anchor].links.some(l => l.edge === race.closed && l.to === destination))
      destination = anchor;
    const input = steerTo(race, race.city.nodes[destination]);
    if (anchor === stop) {
      input.service = true;
      input.brake = true;
    }
    stepRace(race, race.time < delay ? {} : input, 1 / 60);
  }
  return race;
}

test('a district has 48 reachable intersections, passing traffic, randomized contracts and safe alternate routes during closures', () => {
  for (let seed = 1; seed <= 18; seed++) {
    const { city, stops, traffic, nearest } = createRace(seed);
    assert.equal(city.nodes.length, 48);
    assert.ok(city.w > 1150 && city.h > 670);
    assert.equal(new Set(stops).size, 4);
    assert.ok(traffic.length >= 12 && city.obstacles.length >= 7);
    for (const closed of city.closures) for (const stop of stops) assert.ok(route(city, nearest, stop, closed).length);
  }
  const one = createRace(10),
    again = createRace(10),
    different = createRace(20);
  assert.deepEqual(one.stops, again.stops);
  assert.deepEqual(one.traffic, again.traffic);
  assert.notDeepEqual(one.stops, different.stops);
  assert.notDeepEqual(one.city.edges, different.city.edges);
});

test('normal steering and four stopped handoffs can complete both courier jobs with traffic and events active', () => {
  for (const seed of [1, 7, 56]) {
    const run = deliver(seed);
    assert.equal(run.phase, 'complete', JSON.stringify([seed, run.gate, run.x, run.y, run.time]));
    assert.equal(run.gate, 4);
    assert.ok(run.eventIndex > 0);
  }
});

test('traffic moves and damages a car, closed streets reroute, pickups require the handoff action, and last call ends the run', () => {
  const run = createRace(7),
    car = run.traffic[0];
  const origin = { x: car.x, y: car.y };
  stepRace(run, { gas: true }, 1);
  assert.equal(run.time, 0);
  dispatch(run);
  run.x = car.x;
  run.y = car.y;
  stepRace(run, {}, 1 / 60);
  assert.ok(run.collisions);
  const pickup = run.city.nodes[run.stops[0]];
  run.x = pickup.x;
  run.y = pickup.y;
  run.speed = 0;
  for (let i = 0; i < 720; i++) stepRace(run, {}, 1 / 60);
  assert.equal(run.gate, 0);
  assert.notEqual(car.x + car.y, origin.x + origin.y);
  for (let i = 0; i < 20; i++) stepRace(run, { service: true }, 1 / 60);
  assert.equal(run.gate, 1);
  assert.ok(run.closed >= 0);
  while (run.phase === 'racing') stepRace(run, {}, 1 / 30);
  assert.equal(run.phase, 'failed');
});

test('ghosts use only completed deliveries and match their district and their fastest trace', () => {
  const run = deliver(7),
    best = recordBest(null, run);
  assert.equal(best.seed, 7);
  assert.equal(recordBest(best, createRace(78)), best);
  const slower = { ...run, time: run.time + 4 };
  assert.equal(recordBest(best, slower), best);
  const [a, b] = best.trace.slice(4, 6),
    ghost = ghostAt(best, (a.t + b.t) / 2);
  assert.ok(Math.abs(ghost.x - (a.x + b.x) / 2) < 0.0001);
  assert.equal(ghostAt(best, best.time + 1), null);
});
