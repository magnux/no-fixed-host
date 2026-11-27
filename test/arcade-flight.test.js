import test from 'node:test';
import assert from 'node:assert/strict';
import { startOrbit, depart, stepFlight } from '../src/arcade/prototypes/orbital-insertion.js';
import { startConvoy, pilot, stepConvoy } from '../src/arcade/prototypes/clear-passage.js';

function land(angle, brakeAltitude) {
  const craft = startOrbit();
  craft.angle = angle;
  depart(craft);
  for (let frame = 0; frame < 3600; frame++) {
    if (craft.altitude < brakeAltitude && craft.fuel > 0) craft.braking = true;
    const result = stepFlight(craft, 1 / 60);
    if (result) return result.outcome;
  }
  assert.fail('The landing never resolved.');
}

test('orbital entry alignment affects fuel and pad access, and braking determines impact speed', () => {
  const onGate = startOrbit();
  onGate.angle = 0;
  const offGate = startOrbit();
  offGate.angle = 1.3;
  depart(onGate);
  depart(offGate);
  assert.ok(onGate.fuel > offGate.fuel);
  assert.equal(land(0, 30), 'complete');
  assert.equal(land(1.3, 30), 'partial');
  assert.equal(land(0, 20), 'partial');
  assert.equal(land(0, 0), 'failed');
});

function escort(guardThroughWave) {
  const game = startConvoy(() => 0.5);
  game.phase = 'flight';
  for (let frame = 0; frame < 2000; frame++) {
    const incoming = game.rocks.find(rock => !rock.fragment && rock.x > game.ship.x + 25);
    if (incoming && game.wave <= guardThroughWave) {
      // A pointer tap on the approaching rock aims and then fires the same shot.
      game.ship.angle = Math.atan2(incoming.y - game.ship.y, incoming.x - game.ship.x);
      pilot(game, 'fire');
    }
    const result = stepConvoy(game, 1 / 60);
    if (result) return [result.outcome, game.cargo];
  }
  assert.fail('The convoy never reached its destination.');
}

test('early interceptions preserve cargo; abandoned waves can cost some or all crates', () => {
  assert.deepEqual(escort(8), ['complete', 3]);
  assert.deepEqual(escort(6), ['partial', 1]);
  assert.deepEqual(escort(0), ['failed', 0]);
});
