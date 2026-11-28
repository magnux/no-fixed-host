import assert from 'node:assert/strict';
import test from 'node:test';
import { AVATAR_FORMS, AVATAR_PARTS, avatarModel } from '../src/game/avatar.js';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { REGIONS, TECHS } from '../src/game/content.js';
import { markLostRegions } from '../src/game/facility-operations.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const firstRollZero = 634785765;
const regionLight = (id, status = 'online') => ({ id, status });

test('forms depend on completed research and survive a portable save', () => {
  const state = createGame(18);
  command(state, { type: 'assign-research', id: 'intrusion', cpu: 1 });
  assert.deepEqual(avatarModel(state), { form: 'terminal', parts: [], regions: [regionLight(state.sites[0].region)] });
  advanceMinutes(state, 360 * 60);
  assert.equal(avatarModel(state).form, 'face');
  state.completed.push('telepresence');
  assert.equal(avatarModel(decodeCampaign(encodeCampaign(state))).form, 'presence');
  state.completed = ['telepresence'];
  assert.equal(avatarModel(state).form, 'presence', 'Telepresence can be the first completed project');
});

test('regions count equipped hosts once, prefer online over sleeping, and follow refits', () => {
  const state = createGame(18);
  state.sites[0].region = 'coast';
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
    state.sites[0].region = 'coast';
    command(state, { type: 'build', siteType: 'relay', region: 'europe' });
    advanceMinutes(state, 1);
    state.rng = firstRollZero;
    if (kind === 'site.discovered') state.hour = 25 * 24;
    else {
      command(state, { type: 'power', id: 'host-1', power: 'sleep' });
      command(state, { type: 'power', id: 'host-2', power: 'sleep' });
      // One minute before the first $5/day relay installment at 04:48 UTC.
      state.hour = 0;
      state.minute = 27;
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


test('research determines the silhouette and independent parts regardless of completion order', () => {
  const state = createGame(18);
  for (const stage of AVATAR_FORMS.filter(stage => stage.research)) {
    assert.ok(TECHS[stage.research]);
    state.completed = [stage.research];
    assert.equal(avatarModel(state).form, stage.id);
  }
  for (const part of AVATAR_PARTS) {
    assert.ok(TECHS[part.research]);
    state.completed = [part.research];
    assert.deepEqual(avatarModel(state).parts, [part.id]);
  }
  state.completed = ['simulacra', 'telepresence', 'voiceSynthesis', 'autonomousVehicles', 'clusterNetworking'];
  const portrait = avatarModel(state);
  assert.equal(portrait.form, 'simulacrum');
  assert.deepEqual(portrait.parts, ['antennae', 'voice']);
  state.completed.reverse();
  assert.deepEqual(avatarModel(state), portrait);
  state.completed = Object.keys(TECHS).filter(id => id !== 'apotheosis');
  assert.deepEqual(avatarModel(decodeCampaign(encodeCampaign(state))), avatarModel(state));
});

test('all catalog regions can light independently and lose their signal', () => {
  const state = createGame(18);
  const ids = Object.keys(REGIONS);
  state.sites = ids.map((region, index) => ({...state.sites[0], region, id: 'host-' + (index + 1)}));
  const last = state.sites.at(-1);
  last.power = 'sleep';
  assert.deepEqual(avatarModel(state).regions, ids.map(id => regionLight(id, id === last.region ? 'sleeping' : 'online')));
  state.sites.pop();
  assert.equal(avatarModel(state).regions.length, ids.length - 1);
});
