import assert from 'node:assert/strict';
import test from 'node:test';
import { newChassis, enterPlant, jumpChassis, airDash, fireChassis, tickChassis } from '../src/arcade/prototypes/hot-swap.js';

function playPlant(game, id) {
  enterPlant(game, id);
  const takeoff = id === 'foundry' ? [96, 190, 247, 352] : [84, 184, 288, 370];
  for (let frame = 0; frame < 4800 && game.phase === 'run'; frame++) {
    if (game.deck !== null && game.deck < 4 && game.x >= takeoff[game.deck]) jumpChassis(game);
    const approaching = !game.checkpoint || game.x < 490;
    if (!approaching && game.deck !== null) {
      const lowShot = game.embers.some(s => !s.reflected && s.x > game.x && s.x < game.x + 39 && s.y > 110);
      if (lowShot || (id === 'turbine' && frame % 75 === 0)) jumpChassis(game);
    }
    tickChassis(game, 1/60, Number(approaching), true);
  }
  assert.ok(['complete', 'swap'].includes(game.phase), id + ' route ended with ' + game.phase + ' at x=' + game.x);
}

test('both plant orders can be cleared with ordinary jumps and shots, and each equips its module for the second stage', () => {
  for (const [first, second] of [['foundry','turbine'],['turbine','foundry']]) {
    const game = newChassis();
    playPlant(game, first);
    assert.equal(game.phase, 'swap');
    enterPlant(game, first);
    assert.equal(game.phase, 'swap');
    playPlant(game, second);
    assert.deepEqual(game.cleared, [first, second]);
    assert.equal(game.phase, 'complete');
  }
});

test('the unlocked air dash works once per jump and the heat shield deflects a hot bolt', () => {
  const game = newChassis();
  playPlant(game, 'turbine');
  enterPlant(game, 'foundry');
  airDash(game);
  assert.equal(game.dash, 0);
  jumpChassis(game); airDash(game);
  assert.ok(game.dash > 0);
  tickChassis(game, .01, 1, false);
  const remaining = game.dash;
  airDash(game);
  assert.equal(game.dash, remaining);

  const shielded = newChassis();
  playPlant(shielded, 'foundry');
  enterPlant(shielded, 'turbine');
  Object.assign(shielded, { x: 520, deck: 4, checkpoint: true, embers: [{ x: 520, y: 128, vx: -80, vy: 0 }] });
  tickChassis(shielded, .01, 0, false);
  assert.equal(shielded.hp, 4);
  assert.equal(shielded.embers[0].reflected, true);
});

test('a fall costs hull, ending the attempt with a different result after a core recovery', () => {
  for (const recovered of [false, true]) {
    const game = newChassis();
    if (recovered) playPlant(game, 'turbine');
    enterPlant(game, 'foundry');
    for (let frame = 0; frame < 1800 && game.phase === 'run'; frame++) tickChassis(game, 1/60, 1, false);
    assert.equal(game.phase, recovered ? 'partial' : 'failed');
    fireChassis(game);
    assert.deepEqual(game.bullets, []);
  }
});
