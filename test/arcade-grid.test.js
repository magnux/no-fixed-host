import assert from 'node:assert/strict';
import test from 'node:test';
import { newHide, stepHide } from '../src/arcade/prototypes/hide.js';
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

test('Hide protects either host before the search window closes', () => {
  for (const offsets of [[0, 0, 0], [0, 4, 0], [3, 6, 7], [5, 7, 7]]) {
    for (const target of [0, 1]) {
      assert.ok(reachableHide({ ...newHide(), offsets, target }) <= 22);
    }
  }
});

test('Hide keeps time still for walls and distinguishes patrol contact from waiting safely', () => {
  const state = { ...newHide(() => 0), target: 0 };
  assert.equal(stepHide(state, -1, 0), state);
  assert.equal(stepHide(state, 0, 0).turn, 1);
  assert.equal(stepHide(state, 1, 0).outcome, 'caught'); // Occupied this turn.
  assert.equal(stepHide({ ...state, offsets: [5, 0, 0] }, 1, 0).outcome, 'caught'); // Next patrol cell.
  assert.equal(stepHide({ ...state, turn: 21 }, 0, 0).outcome, 'expired');
});

test('Soundings offers two reachable anchorages on every chart with battery to spare for sonar', () => {
  const routes = [
    [['East','East'], ['East','East','South','East','East','South','East','East','East']],
    [['East','East','North'], ['East','East','North','East','East','East','East','East']],
    [['East','South','East'], ['North','North','East','East','East','South','East','East','South','East','East']],
  ];
  for (const [chart, choices] of routes.entries()) {
    for (const [i, path] of choices.entries()) {
      let state = newSoundings(chart);
      for (const cmd of ['ping', ...path, 'beacon']) state = dive(state,cmd);
      assert.equal(state.outcome, i === 0 ? 'shelf' : 'trench');
    }
  }
});

test('Soundings spends battery on exploration, prevents reef collisions and allows a final beacon on empty', () => {
  const start = newSoundings(0);
  const sonar = dive(start,'ping');
  assert.equal(sonar.charge, start.charge-2);
  assert.ok(sonar.seen.size > start.seen.size);
  assert.equal(dive(start,'West'),start);
  assert.equal(dive(start,'beacon'),start);
  const north = dive(start,'North');
  assert.equal(dive(dive(north,'East'),'East').x, 1); // Reef at C2.
  const last = dive({ ...dive(start,'East'), charge: 1 },'East');
  assert.equal(last.charge,0);
  assert.equal(dive(last,'beacon').outcome,'shelf');
  assert.equal(dive({ ...start, charge: 1 },'North').outcome,'empty');
});
