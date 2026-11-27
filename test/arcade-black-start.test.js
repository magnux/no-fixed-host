import assert from 'node:assert/strict';
import test from 'node:test';
import { launchBall, newTable, pullPlunger, stepTable } from '../src/arcade/prototypes/black-start.js';

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
  assert.deepEqual(partial.table.lit, [true, true, true]);
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
