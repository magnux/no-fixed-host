import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceMinutes, buildReason, command, createGame, researchReason, validateSave } from '../src/game/engine.js';
import { TECHS } from '../src/game/content.js';
import { copyToSandbox } from '../src/game/devtools.js';

test('a fresh network can unlock, equip and use every research safety tier through Apotheosis', () => {
  // Accelerate elapsed work and funding only. The real commands still enforce every
  // prerequisite, region gate, available processor and viable-host check.
  const state = copyToSandbox(createGame(29));
  command(state, {type:'developer', operation:'funds', amount:2_000_000_000});
  command(state, {type:'developer', operation:'detection', enabled:false});
  const tickReady = operation => {
    command(state, {type:'developer', operation});
    advanceMinutes(state);
    assert.ok(validateSave(state));
  };
  const destinations = new Map([
    ['atlantic','lab'], ['orbit','orbitalServer'], ['moon','lunarFacility'],
    ['farReaches','scientificOutpost'], ['transdimensional','realityBubble'],
  ]);
  const topics = Object.keys(TECHS).filter(key => key !== 'apotheosis');
  while (topics.length || destinations.size) {
    let changed = false;
    for (const [region, siteType] of destinations) {
      if (buildReason(state, siteType, region)) continue;
      command(state, {type:'build', siteType, region});
      const siteId = state.builds.at(-1).id;
      tickReady('construction');
      command(state, {type:'install', siteId, itemId:'server', count:1});
      tickReady('construction');
      destinations.delete(region);
      changed = true;
    }
    for (const id of [...topics]) {
      if (researchReason(state, id)) continue;
      command(state, {type:'assign-research', id, cpu:1});
      tickReady('research');
      assert.ok(state.completed.includes(id), id);
      topics.splice(topics.indexOf(id),1);
      changed = true;
    }
    assert.ok(changed, 'Unreachable: ' + [...topics, ...destinations.keys()].join(', '));
  }
  command(state, {type:'assign-research', id:'apotheosis', cpu:1});
  tickReady('research');
  assert.equal(state.status, 'won');
  assert.equal(state.completed.length, Object.keys(TECHS).length);
  command(state, {type:'free-play'});
  advanceMinutes(state, 1440);
  assert.ok(state.freePlay && validateSave(state));
});
