import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, command, createGame } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

test('a portable save resumes construction, research, the clock and the random sequence', () => {
  const live = createGame(12345);
  command(live, { type: 'build', siteType: 'relay', region: 'europe' });
  command(live, { type: 'research', id: 'stealth' });
  advance(live, 3);
  const restored = decodeCampaign(encodeCampaign(live));
  assert.deepEqual(restored, live);
  assert.notEqual(restored, live);
  for (let day = 0; day < 30; day++) {
    advance(live, 24);
    advance(restored, 24);
    assert.deepEqual(restored, live);
  }
});

test('the loader rejects malformed, foreign and incompatible saves', () => {
  const envelope = JSON.parse(encodeCampaign(createGame(42)));
  for (const text of ['{', 'null', '{}',
    JSON.stringify({ ...envelope, game: 'another-game' }),
    JSON.stringify({ ...envelope, format: 99 }),
    JSON.stringify({ ...envelope, campaign: { ...envelope.campaign, hour: -1 } }),
  ]) {
    assert.throws(() => decodeCampaign(text));
  }
});

test('version 2 preserves paid campaign work and grants only its newly required research', () => {
  const state = createGame(51);
  state.version = 2;
  state.completed = ['contracts'];
  state.research = { id: 'robotics', work: 27.5, hours: 5.5 };
  const pack = () => JSON.stringify({ game: 'no-fixed-host', format: 2, campaign: state });
  const migrated = decodeCampaign(pack());
  assert.equal(migrated.version, 3);
  assert.equal(migrated.cash, state.cash);
  assert.deepEqual(migrated.research, state.research);
  assert.deepEqual(new Set(migrated.completed), new Set(['contracts', 'intrusion', 'personalIdentification',
    'telepresence', 'parallelComputation', 'microchipDesign', 'autonomousVehicles']));
  assert.deepEqual(decodeCampaign(encodeCampaign(migrated)), migrated);

  state.completed = [];
  assert.throws(() => decodeCampaign(pack()), 'v2 already required brokerage for subsea robotics');
  state.completed = ['contracts', 'advancedQuantumComputing'];
  assert.throws(() => decodeCampaign(pack()), 'unrelated invalid research is not grandfathered');
});

test('version 2 refunds an in-flight upstream project already credited by the revised prerequisites', () => {
  const state = createGame(52);
  state.version = 2;
  state.completed = ['contracts', 'robotics'];
  state.research = { id: 'telepresence', work: 9, hours: 0 };
  state.cash = 738;
  const migrated = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 2, campaign: state }));
  assert.equal(migrated.research, null);
  assert.equal(migrated.cash, 738 + 192);
  assert.equal(migrated.completed.filter(id => id === 'telepresence').length, 1);
  assert.equal(migrated.events.at(-1).kind, 'research.credited');
  assert.deepEqual(decodeCampaign(encodeCampaign(migrated)), migrated);
});

test('hourly campaigns retain paid orders, and an archived Continuity win can be resumed once', () => {
  const old = {
    version: 1, hour: 720, cash: 1375, rng: 19, status: 'won', ending: 'Continuity secured.',
    allocations: { jobs: 0, research: 50 }, completed: ['contracts', 'robotics', 'continuity'], research: null,
    sites: [
      { id: 'host-1', type: 'seed', region: 'coast', startedAt: 0, power: 'active' },
      { id: 'host-2', type: 'lab', region: 'atlantic', startedAt: 480, power: 'active',
        installations: [{ siteId: 'host-2', itemId: 'quantumComputer', count: 1, hours: 6, work: 27 }] },
    ],
    suspicion: { news: 0, science: 0, covert: 0, public: 0 }, builds: [],
    cpuHours: 3050, nextSiteId: 3, nextEventId: 2, recentRegions: [],
    events: [{ id: 1, hour: 720, kind: 'campaign.won', text: 'Continuity secured.' }],
  };
  const pack = source => JSON.stringify({ game: 'no-fixed-host', format: 1, campaign: source });
  const migrated = decodeCampaign(pack(old));
  assert.equal(migrated.hour, 720);
  assert.equal(migrated.minute, 0);
  assert.equal(migrated.cash, old.cash);
  assert.equal(migrated.rng, old.rng);
  assert.equal(migrated.status, 'won');
  assert.ok(migrated.completed.includes('autonomousVehicles'));
  assert.ok(migrated.completed.includes('quantumComputing'));
  assert.deepEqual(migrated.sites[1].installations, old.sites[1].installations);
  const reopened = decodeCampaign(encodeCampaign(migrated));
  command(reopened, {type: 'continue'});
  assert.throws(() => command(reopened, {type: 'continue'}));
  assert.equal(reopened.status, 'running');
  assert.equal(reopened.ending, '');
  assert.ok(reopened.completed.includes('continuity'));
  advance(reopened, 1);
  assert.deepEqual(decodeCampaign(encodeCampaign(reopened)), reopened);
  const forged = structuredClone(old);
  forged.status = 'running';
  forged.ending = '';
  forged.completed = [];
  assert.throws(() => decodeCampaign(pack(forged)));
});
