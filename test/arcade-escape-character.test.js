import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHazard, leap, shiftForm, startEscape, stepEscape, useFixture } from '../src/arcade/prototypes/escape-character.js';

function generator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function travel(s, dir, until, limit = 1200) {
  const rescues = s.rescues;
  for (let i = 0; i < limit && !until(); i++) stepEscape(s, 1 / 120, dir);
  assert.equal(s.rescues, rescues, 'Unexpected rescue in ' + s.room + ' ' + s.message);
  assert.ok(until(), 'Stalled in ' + s.room + ' at ' + s.x + ',' + s.y);
}
function reach(s, target) {
  const dir = Math.sign(target - s.x);
  travel(s, dir, () => (s.x - target)*dir >= 0);
}
function jumpTo(s, x) {
  leap(s); reach(s, x); travel(s, 0, () => s.grounded);
}
function door(s, dir) {
  const next = s.rooms[s.room][dir < 0 ? 'left' : 'right'];
  travel(s, dir, () => s.room === next);
}
function passMachine(s, dir) {
  const device = s.rooms[s.room].hazard;
  const distance = device.type === 'cart' ? 52 : 23;
  if ((device.x - s.x)*dir < 0) return;
  reach(s, device.x - dir*distance);
  if (device.type === 'cart') {
    // Let the trolley turn toward the character, then jump over its whole rail.
    travel(s, 0, () => (escapeHazard(s).x-device.x)*dir < -20);
    leap(s); reach(s, device.x + dir*distance); travel(s, 0, () => s.grounded);
  } else {
    const period = device.type === 'press' ? 4.4 : 3.1;
    travel(s, 0, () => (s.time+device.offset)%period < .1);
    reach(s, device.x + dir*distance);
  }
}
function cross(s, dir) {
  const room = s.rooms[s.room];
  if (room.hazard) passMachine(s, dir);
  if (s.room === 'tanks') {
    const lip = room.platforms[0][1], opposite = room.platforms[1][0];
    reach(s, dir > 0 ? lip-7 : opposite+7);
    jumpTo(s, dir > 0 ? opposite+7 : lip-7);
  }
  if (s.room === 'racks' && dir > 0) {
    for (const [left] of room.platforms.slice(1)) { reach(s, left-24); jumpTo(s, left+17); }
  }
  door(s,dir);
}
function recover(s) {
  while (s.room !== 'cradle') cross(s,1);
  passMachine(s,1); reach(s,210);
  assert.ok(s.unlocked);
}
function returnToLift(s) {
  reach(s,338); shiftForm(s); useFixture(s);
  assert.equal(s.room,'relay');
  while (s.room !== 'plenum') cross(s,-1);
  reach(s,214);
}

test('different maintenance layouts remain connected and beatable with full movement on the outward and return trips', () => {
  const orders = new Set(), gaps = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const s = startEscape(generator(seed*7919));
    orders.add(s.mapOrder.join('/')); gaps.add(s.rooms.tanks.platforms[0][1]);
    recover(s); returnToLift(s);
    if (seed % 2) {
      door(s,-1);
      shiftForm(s); // The core fits the grate, but only the shell can climb to the memory.
      for (const [,right] of s.rooms.vault.platforms.slice(1)) { reach(s, right+19); jumpTo(s,right-18); }
      reach(s,s.rooms.vault.memoryX);
      assert.ok(s.memory); cross(s,1); reach(s,214);
    }
    useFixture(s);
    assert.equal(s.ended, seed%2 ? 'complete' : 'partial');
  }
  assert.equal(orders.size,6);
  assert.ok(gaps.size>10);
});

test('the grates block an unmodified shell, and a core cannot reform under a grate', () => {
  const s = startEscape(generator(8));
  leap(s); for (let i=0; i<160; i++) stepEscape(s, 1/120,-1);
  assert.equal(s.room,'dock'); assert.equal(s.x,s.rooms.dock.grate[1]+6);
  shiftForm(s); assert.ok(!s.core);
  recover(s); reach(s,338); shiftForm(s); useFixture(s);
  while (s.room !== 'dock') cross(s,-1);
  passMachine(s,-1); reach(s,s.rooms.dock.grate[1]-1);
  shiftForm(s); assert.ok(s.core);
});

test('the trolley collision follows its visible motion, and a salvage restores the entrance', () => {
  const s = startEscape(generator(5));
  while (s.room !== 'relay') cross(s,1);
  const initial = escapeHazard(s).x;
  travel(s,0, () => Math.abs(escapeHazard(s).x-initial)>14);
  for (let i=0; i<480 && !s.rescues; i++) stepEscape(s,1/120,1);
  assert.equal(s.rescues,1); assert.equal(s.x,s.spawnX);
  assert.match(s.message,/trolley/);
});

test('a missed coolant jump can be retried and the long way home is also passable', () => {
  const s = startEscape(generator(31));
  while (s.room !== 'tanks') cross(s,1);
  for (let i=0; i<500 && !s.rescues; i++) stepEscape(s,1/120,1);
  assert.equal(s.rescues,1); assert.equal(s.x,s.spawnX);
  recover(s);
  while (s.room !== 'dock') cross(s,-1);
  shiftForm(s); cross(s,-1); reach(s,214); useFixture(s);
  assert.equal(s.ended,'partial');
});
