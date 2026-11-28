import assert from 'node:assert/strict';
import test from 'node:test';
import { newPerimeter, installTower, refundTower, relocateTower, overdrive, sendWave, stepPerimeter } from '../src/arcade/prototypes/neon-perimeter.js';

function randomSeed(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function runWave(state) {
  assert.equal(sendWave(state), true);
  for (let i=0; i<3000 && state.phase==='wave'; i++) stepPerimeter(state, 1/60);
  assert.notEqual(state.phase,'wave');
}

test('Perimeter keeps construction, charge, relocation and overdrive within their wave budgets', () => {
  const state = newPerimeter(randomSeed(1));
  assert.equal(installTower(state,0,'pulse'),true);
  assert.equal(installTower(state,0,'arc'),false);
  assert.equal(refundTower(state,0),true);
  assert.equal(state.charge,6);
  for (const [socket,type] of [[0,'pulse'],[1,'pulse'],[4,'arc']]) {
    assert.equal(installTower(state,socket,type),true);
  }
  assert.equal(installTower(state,5,'arc'),false);
  assert.equal(relocateTower(state,0,2),false);
  assert.equal(sendWave(state),true);
  assert.equal(refundTower(state,4),false);
  assert.equal(relocateTower(state,0,2),false);
  assert.equal(overdrive(state,2),false);
  assert.equal(overdrive(state,4),true);
  assert.equal(overdrive(state,1),false);
  while (state.phase==='wave') stepPerimeter(state,1/60);
  assert.equal(state.phase,'build');
  assert.equal(state.charge,2);
  assert.equal(refundTower(state,0),false);
  assert.equal(relocateTower(state,0,1),false);
  assert.equal(relocateTower(state,0,2),true);
  assert.equal(relocateTower(state,2,3),false);
  assert.equal(refundTower(state,2),false);
});

test('generated boards bring traffic from four directions and support a complete three-type defense', () => {
  function play(seed, setup) {
    const state = newPerimeter(randomSeed(seed));
    const lanes = new Set();
    while (state.phase !== 'ended') {
      state.plan.forEach(unit => lanes.add(unit.lane));
      for (const [socket, type] of setup[state.wave] || []) installTower(state, socket, type);
      runWave(state);
    }
    return { state, lanes };
  }
  const winning = [[[4,'pulse'],[5,'pulse'],[8,'arc']],[[6,'arc']],[[7,'delay']],[[2,'pulse']]];
  const boards = new Set();
  const entrances = new Set();
  for (let seed = 0; seed < 36; seed++) {
    const { state, lanes } = play(seed, winning);
    assert.equal(state.outcome, 'complete');
    assert.equal(state.blocked + state.leaked, 45);
    assert.equal(lanes.size, 4);
    assert.equal(state.pads.length, 9);
    for (const route of state.tracks) assert.deepEqual(route.points.at(-1), state.core);
    boards.add(JSON.stringify(state.tracks[0].points));
    entrances.add(state.offset);
  }
  assert.equal(boards.size, 36);
  assert.equal(entrances.size, 4);
  const partial = [[[2,'pulse'],[8,'arc']],[[5,'pulse']],[[7,'arc']],[[6,'pulse']]];
  assert.equal(play(2, partial).state.outcome, 'partial');
  assert.equal(play(1, []).state.outcome, 'failed');
});

test('preparation clocks launch every wave automatically, including an undefended first wave', () => {
  const state = newPerimeter(randomSeed(4));
  const build = [[[4,'pulse'],[5,'pulse'],[8,'arc']],[[6,'arc']],[[7,'delay']],[[2,'pulse']]];
  for (const [wave, seconds] of [22, 14, 12, 10].entries()) {
    assert.equal(state.countdown, seconds);
    for (const [socket, type] of build[wave]) assert.equal(installTower(state,socket,type),true);
    stepPerimeter(state, seconds - .25);
    assert.equal(state.phase, 'build');
    stepPerimeter(state, .25);
    assert.equal(state.phase, 'wave');
    assert.equal(installTower(state, 0, 'delay'), false);
    while (state.phase === 'wave') stepPerimeter(state, 1/60);
  }
  assert.equal(state.outcome, 'complete');
  const empty = newPerimeter(randomSeed(4));
  stepPerimeter(empty, 23);
  assert.equal(empty.phase, 'wave');
  assert.ok(empty.active.length > 0);
});
