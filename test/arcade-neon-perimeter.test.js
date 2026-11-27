import assert from 'node:assert/strict';
import test from 'node:test';
import { newPerimeter, installTower, refundTower, relocateTower, overdrive, sendWave, stepPerimeter } from '../src/arcade/prototypes/neon-perimeter.js';

function runWave(state) {
  assert.equal(sendWave(state), true);
  for (let i=0; i<3000 && state.phase==='wave'; i++) stepPerimeter(state, 1/60);
  assert.notEqual(state.phase,'wave');
}

test('Perimeter keeps construction, charge, relocation and overdrive within their wave budgets', () => {
  const state = newPerimeter(false);
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

test('both mirrored formations have a complete three-type build, and missed units can cause partial or failed runs', () => {
  function play(mirror, setup) {
    const state=newPerimeter(mirror);
    while (state.phase!=='ended') {
      for (const [socket,type] of setup[state.wave] || []) installTower(state,socket,type);
      runWave(state);
    }
    return state;
  }
  const winning = [[[0,'pulse'],[1,'pulse'],[4,'arc']],[[5,'pulse']],[[2,'delay']],[[3,'arc']]];
  for (const mirror of [false,true]) {
    const state=play(mirror,winning);
    assert.equal(state.outcome,'complete');
    assert.equal(state.blocked+state.leaked,45);
  }
  assert.equal(play(false,[[[4,'pulse'],[5,'arc']],[[2,'pulse']],[[3,'arc']],[[0,'delay']]]).outcome,'partial');
  assert.equal(play(false,[]).outcome,'failed');
});
