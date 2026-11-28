import assert from 'node:assert/strict';
import test from 'node:test';
import { launchBall, newTable, pullPlunger, stepTable, tableTouchControl } from '../src/arcade/prototypes/black-start.js';

function play(chargeTime, flip) {
  const table = newTable();
  let result;
  for (let frame = 0; frame < 4800 && !result; frame++) {
    if (table.phase === 'ready') {
      pullPlunger(table);
      stepTable(table, chargeTime);
      launchBall(table);
    }
    if (flip && table.ball.y > 316 && table.ball.vy > 0) table.held.fill(true);
    if (table.ball.y < 300) table.held.fill(false);
    result = stepTable(table, 1 / 60);
  }
  return { result, table };
}

test('plunger power and flipper timing can reach each pinball ending from the waiting table', () => {
  const win = play(0, true);
  assert.equal(win.result, 'complete');
  assert.deepEqual(win.table.lit, [true, true, true]);
  assert.equal(win.table.rampShot, true);

  const loss = play(0, false);
  assert.equal(loss.result, 'failed');
  assert.equal(loss.table.balls, 0);

  const partial = play(0.45, false);
  assert.equal(partial.result, 'partial');
  assert.equal(partial.table.balls, 0);
  assert.ok(partial.table.lit.some(Boolean));
});

test('a ball save preserves earned banks and can be claimed only once on the same ball', () => {
  const table = newTable();
  table.lit[2] = true;
  for (let serve = 0; serve < 2; serve++) {
    launchBall(table);
    stepTable(table, 0.8);
    assert.equal(table.phase, 'play');
    Object.assign(table.ball, { x: 153, y: 374, vx: 0, vy: 50 });
    stepTable(table, 1 / 60);
    assert.equal(table.balls, serve === 0 ? 3 : 2);
    assert.equal(table.phase, 'ready');
    assert.deepEqual(table.lit, [false, false, true]);
  }
  assert.deepEqual(newTable().lit, [false, false, false]);
});

test('a physically entered orbit takes the ball around the wireform and a return trip arms a one-shot kickback', () => {
  const table = newTable();
  table.phase = 'play';
  for (let side = 0; side < 2; side++) {
    Object.assign(table.ball, { x: side ? 282 : 23, y: 192.5, vx: 0, vy: -200 });
    stepTable(table, 1 / 60);
    assert.equal(table.phase, 'orbit');
    stepTable(table, 0.33);
    assert.ok(table.ball.y < 65);
    stepTable(table, 0.36);
    assert.equal(table.phase, 'play');
    assert.ok(side ? table.ball.x < 60 : table.ball.x > 245);
  }
  assert.equal(table.orbits, 2);
  assert.equal(table.kickback, true);
  Object.assign(table.ball, { x: 153, y: 354, vx: 0, vy: 100 });
  stepTable(table, 1 / 60);
  assert.equal(table.kickback, false);
  assert.equal(table.balls, 3);
  assert.ok(table.ball.vy < 0);
});

test('capacitor drop targets change collision geometry, time a double-score event, and reset after it', () => {
  const t = newTable();
  t.phase = 'play';
  for (const [x, y] of [
    [96, 200],
    [152, 184],
    [209, 200],
  ]) {
    Object.assign(t.ball, { x, y: y + 9, vx: 0, vy: -200 });
    stepTable(t, 1 / 30);
  }
  assert.deepEqual(t.down, [true, true, true]);
  assert.equal(t.circuits, 1);
  assert.ok(t.surge > 11);
  assert.equal(t.kickback, true);
  const score = t.score;
  Object.assign(t.ball, { x: 151, y: 80, vx: 0, vy: -220 });
  stepTable(t, 1 / 30);
  assert.equal(t.spins, 1);
  assert.equal(t.score - score, 240);
  t.phase = 'ready';
  stepTable(t, 12);
  assert.deepEqual(t.down, [false, false, false]);
  assert.equal(t.surge, 0);
});

test('a pinball crossing the painted orbit mouth slowly or downhill stays on the lower playfield', () => {
  const t = newTable();
  t.phase = 'play';
  Object.assign(t.ball, { x: 23, y: 191, vx: 0, vy: 160 });
  stepTable(t, 1 / 35);
  assert.equal(t.phase, 'play');
  Object.assign(t.ball, { x: 23, y: 192.1, vx: 0, vy: -60 });
  stepTable(t, 1 / 60);
  assert.equal(t.phase, 'play');
});


test('the full right half flips during flight and the shooter lane only plunges a waiting ball', () => {
  for (const phase of ['play', 'rail', 'orbit']) {
    assert.equal(tableTouchControl(phase, 0.49), 0);
    assert.equal(tableTouchControl(phase, 0.5), 1);
    assert.equal(tableTouchControl(phase, 0.99), 1);
  }
  for (const phase of ['ready', 'charging']) {
    assert.equal(tableTouchControl(phase, 0.8), 1);
    assert.equal(tableTouchControl(phase, 0.99), 2);
  }
});
