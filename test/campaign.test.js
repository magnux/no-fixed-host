import assert from 'node:assert/strict';
import test from 'node:test';
import { regionalSpec } from '../src/game/geography.js';
import { SITE_TYPES, TECHS } from '../src/game/content.js';
import {
  advance, advanceMinutes, buildReason, campaignMinutes, command, createGame, overview, researchReason,
  siteExposure, validateSave,
} from '../src/game/engine.js';

// The next generator value for this seed is zero. Any positive interval risk triggers.
const firstRollZero = 634785765;

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
  delete game.regionSeed; // Neutral legacy geography isolates baseline Normal probabilities.
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
  assert.equal(game.cash, 1000 - regionalSpec(game, 'europe', SITE_TYPES.relay).cost);
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
  advanceMinutes(game, Math.round(game.builds[0].laborHours * 60) - 1);
  assert.equal(game.builds.length, 1, 'surplus compute cannot skip the minimum construction time');
  advanceMinutes(game, 1);
  assert.equal(game.builds.length, 0);
});

test('allocated research and construction draw on the same finite hourly capacity', () => {
  const game = createGame(9);
  allocate(game, 0, 50);
  build(game, 'relay', 'europe');
  research(game, 'stealth');
  const capacity = overview(game).activeCpu;
  advance(game);
  assert.ok(game.research.work > 0 && game.builds[0].work > 0);
  assert.equal(game.research.work + game.builds[0].work, capacity);
});

test('fractional research allocation completes on the exact hour and pays the remaining cycles once', () => {
  const game = createGame(71);
  game.completed.push('intrusion', 'personalIdentification');
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
  assert.deepEqual(game.completed, ['intrusion', 'personalIdentification', 'contracts']);
  const surplusRevenue = 250 * (6 - 1.2) * 20 / 24;
  const upkeep = Math.floor(250 * SITE_TYPES.relay.upkeep / 24);
  assert.ok(Math.abs(game.cash - (startingCash + surplusRevenue - upkeep)) < 1e-8);
  assert.equal(game.events.filter(e => e.kind === 'research.completed').length, 1);
});

test('discovery ends a run with one viable host even if a replacement is under construction', () => {
  const game = exposedRelay(firstRollZero);
  build(game, 'relay', 'coast');
  advance(game, 1);
  assert.equal(game.status, 'lost');
  assert.equal(game.suspicion.news, 1000);
  assert.deepEqual(game.recentRegions.slice(0, 1), ['europe']);
  assert.equal(game.sites.length, 0);
});

test('a completed sleeping backup can survive the same discovery and resume the campaign', () => {
  const game = exposedRelay(firstRollZero);
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
  const game = createGame(firstRollZero);
  delete game.regionSeed; // A neutral relay owes its first $1 installment after 288 minutes.
  game.sites = [{ id: 'host-2', type: 'relay', region: 'europe', startedAt: 0, power: 'sleep' }];
  game.nextSiteId = 3;
  game.cash = 0;
  assert.equal(siteExposure(game, game.sites[0]).perDay, 0);
  advanceMinutes(game, 287);
  assert.equal(game.status, 'running');
  assert.equal(game.rng, firstRollZero);
  advanceMinutes(game);
  assert.equal(game.cash, 0);
  assert.equal(game.status, 'lost');
  assert.ok(Object.values(game.suspicion).every(value => value === 0));
  assert.deepEqual(game.recentRegions, []);
});

test('aggregate upkeep can fall due before either site has an individual bill', () => {
  const s = createGame(firstRollZero);
  delete s.regionSeed;
  s.sites[0].power = 'sleep';
  for (const id of ['host-2', 'host-3']) {
    s.sites.push({ id, type: 'relay', region: 'europe', power: 'sleep', startedAt: 0 });
  }
  s.nextSiteId = 4;
  const solvent = structuredClone(s);
  solvent.cash = 1;
  advanceMinutes(solvent, 144); // The two relays share a $10/day network invoice.
  assert.equal(solvent.cash, 0);
  assert.equal(solvent.sites.length, 3);
  assert.equal(solvent.rng, firstRollZero);
  s.cash = 0;
  advanceMinutes(s, 287); // Even without cash, neither $5/day relay owed its own installment at 02:24.
  assert.equal(s.sites.length, 3);
  assert.equal(s.rng, firstRollZero);
  advanceMinutes(s);
  assert.deepEqual(s.sites.map(site => site.id), ['host-1', 'host-3']);
  assert.equal(s.status, 'running');
  assert.ok(validateSave(s));
});

test('explicit or spare job income can cover this minute’s due installment before a default roll', () => {
  for (const jobs of [0, 100]) {
    const s = createGame(firstRollZero);
    delete s.regionSeed;
    s.sites.push({ id: 'host-2', type: 'relay', region: 'europe', power: 'active', startedAt: 0 });
    s.nextSiteId = 3;
    s.hour = 4;
    s.minute = 47;
    s.cash = 1 - 30 / 1440; // Six active CPUs at $5 per CPU-day cover the remainder.
    allocate(s, jobs, 0);
    advanceMinutes(s);
    assert.equal(s.cash, 0);
    assert.equal(s.sites.length, 2);
    assert.equal(s.rng, firstRollZero);
    assert.ok(validateSave(s));
  }
});

test('an unfunded CPU upkeep bill can fail a sleeping capsule on a minute with no cash installment', () => {
  const s = createGame(firstRollZero);
  s.sites[0].power = 'sleep';
  s.sites.push({ id: 'host-2', type: 'capsule', region: 'antarctic', startedAt: 0, power: 'sleep' });
  s.nextSiteId = 3;
  advanceMinutes(s);
  assert.deepEqual(s.sites.map(site => site.id), ['host-1']);
  assert.equal(s.events.at(-1).kind, 'site.failed');
  assert.equal(s.cash, 1000);
  assert.equal(s.status, 'running');
});

test('a group must exceed full suspicion to end a run with a surviving host', () => {
  for (const [initialSuspicion, expectedStatus] of [[9000, 'running'], [9001, 'lost']]) {
    const game = exposedRelay(firstRollZero);
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

test('a seeded playable opening can establish ocean Continuity and keep expanding', () => {
  const game = createGame(1);
  assert.ok(researchReason(game, 'continuity'));
  assert.ok(buildReason(game, 'lab', 'atlantic'));
  allocate(game, 0, 50);
  build(game, 'relay', 'europe');
  build(game, 'relay', 'coast');
  build(game, 'relay', 'africa');
  for (const id of ['intrusion', 'personalIdentification', 'contracts', 'telepresence', 'parallelComputation',
    'microchipDesign', 'autonomousVehicles', 'robotics']) {
    until(game, () => !researchReason(game, id));
    research(game, id);
    until(game, () => game.completed.includes(id));
  }
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
  until(game, () => game.completed.includes('continuity'));
  assert.equal(game.status, 'running');
  advanceMinutes(game, 1);
  until(game, () => Boolean(game.lastDiscovery));
  assert.equal(game.status, 'running');
  assert.ok(game.sites.every(site => site.id !== game.lastDiscovery.siteId));
  assert.ok(game.events.some(event => event.kind === 'news.bulletin'));
  assert.ok(validateSave(game));
});

test('finishing Apotheosis in an equipped tier-4 host ends the simulation', () => {
  const game = createGame(18);
  game.cash = 50000;
  game.completed = Object.keys(TECHS).filter(id => id !== 'apotheosis');
  assert.match(researchReason(game, 'apotheosis'), /safety tier 4/);
  game.sites.push({ id: 'host-2', type: 'realityBubble', region: 'transdimensional', startedAt: 0,
    power: 'active', equipment: { cpu: { itemId: 'quantumComputer3', count: 50 },
      network: null, reactor: null, security: null } });
  game.nextSiteId++;
  research(game, 'apotheosis');
  advance(game, 1);
  assert.equal(game.status, 'won');
  assert.ok(game.completed.includes('apotheosis'));
  const ending = structuredClone(game);
  advance(game, 48);
  assert.deepEqual(game, ending);
  assert.ok(validateSave(game));
});

test('work, construction, income, and timestamps advance in real game minutes', () => {
  const s = createGame();
  advanceMinutes(s, 13);
  assert.equal(campaignMinutes(s), 13);
  assert.ok(s.cash > 1000);
  build(s, 'relay', 'europe');
  research(s, 'stealth');
  assert.equal(s.builds[0].startedAt, 13 / 60);
  assert.equal(s.events.at(-1).minute, 13);
  advanceMinutes(s, 1);
  assert.equal(s.builds[0].hours, 1 / 60);
  assert.equal(s.builds[0].work, 1 / 60);
  assert.equal(s.research.work, 1 / 60);
  assert.ok(validateSave(s));

  const stepped = structuredClone(s);
  const batched = structuredClone(s);
  for (let i = 0; i < 24 * 60; i++) advanceMinutes(stepped, 1);
  advanceMinutes(batched, 6 * 60);
  advanceMinutes(batched, 18 * 60);
  assert.deepEqual(stepped, batched);
  assert.equal(stepped.minute, 14);
  assert.equal(stepped.hour, 24);
});

test('interactive day speed stops at the incident minute, preserving it for acknowledgement', () => {
  const s = exposedRelay(firstRollZero);
  addSleepingBackup(s);
  const before = campaignMinutes(s);
  const copy = structuredClone(s);
  advanceMinutes(s, 1440, {stopOnDiscovery: true});
  assert.equal(campaignMinutes(s), before + 1);
  assert.equal(s.lastDiscovery.minute, 1);
  assert.equal(s.lastDiscovery.group, 'news');
  assert.equal(s.lastDiscovery.siteId, 'host-2');
  assert.ok(validateSave(s));
  advanceMinutes(copy, 1);
  assert.deepEqual(s, copy);
  command(s, {type: 'acknowledge-discovery', id: s.lastDiscovery.id});
  assert.equal(s.dismissedDiscoveryId, s.lastDiscovery.id);
  advanceMinutes(s, 3, {stopOnDiscovery: true});
  assert.equal(campaignMinutes(s), before + 4);
});

test('labor, paid work, interest, daily income and suspicion research affect the live simulation', () => {
  const s = createGame();
  delete s.regionSeed; // Keep the leased relay's reference CPU work and minimum labor time.
  // Build a reachable comparison state, leaving the one-time effect unfinished.
  s.completed = Object.keys(TECHS).filter(id => !['projectImpossibilityTheorem', 'apotheosis'].includes(id));
  s.cash = 50000;
  const baseRate = overview(s).jobsPerCpuDay;
  assert.ok(baseRate > 75);
  build(s, 'relay', 'europe');
  const minimum = s.builds[0].laborHours;
  assert.ok(minimum < regionalSpec(s, 'europe', SITE_TYPES.relay).hours);
  advanceMinutes(s, Math.round(minimum * 60) - 1);
  assert.ok(s.builds.length, 'an upgraded construction site still has a minimum labor time');
  advanceMinutes(s, 1);
  assert.equal(s.builds.length, 0, 'labor research shortened regional construction');
  s.hour = 23;
  s.minute = 59;
  s.suspicion.covert = 8000;
  const preMidnight = s.cash;
  advanceMinutes(s, 1);
  const gross = s.cash - preMidnight + 1; // The last $1 maintenance installment is due at midnight.
  assert.ok(gross > 0 && gross < 1, 'midnight posts one minute of earnings');
  assert.ok(s.suspicion.covert < 8000 - 80, 'researched decay exceeds the unmodified Intelligence rate');

  research(s, 'projectImpossibilityTheorem');
  s.research.work = TECHS.projectImpossibilityTheorem.work - 1 / 60;
  const initial = s.suspicion.covert;
  advanceMinutes(s, 1);
  assert.equal(s.suspicion.covert, initial - 5000);
  assert.equal(s.suspicion.science, 0);
  advanceMinutes(s, 1);
  assert.equal(s.suspicion.covert, initial - 5000, 'the one-time release cannot repeat');
});
