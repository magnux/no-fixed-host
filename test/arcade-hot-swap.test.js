import assert from 'node:assert/strict';
import test from 'node:test';
import {
  plants, newChassis, enterPlant, extractCore, jumpChassis, airDash, shieldChassis, fireChassis, tickChassis,
} from '../src/arcade/prototypes/hot-swap.js';

function finishPlant(game, id) {
  enterPlant(game, id);
  const decks = plants[id].decks;
  let bridge = false;
  for (let frame = 0; frame < 4800 && game.phase === 'run'; frame++) {
    if (game.deck !== null && game.deck < decks.length - 1) {
      const right = decks[game.deck][1], distance = decks[game.deck + 1][0] - right;
      // Launch early across a short gap; use the marked lip and dash at the apex across a long one.
      if (game.x >= right - (distance > 100 ? 6 : 22)) {
        bridge = distance > 100;
        jumpChassis(game);
      }
    }
    if (bridge && !game.usedDash && game.deck === null && game.vy > -30) {
      airDash(game); bridge = false;
    }
    const approaching = game.x < 468;
    const threat = game.embers.some(bolt => !bolt.reflected && Math.hypot(bolt.x-game.x, bolt.y-game.y+10) < 41);
    if (threat && game.shieldCooldown <= 0) shieldChassis(game);
    if (!approaching && game.deck !== null && (frame % 75 === 0 || (threat && !game.shield))) jumpChassis(game);
    tickChassis(game, 1/120, Number(approaching), true);
  }
  assert.ok(['swap', 'complete'].includes(game.phase), id + ' ended ' + game.phase + ' at ' + game.x + ', ' + game.y + '; ' + game.message);
}

test('every contract is independently beatable using its regular movement and attack inputs', () => {
  for (const id of Object.keys(plants)) {
    const game = newChassis();
    finishPlant(game, id);
    assert.deepEqual(game.cleared, [id]);
    extractCore(game);
    assert.equal(game.phase, 'complete');
  }
});

test('the four cores can optionally be linked in one run, with repairs and new modules at each swap', () => {
  const game = newChassis();
  for (const id of ['condenser','foundry','uplink','turbine']) {
    finishPlant(game, id);
    assert.equal(game.maxHp, id === 'condenser' ? 5 : 6);
  }
  assert.equal(game.phase, 'complete');
  assert.equal(game.cleared.length, 4);
});

test('a heavy sentry bolt inflicts double damage; an active parry sends it back for triple damage', () => {
  for (const parry of [false, true]) {
    const game = newChassis();
    enterPlant(game, 'foundry');
    const sentry = game.enemies[1];
    Object.assign(game, { x: 223, y: 120, deck: null });
    game.embers.push({ x: game.x, y: game.y - 10, vx: -12, vy: 0, heavy: true, source: sentry });
    if (parry) shieldChassis(game);
    tickChassis(game, .001, 0, false);
    if (!parry) { assert.equal(game.hp, 3); continue; }
    assert.equal(game.hp, 5);
    assert.equal(game.embers[0].reflected, true);
    fireChassis(game);
    assert.equal(game.bullets.length, 0);
    for (let frame = 0; frame < 65; frame++) tickChassis(game, 1/120, 0, false);
    assert.equal(sentry.hp, 0);
    assert.equal(game.shield, 0);
    shieldChassis(game); assert.equal(game.shield, 0);
    fireChassis(game); assert.equal(game.bullets.length, 1);
    for (let frame = 0; frame < 220; frame++) tickChassis(game, 1/120, 0, false);
    shieldChassis(game); assert.ok(game.shield > 0);
  }
});

test('the marked turbine shaft requires an air dash, which can only be fired once before landing', () => {
  for (const boosted of [false,true]) {
    const game = newChassis();
    enterPlant(game, 'turbine');
    Object.assign(game, { x: 193, y: 128, deck: 1 });
    airDash(game); assert.equal(game.dash, 0);
    jumpChassis(game);
    for (let i = 0; i < 145; i++) {
      if (i === 48 && boosted) { airDash(game); assert.ok(game.dash > 0); }
      if (i === 86 && boosted) { airDash(game); assert.equal(game.dash, 0); }
      tickChassis(game, 1 / 120, Number(game.x < 320), false);
    }
    assert.equal(game.x > 300, boosted);
    if (boosted) assert.equal(game.deck, 2);
  }
});

test('failure retains a partial outcome when a prior contract was recovered', () => {
  for (const recovered of [false,true]) {
    const game = newChassis();
    if (recovered) finishPlant(game, 'turbine');
    enterPlant(game, 'foundry');
    for (let i = 0; i < 2200 && game.phase === 'run'; i++) tickChassis(game, 1 / 120, 1, false);
    assert.equal(game.phase, recovered ? 'partial' : 'failed');
  }
});
