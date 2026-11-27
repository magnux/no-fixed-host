import assert from 'node:assert/strict';
import test from 'node:test';
import { leap, shiftForm, startEscape, stepEscape, useFixture } from '../src/arcade/prototypes/escape-character.js';

function walkUntil(s, direction, predicate) {
  for (let i = 0; i < 800 && !predicate(); i++) stepEscape(s, 1 / 120, direction);
  assert.ok(predicate(), 'Route stalled in ' + s.room + ' at ' + s.x + ', ' + s.y);
}
const reach = (s, target) => {
  const dir = Math.sign(target - s.x);
  walkUntil(s, dir, () => dir * (s.x - target) >= 0);
};
const enter = (s, dir, name) => walkUntil(s, dir, () => s.room === name);
function jumpTo(s, x) {
  leap(s); reach(s, x); walkUntil(s, 0, () => s.grounded);
}
function getCoupling(s) {
  enter(s, 1, 'relay'); enter(s, 1, 'tanks');
  reach(s, 153); jumpTo(s, 226); enter(s, 1, 'racks');
  reach(s, 125); jumpTo(s, 163); jumpTo(s, 240); jumpTo(s, 317);
  enter(s, 1, 'cradle'); reach(s, 210); assert.ok(s.unlocked);
}
function reachLift(s) {
  reach(s, 338); shiftForm(s); useFixture(s); assert.equal(s.room, 'relay');
  enter(s, -1, 'dock'); enter(s, -1, 'plenum'); reach(s, 214);
}

test('the original gate stops the shell even while jumping, then the coupling opens the direct route', () => {
  const s = startEscape();
  leap(s); for (let i = 0; i < 180; i++) stepEscape(s, 1 / 120, -1);
  assert.equal(s.room, 'dock'); assert.equal(s.x, 109);
  shiftForm(s); assert.equal(s.core, false);
  getCoupling(s); reachLift(s); useFixture(s);
  assert.equal(s.ended, 'partial'); assert.equal(s.visited.size, 6);
});

test('the Echo Vault route requires reforming for the upper shelf and gives the second ending', () => {
  const s = startEscape();
  getCoupling(s); reachLift(s); enter(s, -1, 'vault');
  assert.equal(s.core, true); shiftForm(s);
  reach(s, 291); jumpTo(s, 268); jumpTo(s, 192); jumpTo(s, 117); reach(s, 88);
  assert.equal(s.memory, true);
  enter(s, 1, 'plenum'); reach(s, 214); useFixture(s);
  assert.equal(s.ended, 'complete'); assert.equal(s.visited.size, 7);
});

test('coolant recovery restores the entrance and the whole return route also works on foot', () => {
  const s = startEscape();
  enter(s, 1, 'relay'); enter(s, 1, 'tanks');
  walkUntil(s, 1, () => s.rescues === 1); assert.equal(s.x, s.spawnX);
  reach(s, 153); jumpTo(s, 226); enter(s, 1, 'racks');
  reach(s, 125); jumpTo(s, 163); jumpTo(s, 240); jumpTo(s, 317);
  enter(s, 1, 'cradle'); reach(s, 210);
  enter(s, -1, 'racks'); assert.equal(s.y, 104);
  enter(s, -1, 'tanks'); reach(s, 217); jumpTo(s, 149); enter(s, -1, 'relay');
  enter(s, -1, 'dock'); shiftForm(s); reach(s, 87); shiftForm(s);
  assert.ok(s.core); enter(s, -1, 'plenum'); reach(s, 214); useFixture(s);
  assert.equal(s.ended, 'partial');
});
