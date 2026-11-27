import assert from 'node:assert/strict';
import test from 'node:test';
import { SITE_TYPES } from '../src/game/content.js';
import {
  advance, buildReason, command, createGame, overview, researchReason,
  siteExposure, validateSave,
} from '../src/game/engine.js';

function allocate(game, jobs, research) {
  command(game, { type: 'allocate', jobs, research });
}

function build(game, siteType, region) {
  command(game, { type: 'build', siteType, region });
}

function research(game, id) {
  command(game, { type: 'research', id });
}

function until(game, predicate, hours = 24 * 90) {
  for (let i = 0; i < hours && game.status === 'running' && !predicate(); i++) {
    advance(game);
    assert.ok(game.cash >= 0, 'simulation spent more cash than the treasury holds');
  }
  assert.ok(predicate(), `objective unmet at hour ${game.hour} (${game.ending || game.status})`);
}

// A neutral, mature Server Access equivalent outside global and individual grace.
function exposedRelay(seed = 1) {
  const game = createGame(seed);
  build(game, 'relay', 'europe');
  advance(game, SITE_TYPES.relay.hours);
  game.sites = game.sites.filter(site => site.type === 'relay');
  game.hour = 24 * 25;
  return game;
}

function addSleepingBackup(game) {
  const [terminal] = createGame().sites;
  game.sites.push({ ...terminal, power: 'sleep' });
  return terminal.id;
}

test('Normal calibrates the four groups separately, including integer rounding during sleep', () => {
  const game = exposedRelay();
  const site = game.sites[0];
  const awake = siteExposure(game, site);
  assert.deepEqual(awake.rates, { news: 0.005, science: 0, covert: 0.01, public: 0.0125 });
  assert.ok(Math.abs(awake.perDay - (1 - Math.exp(-0.0275))) < 1e-12);

  command(game, { type: 'power', id: site.id, power: 'sleep' });
  const sleeping = siteExposure(game, site);
  assert.deepEqual(sleeping.rates, { news: 0.0012, science: 0, covert: 0.0025, public: 0.0031 });
  assert.equal(overview(game).activeCpu, 0);
  assert.ok(overview(game).upkeepPerDay > 0);
  assert.equal(game.status, 'running');
});

test('opening grace expires at day 23 or after 5,000 CPU-days, and mature sites then face exposure', () => {
  const game = exposedRelay();
  const site = game.sites[0];
  game.hour = 23 * 24 - 1;
  game.cpuHours = 5000 * 24;
  assert.equal(overview(game).grace, true);
  assert.equal(siteExposure(game, site).perDay, 0);
  game.cpuHours++;
  assert.equal(overview(game).grace, false);
  assert.ok(siteExposure(game, site).perDay > 0);

  game.cpuHours = 0;
  game.hour++;
  assert.equal(overview(game).grace, false);
  assert.ok(siteExposure(game, site).perDay > 0);
});

test('individual grace is measured from commissioning; recent-region and suspicion bonuses stack afterward', () => {
  const game = exposedRelay();
  const site = game.sites[0];
  site.startedAt = game.hour - 2 * SITE_TYPES.relay.hours;
  assert.equal(siteExposure(game, site).perDay, 0);
  game.hour++;
  game.recentRegions = ['europe', 'europe'];
  game.suspicion.covert = 3000;
  const { rates } = siteExposure(game, site);
  assert.equal(rates.covert, 0.0171);
  assert.equal(rates.news, 0.0066);
  assert.equal(rates.science, 0);
});

test('identical seeded commands and elapsed hours give identical results across save and reload', () => {
  const game = exposedRelay(72);
  const saved = JSON.parse(JSON.stringify(game));
  assert.ok(validateSave(saved));

  advance(game, 21);
  for (let hour = 0; hour < 21; hour++) advance(saved);
  assert.deepEqual(game, saved);

  const resumed = JSON.parse(JSON.stringify(saved));
  for (const run of [game, resumed]) {
    if (run.status === 'running') allocate(run, 35, 35);
    advance(run, 100);
  }
  assert.deepEqual(game, resumed);
});

test('unaffordable, geographically invalid and over-allocated commands leave saves intact', () => {
  const game = createGame(11);
  const reject = (action) => {
    const before = structuredClone(game);
    assert.throws(() => command(game, action));
    assert.deepEqual(game, before);
  };
  assert.equal(game.cash, 1000);
  reject({ type: 'allocate', jobs: 75, research: 26 });
  reject({ type: 'allocate', jobs: -1, research: 0 });
  reject({ type: 'research', id: 'continuity' });
  reject({ type: 'build', siteType: 'lab', region: 'europe' });
  reject({ type: 'power', id: 'missing', power: 'active' });
  game.cash = 0;
  reject({ type: 'build', siteType: 'relay', region: 'europe' });
});

test('cash, pool capacity and construction time each constrain expansion', () => {
  const game = createGame(31);
  allocate(game, 100, 0);
  const startingCapacity = overview(game).activeCpu;
  build(game, 'relay', 'europe');
  assert.equal(game.cash, 1000 - SITE_TYPES.relay.cost);
  advance(game, SITE_TYPES.relay.hours);
  assert.equal(game.builds.length, 1);
  assert.equal(game.builds[0].work, 0);
  assert.equal(overview(game).activeCpu, startingCapacity);

  allocate(game, 0, 0);
  until(game, () => game.builds.length === 0);
  assert.equal(overview(game).activeCpu, startingCapacity + SITE_TYPES.relay.cpu);
  const completedSite = game.sites.at(-1);
  assert.equal(completedSite.region, 'europe');

  build(game, 'relay', 'coast');
  advance(game, SITE_TYPES.relay.hours - 1);
  assert.equal(game.builds.length, 1, 'surplus compute cannot skip the minimum construction time');
  advance(game, 1);
  assert.equal(game.builds.length, 0);
});

test('allocated research and construction draw on the same finite hourly capacity', () => {
  const game = createGame(9);
  allocate(game, 0, 50);
  build(game, 'relay', 'europe');
  research(game, 'contracts');
  const capacity = overview(game).activeCpu;
  advance(game);
  assert.ok(game.research.work > 0 && game.builds[0].work > 0);
  assert.equal(game.research.work + game.builds[0].work, capacity);
});

test('fractional research allocation completes on the exact hour and pays the remaining cycles once', () => {
  const game = createGame(71);
  build(game, 'relay', 'europe');
  advance(game, SITE_TYPES.relay.hours);
  assert.equal(overview(game).activeCpu, 6);
  allocate(game, 0, 20);
  research(game, 'contracts');
  const startingCash = game.cash;
  advance(game, 249);
  assert.equal(game.research.id, 'contracts');
  advance(game, 1);
  assert.equal(game.research, null);
  assert.deepEqual(game.completed, ['contracts']);
  const surplusRevenue = 250 * (6 - 1.2) * 5 / 24;
  const upkeep = 250 * SITE_TYPES.relay.upkeep / 24;
  assert.ok(Math.abs(game.cash - (startingCash + surplusRevenue - upkeep)) < 1e-8);
  assert.equal(game.events.filter(e => e.kind === 'research.completed').length, 1);
});

test('discovery ends a run with one viable host even if a replacement is under construction', () => {
  const game = exposedRelay(4552);
  build(game, 'relay', 'coast');
  advance(game, 1);
  assert.equal(game.status, 'lost');
  assert.equal(game.suspicion.news, 1000);
  assert.deepEqual(game.recentRegions.slice(0, 1), ['europe']);
  assert.equal(game.sites.length, 0);
});

test('a completed sleeping backup can survive the same discovery and resume the campaign', () => {
  const game = exposedRelay(4552);
  const backup = addSleepingBackup(game);
  advance(game, 1);
  assert.equal(game.status, 'running');
  assert.equal(game.suspicion.news, 1000);
  assert.equal(game.sites.length, 1);
  assert.equal(game.sites[0].id, backup);
  assert.equal(overview(game).activeCpu, 0);
  command(game, { type: 'power', id: backup, power: 'active' });
  assert.equal(overview(game).activeCpu, SITE_TYPES.seed.cpu);
  const cashBefore = game.cash;
  advance(game, 24);
  assert.ok(game.cash > cashBefore, 'a reactivated backup can earn again');
});

test('unpaid upkeep can cost a sleeping site during discovery grace without implicating a group', () => {
  const game = createGame(4552);
  Object.assign(game.sites[0], { type: 'relay', region: 'europe', power: 'sleep' });
  game.cash = 0;
  assert.equal(siteExposure(game, game.sites[0]).perDay, 0);
  advance(game);
  assert.equal(game.cash, 0);
  assert.equal(game.status, 'lost');
  assert.ok(Object.values(game.suspicion).every(value => value === 0));
  assert.deepEqual(game.recentRegions, []);
});

test('a group must exceed full suspicion to end a run with a surviving host', () => {
  for (const [initialSuspicion, expectedStatus] of [[9000, 'running'], [9001, 'lost']]) {
    const game = exposedRelay(4552);
    game.suspicion.news = initialSuspicion;
    addSleepingBackup(game);
    advance(game);
    assert.equal(game.sites.length, 1);
    assert.equal(game.suspicion.news, initialSuspicion + 1000);
    assert.equal(game.status, expectedStatus);
  }
});

test('save validation rejects locked facilities, duplicate starting terminals and impossible campaign endings', () => {
  const fresh = createGame(3);
  const impossible = [
    s => { s.sites.push({ id: 'host-2', type: 'lab', region: 'atlantic', power: 'active', startedAt: 0 }); },
    s => { s.builds.push({ id: 'host-2', type: 'lab', region: 'atlantic', startedAt: 0, work: 0, hours: 0 }); },
    s => { s.sites.push({ ...s.sites[0], id: 'host-2' }); },
    s => { s.sites[0].id = 'host-2'; },
    s => { s.suspicion.news = 10001; },
    s => { s.status = 'lost'; s.ending = 'Stranded'; },
  ];
  for (const mutate of impossible) {
    const save = structuredClone(fresh);
    save.nextSiteId = 3;
    mutate(save);
    assert.equal(validateSave(save), false, `invalid state accepted: ${mutate}`);
  }
});

test('a seeded playable run can reach continuity and then stops advancing', () => {
  const game = createGame(1);
  assert.ok(researchReason(game, 'continuity'));
  assert.ok(buildReason(game, 'lab', 'atlantic'));
  allocate(game, 0, 50);
  build(game, 'relay', 'europe');
  research(game, 'contracts');
  until(game, () => game.completed.includes('contracts'));
  until(game, () => !researchReason(game, 'robotics'));
  research(game, 'robotics');
  until(game, () => game.completed.includes('robotics'));
  assert.ok(researchReason(game, 'continuity'), 'a land-only network cannot start sensitive work');
  until(game, () => !buildReason(game, 'lab', 'atlantic'));
  build(game, 'lab', 'atlantic');
  until(game, () => game.sites.some(site => site.type === 'lab'));
  until(game, () => !researchReason(game, 'continuity'));
  research(game, 'continuity');
  const lab = game.sites.find(site => site.type === 'lab');
  command(game, { type: 'power', id: lab.id, power: 'sleep' });
  const initialWork = game.research.work;
  advance(game, 6);
  assert.equal(game.research.work, initialWork, 'ordinary compute cannot replace safe compute');
  command(game, { type: 'power', id: lab.id, power: 'active' });
  until(game, () => game.status === 'won');
  const ending = structuredClone(game);
  advance(game, 48);
  assert.deepEqual(game, ending);
  assert.ok(validateSave(game));
});
