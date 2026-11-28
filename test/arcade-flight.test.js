import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startOrbit,
  depart,
  stepFlight,
  trimOrbit,
  telemetry,
  moonAt,
  toggleBrake,
  stoppingHeight,
  nudgeLander,
} from '../src/arcade/prototypes/orbital-insertion.js';
import { startConvoy, pilot, stepConvoy } from '../src/arcade/prototypes/clear-passage.js';

const frame = 1 / 60;

function launchAt(angle) {
  const ship = startOrbit();
  trimOrbit(ship, 1);
  trimOrbit(ship, 1);
  for (let elapsed = 0; elapsed < 20; elapsed += frame) {
    if (Math.abs(telemetry(ship).error - angle) < 0.006) {
      depart(ship);
      return ship;
    }
    stepFlight(ship, frame);
  }
  assert.fail('The departure window never arrived');
}

function fly(ship, landingPolicy) {
  for (let elapsed = 0; elapsed < 100; elapsed += frame) {
    if (ship.phase === 'descent') landingPolicy(ship);
    const result = stepFlight(ship, frame);
    if (result) return result;
  }
  assert.fail('The flight never resolved');
}

test('prograde impulses change the parking ellipse, and inverse-square coasting preserves its apsides', () => {
  const ship = startOrbit();
  const start = telemetry(ship);
  assert.ok(start.apo - start.peri > 10);
  assert.equal(toggleBrake(ship), false);
  trimOrbit(ship, 1);
  trimOrbit(ship, 1);
  assert.ok(telemetry(ship).circular);
  assert.equal(ship.trim, 14);
  const originalMoon = moonAt(ship.time);
  for (let i = 0; i < 3000; i++) stepFlight(ship, 1 / 30);
  const end = telemetry(ship);
  assert.ok(Math.abs(end.r - 66) < 0.01);
  assert.ok(Math.abs(end.apo - end.peri) < 0.01);
  assert.notDeepEqual(moonAt(ship.time), originalMoon);
  trimOrbit(ship, -1);
  assert.ok(telemetry(ship).peri < end.peri);
});

test('a transfer is an actual coast and only an intersection with the moving moon starts descent', () => {
  const ship = launchAt(0);
  assert.equal(ship.phase, 'transfer');
  const origin = { ...ship };
  let elapsed = 0;
  while (ship.phase === 'transfer' && elapsed < 30) {
    stepFlight(ship, frame);
    elapsed += frame;
  }
  assert.equal(ship.phase, 'descent');
  assert.ok(elapsed > 5);
  assert.ok(Math.hypot(ship.px - origin.px, ship.py - origin.py) > 100);
  const moon = moonAt(ship.time);
  assert.ok(Math.hypot(ship.px - moon.x, ship.py - moon.y) < 11);
  assert.match(fly(launchAt(1), () => {}).detail, /Missed lunar capture/);
});

test('an excessive early brake produces a climb and consumes the landing reserve', () => {
  const ship = launchAt(0);
  while (ship.phase === 'transfer') stepFlight(ship, frame);
  toggleBrake(ship);
  for (let i = 0; i < 360; i++) stepFlight(ship, frame);
  assert.ok(ship.altitude > 100 && ship.fall < 0);
  assert.equal(ship.fuel, 0);
  assert.equal(stoppingHeight(ship), 0);
  assert.equal(fly(ship, () => {}).outcome, 'failed');
});

test('neglecting the retro engine destroys the lander; braking and lateral trim permit soft landings', () => {
  assert.match(fly(launchAt(0), () => {}).detail, /payload were destroyed/);
  for (const angle of [-0.08, 0, 0.08]) {
    const ship = launchAt(angle);
    const result = fly(ship, (c) => {
      if (Math.abs(c.vx) > 1.25) nudgeLander(c, -Math.sign(c.vx));
      const burn = c.fall > 2.5 && c.altitude < stoppingHeight(c) + 3;
      if (burn !== c.braking) toggleBrake(c);
    });
    assert.equal(result.outcome, 'complete');
    assert.ok(ship.fuel < 5.4 && ship.fuel > 0);
  }
});

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function begin(seed) {
  const game = startConvoy(seeded(seed));
  game.phase = 'flight';
  return game;
}

test('new belts vary debris, lane crossings and tug survey tracks; orders move the tug gradually', () => {
  const a = begin(24),
    b = begin(25);
  assert.notDeepEqual(a.plan, b.plan);
  assert.equal(a.plan.filter((rock) => rock.giant).length, 4);
  assert.deepEqual(a.plan, begin(24).plan);
  pilot(a, 'tugUp');
  const before = { ...a.tug };
  stepConvoy(a, frame);
  assert.ok(a.tug.y < before.y && a.tug.y > before.y - 5);
  for (let i = 0; i < 170; i++) {
    stepConvoy(a, frame);
    stepConvoy(b, frame);
  }
  assert.ok(a.tug.y < b.tug.y - 30);
  assert.notEqual(b.tug.x, 104);
});

test('shots never fragment monoliths, and each vessel takes damage once per monolith', () => {
  const game = begin(1);
  game.wave = game.plan.length;
  const rock = { ...game.plan.find((r) => r.giant), x: game.ship.x + 16, y: game.ship.y, vx: 0, vy: 0 };
  game.rocks = [rock];
  pilot(game, 'fire');
  stepConvoy(game, frame);
  assert.equal(game.shots.length, 0);
  assert.equal(game.rocks[0], rock);
  assert.equal(game.rocks.length, 1);
  assert.equal(game.hull, 1);
  for (let i = 0; i < 60; i++) stepConvoy(game, frame);
  assert.equal(game.hull, 1);
  rock.x = game.tug.x;
  rock.y = game.tug.y;
  stepConvoy(game, frame);
  assert.equal(game.cargo, 1);
  assert.ok(game.rocks.includes(rock));
});

test('formation flying, lane orders, and lead shots can escort all crates through independent fields', () => {
  for (const seed of [1, 2, 3, 4, 19, 211]) {
    const game = begin(seed);
    pilot(game, 'formation');
    let result;
    for (let i = 0; i < 2600; i++) {
      const giant = game.rocks.filter((r) => r.giant && r.x + 65 > game.tug.x).sort((a, b) => a.x - b.x)[0];
      if (giant && Math.abs(giant.y - (150 + game.tug.lane * 85)) < 65)
        pilot(game, giant.y < 150 ? 'tugDown' : 'tugUp');
      const target = game.rocks
        .filter((r) => !r.giant && r.x > game.ship.x + 10)
        .sort((a, b) => a.x - b.x)[0];
      if (target) {
        const dt = (target.x - game.ship.x) / 440;
        game.ship.angle = Math.atan2(
          target.y + (target.vy - game.ship.vy) * dt - game.ship.y,
          target.x + (target.vx - game.ship.vx) * dt - game.ship.x,
        );
        pilot(game, 'fire');
      }
      result = stepConvoy(game, frame);
      if (result) break;
    }
    assert.equal(result?.outcome, 'complete', `belt ${seed}`);
    assert.equal(game.cargo, 3);
  }
});
