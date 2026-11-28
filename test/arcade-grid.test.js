import assert from 'node:assert/strict';
import test from 'node:test';
import { hidePatrols, newHide, stepHide } from '../src/arcade/prototypes/hide.js';
import { newSoundings, dive } from '../src/arcade/prototypes/soundings.js';

function reachableHide(state) {
  const moves = [[0, 1], [1, 0], [0, 0], [0, -1], [-1, 0]];
  const queue = [state];
  const visited = new Set();
  for (let i = 0; i < queue.length; i++) {
    for (const move of moves) {
      const next = stepHide(queue[i], ...move);
      if (next.outcome === 'complete') return next.turn;
      const key = [next.pos, next.turn].join('/');
      if (!next.outcome && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return Infinity;
}

test('Hide allows either host for every combination of skimmer and iris starting phases', () => {
  for (let skimmer = 0; skimmer < 8; skimmer++) {
    for (let iris = 0; iris < 8; iris++) {
      for (const target of [0, 1]) {
        assert.ok(reachableHide({ ...newHide(), offsets: [skimmer, iris], target }) <= 22);
      }
    }
  }
});

test('Hide freezes the exact detecting field and allows crossing a vacated position', () => {
  const start = { ...newHide(() => 0), target: 0 };
  const right = s => stepHide(s, 1, 0), left = s => stepHide(s, -1, 0);
  assert.equal(left(start), start);
  const contact = right(right(start));
  assert.equal(contact.culprit, 'Skimmer');
  assert.equal(contact.beat, 1); // C3 is lit while the skimmer is still on C2.
  assert.deepEqual(hidePatrols(contact)[0].lit.at(-1), contact.pos);
  const cleared = right(right(left(right(start))));
  assert.deepEqual(cleared.pos, contact.pos);
  assert.equal(cleared.outcome, '');
  assert.equal(stepHide({ ...start, turn: 21 }, 0, 0).outcome, 'expired');
});

test('the rotating iris respects walls, and a sweep catches a waiting player on its own frame', () => {
  const start = { ...newHide(() => 0), target: 0, pos: [6, 3], beat: 1 };
  const sweep = stepHide(start, 0, 0);
  assert.equal(sweep.culprit, 'Iris turret');
  assert.equal(sweep.beat, 2);
  assert.ok(hidePatrols(sweep)[1].lit.some(p => p[0] === 6 && p[1] === 3));
  // D3 closes the western line of sight from G3.
  assert.deepEqual(hidePatrols(start, 4)[1].lit, [[6,2], [5,2], [4,2]]);
});

const diveControls = { N: 'North', E: 'East', S: 'South', W: 'West', x: 'work', b: 'beacon', p: 'ping' };
function followDive(chart, commands) {
  return [...commands].reduce((sub, key) => dive(sub, diveControls[key]), newSoundings(chart));
}

test('all three Soundings charts have full trench expeditions through two wrecks and an air bell', () => {
  const routes = ['NNExSEEEExNEExESESEb', 'NNEExSEEExEEExSSEEEb', 'NEExNEEExEEEExSSEEb'];
  for (const [chart, route] of routes.entries()) {
    const sub = followDive(chart, route);
    assert.equal(sub.outcome, 'trench');
    assert.equal(sub.salvage, 2);
    assert.equal(sub.bells.size, 1);
    assert.ok(sub.hull > 0 && sub.oxygen > 0);
  }
});

test('Soundings requires physical salvage and pressure protection, and bells service a single visit', () => {
  const start = newSoundings(0);
  assert.equal(dive(start, 'beacon'), start);
  assert.equal(dive(start, 'West'), start);
  const collar = followDive(0, 'NNEx');
  assert.equal(collar.salvage, 1);
  assert.equal(dive(collar, 'work'), collar);
  const shelf = followDive(0, 'NNExSSSEb');
  assert.equal(shelf.outcome, 'shelf');
  const deepEdge = { ...start, x: 6, y: 0 };
  assert.equal(dive(deepEdge, 'East'), deepEdge);
  assert.equal(dive({ ...collar, x: 6, y: 0 }, 'East').x, 7);
  const bell = followDive(0, 'NNExSEEEEx');
  assert.equal(bell.oxygen, 16);
  assert.equal(dive(bell, 'work'), bell);
  assert.equal(dive({ ...start, oxygen: 1 }, 'wait').outcome, 'empty');
});

test('active sonar reveals terrain but makes an eel pursue the ping point; contact damages the hull', () => {
  const sub = newSoundings(0);
  const nearby = { ...sub, x: 5, y: 1, eel: { x: 7, y: 1 }, hull: 2 };
  const ping = dive(nearby, 'ping');
  assert.equal(ping.charge, 3);
  assert.ok(ping.seen.size > nearby.seen.size);
  assert.equal(ping.eel.x, 6);
  const hit = dive(ping, 'wait');
  assert.equal(hit.hull, 1);
  assert.equal(hit.grace, 3);
  assert.equal(dive(hit, 'wait').hull, 1);
  assert.equal(dive({ ...nearby, hull: 1, eel: { x: 6, y: 1 } }, 'ping').outcome, 'breach');
});
