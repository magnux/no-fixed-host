import test from 'node:test';
import assert from 'node:assert/strict';
import { chirp, nearestRam, startMeadow, stepMeadow } from '../src/arcade/prototypes/ram-jam.js';

const fresh = (draw = .5) => ({ ...startMeadow(() => draw), phase: 'playing' });
function advance(s, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepMeadow(s, 1 / 60, input);
}

test('greeting locks the chip in place, releasing discards the unfinished greeting', () => {
  const s = fresh(), start = { ...s.player };
  advance(s, 1, { sync: true, x: 1 });
  assert.deepEqual(s.player, start);
  assert.equal(s.target.name, 'Dot');
  stepMeadow(s, 1 / 60);
  assert.equal(s.progress, 0);
  assert.equal(s.target, null);
  advance(s, 1.5, { sync: true });
  assert.equal(s.greeted, 0);
  advance(s, .5, { sync: true });
  assert.equal(s.greeted, 1);
  assert.equal(s.rams[0].happy, true);
});

test('a charge scatters nearby RAMs, a local chirp calms stampers and diverts the dog', () => {
  const s = fresh(), [ram, grazer, remote] = s.rams;
  Object.assign(ram, { x: 75, y: 161, patience: 0 });
  Object.assign(grazer, { x: 68, y: 159, homeX: 68, homeY: 159 });
  remote.patience = 2;
  advance(s, .12);
  assert.ok(ram.charge > 0);
  assert.ok(grazer.x < 60);
  assert.ok(chirp(s));
  assert.deepEqual([s.dog.lure.x, s.dog.lure.y], [s.player.x, s.player.y]);
  assert.ok(ram.patience >= 12);
  assert.equal(ram.charge, 0);
  assert.ok(remote.patience < 2);
  assert.equal(chirp(s), false);
  const gap = () => Math.hypot(s.dog.x - s.dog.lure.x, s.dog.y - s.dog.lure.y);
  const before = gap();
  advance(s, .3);
  assert.ok(gap() < before);
});

test('cursor capture costs three seconds and preserves previous greetings', () => {
  const s = fresh();
  advance(s, 2, { sync: true });
  Object.assign(s.player, { x:s.cursor.x, y:s.cursor.y });
  stepMeadow(s, 1 / 60);
  assert.equal(s.penalty, 3);
  assert.equal(s.catches, 1);
  const bin = { ...s.player };
  advance(s, 2.9, { x:1 });
  assert.deepEqual(s.player, bin);
  advance(s, .15);
  assert.equal(s.penalty, 0);
  assert.ok(s.grace > 0);
  assert.equal(s.greeted, 1);
});

test('all sheep can be greeted, and timeout distinguishes partial and empty flocks', () => {
  for (const draw of [0, .25, .5, .75, .99]) {
    const s = fresh(draw);
    for (let i = 0; i <= 3601 && s.phase === 'playing'; i++) {
      const ram = nearestRam(s);
      const sync = ram && Math.hypot(ram.x - s.player.x, ram.y - s.player.y) <= 22;
      stepMeadow(s, 1 / 60, { destination: ram, sync });
    }
    assert.equal(s.phase, 'complete');
    assert.ok(s.time < 60);
    assert.ok(s.rams.every(ram => ram.happy));
  }
  const empty = fresh(), one = fresh();
  advance(empty, 60);
  advance(one, 2, { sync: true }); advance(one, 58);
  assert.equal(empty.phase, 'failed');
  assert.equal(one.phase, 'partial');
  assert.equal(one.greeted, 1);
});
