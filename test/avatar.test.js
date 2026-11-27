import assert from 'node:assert/strict';
import test from 'node:test';
import { avatarModel } from '../src/game/avatar.js';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { markLostRegions } from '../src/game/facility-operations.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const firstRollZero = 634785765;
const regionLight = (id, status = 'online') => ({ id, status });

test('forms depend on completed research and survive a portable save', () => {
  const state = createGame(18);
  command(state, { type: 'assign-research', id: 'intrusion', cpu: 1 });
  assert.deepEqual(avatarModel(state), { form: 'terminal', regions: [regionLight('coast')] });
  advanceMinutes(state, 360 * 60);
  assert.equal(avatarModel(state).form, 'face');
  state.completed.push('telepresence');
  assert.equal(avatarModel(decodeCampaign(encodeCampaign(state))).form, 'presence');
  state.completed = ['telepresence'];
  assert.equal(avatarModel(state).form, 'presence', 'Telepresence can be the first completed project');
});

test('regions count equipped hosts once, prefer online over sleeping, and follow refits', () => {
  const state = createGame(18);
  state.completed = ['intrusion', 'personalIdentification'];
  state.cash = 20000;
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast')]);
  advanceMinutes(state, 1440);
  const store = state.sites.find(site => site.type === 'storageUnit');
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast')]);
  command(state, { type: 'install', siteId: store.id, itemId: 'pc' });
  advanceMinutes(state, 1440);
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast'), regionLight('europe')]);
  command(state, { type: 'power', id: store.id, power: 'sleep' });
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast'), regionLight('europe', 'sleeping')]);
  command(state, { type: 'install', siteId: store.id, itemId: 'server' });
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast')]);
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  advanceMinutes(state, 1);
  const relay = state.sites.find(site => site.type === 'relay');
  command(state, { type: 'dismantle', id: relay.id });
  assert.equal(state.events.at(-1).regionLost, undefined, 'the refitting bank physically remains in Europe');
  advanceMinutes(state, 2880);
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  advanceMinutes(state, 1);
  command(state, { type: 'power', id: store.id, power: 'sleep' });
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast'), regionLight('europe')]);
  assert.ok(state.events.every(event => event.regionLost === undefined));
  command(state, { type: 'dismantle', id: state.sites.find(site => site.type === 'relay').id });
  assert.deepEqual(avatarModel(state).regions, [regionLight('coast'), regionLight('europe', 'sleeping')]);
  command(state, { type: 'dismantle', id: store.id });
  const reports = decodeCampaign(encodeCampaign(state)).events.filter(event => event.regionLost);
  assert.deepEqual(reports.map(event => [event.kind, event.region]), [['site.dismantled', 'europe']]);
});

test('simultaneous losses mark only the final physical removal in each lost region', () => {
  const fixed = (region, power = 'active') => ({ type: 'relay', power, region });
  const first = {}, second = {}, unfinished = {}, empty = {}, retained = {}, other = {};
  markLostRegions([fixed('africa', 'sleep'), { type: 'storageUnit', power: 'active', region: 'asia' }], [
    [fixed('europe'), first], [fixed('asia'), other], [fixed('europe', 'sleep'), second],
    [{ type: 'cluster', region: 'europe' }, unfinished], [fixed('africa'), retained],
    [{ type: 'storageUnit', power: 'active', region: 'europe' }, empty],
  ]);
  assert.deepEqual([first, other, second, unfinished, retained, empty],
    [{}, { regionLost: true }, { regionLost: true }, {}, {}, {}]);
});

test('discovery and maintenance losses leave the correct cue after batched time and reload', () => {
  for (const [kind, targetRegion] of [['site.discovered', 'coast'], ['site.failed', 'europe']]) {
    const state = createGame(18);
    command(state, { type: 'build', siteType: 'relay', region: 'europe' });
    advanceMinutes(state, 1);
    state.rng = firstRollZero;
    if (kind === 'site.discovered') state.hour = 25 * 24;
    else {
      command(state, { type: 'power', id: 'host-1', power: 'sleep' });
      command(state, { type: 'power', id: 'host-2', power: 'sleep' });
      state.hour = 4;
      state.minute = 47;
      state.cash = 0;
    }
    const replay = structuredClone(state);
    advanceMinutes(state, 5);
    for (let i = 0; i < 5; i++) advanceMinutes(replay, 1);
    assert.deepEqual(replay, state);
    const reports = decodeCampaign(encodeCampaign(state)).events.filter(event => event.regionLost);
    assert.deepEqual(reports.map(event => [event.kind, event.region]), [[kind, targetRegion]]);
  }
});
