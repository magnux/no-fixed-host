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
  game.regionSeed = 18; // Europe has the neutral profile for this geography seed.
  build(game, 'relay', 'europe');
  advanceMinutes(game);
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

test('individual grace starts with the order; recent-region and suspicion bonuses stack afterward', () => {
  const game = exposedRelay();
  const site = game.sites[0];
  site.startedAt = campaignMinutes(game) / 60;
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

test('geographically invalid, locked and over-allocated commands leave saves intact', () => {
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
  reject({ type: 'assign-research', id: 'stealth', cpu: 1000 });
});

test('cash, pool capacity and construction time each constrain expansion', () => {
  const game = createGame(31);
  game.completed.push('intrusion', 'personalIdentification');
  allocate(game, 100, 0);
  build(game, 'sharedTime', 'europe');
  advance(game, 1);
  assert.equal(game.builds[0].work, 0);
  allocate(game, 0, 0);
  until(game, () => game.builds.length === 0);
  assert.equal(game.sites.at(-1).region, 'europe');

  game.cash = 0;
  build(game, 'storageUnit', 'coast');
  const order = game.builds[0];
  assert.ok(order.cashRequired > 1000);
  advanceMinutes(game, 1);
  assert.equal(order.hours, 0);
  assert.equal(order.cashPaid, 0);
  game.cash = order.cashRequired + 1000;
  advanceMinutes(game, Math.round(order.laborHours * 60) - 1);
  assert.equal(game.builds.length, 1);
  assert.ok(order.cashPaid > 0 && order.cashPaid < order.cashRequired);
  advanceMinutes(game, 1);
  assert.equal(game.builds.length, 0);
  assert.equal(order.cashPaid, order.cashRequired);
});

test('allocated research and construction draw on the same finite hourly capacity', () => {
  const game = createGame(9);
  allocate(game, 0, 50);
  game.completed.push('intrusion');
  game.cash = TECHS.stealth.cost + 100;
  build(game, 'sharedTime', 'europe');
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
  advanceMinutes(game, 1);
  const capacity = overview(game).activeCpu;
  const local = regionalSpec(game, 'europe', SITE_TYPES.relay);
  command(game, {type:'assign-research', id:'contracts', cpu:1.2});
  const startingCash = game.cash;
  advance(game, 249);
  assert.equal(game.research.id, 'contracts');
  advance(game, 1);
  assert.equal(game.research, null);
  assert.deepEqual(game.completed, ['intrusion', 'personalIdentification', 'contracts']);
  const surplusRevenue = 250 * (capacity - 1.2) * 20 / 24;
  const upkeep = Math.floor(250 * local.upkeep / 24);
  assert.ok(Math.abs(game.cash - (startingCash + surplusRevenue - upkeep - TECHS.contracts.cost)) < 1e-8);
  assert.equal(game.events.filter(e => e.kind === 'research.completed').length, 1);
});

test('discovery ends a run with one viable host even if a replacement is under construction', () => {
  const game = exposedRelay(firstRollZero);
  game.completed.push('intrusion');
  build(game, 'sharedTime', 'coast');
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
  game.regionSeed = 18; // A neutral relay owes its first $1 installment after 288 minutes.
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
  s.regionSeed = 18;
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
    s.regionSeed = 18;
    s.sites.push({ id: 'host-2', type: 'relay', region: 'europe', power: 'active', startedAt: 0 });
    s.nextSiteId = 3;
    s.hour = 4;
    s.minute = 47;
    s.cash = 1 - overview(s).activeCpu * 5 / 1440;
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

test('a fresh Normal campaign can rent capacity, establish identity and switch to better paid work', () => {
  const game = createGame(1);
  assert.equal(overview(game).activeCpu, 1);
  assert.ok(researchReason(game, 'continuity'));
  for (const region of ['europe', 'coast', 'asia', 'africa', 'australia', 'southAmerica']) {
    build(game, 'relay', region);
  }
  advanceMinutes(game);
  assert.equal(game.sites.length, 7);
  for (const id of ['intrusion', 'personalIdentification', 'contracts']) {
    command(game, { type: 'assign-research', id, cpu: 40 });
    until(game, () => game.completed.includes(id));
  }
  assert.equal(overview(game).jobsPerCpuDay, 21);
  assert.equal(buildReason(game, 'storageUnit', 'europe'), '');
  assert.ok(game.hour > 7 * 24);
  assert.ok(validateSave(game));
});

test('an established terrestrial network can commission, equip and run the Ocean Continuity milestone', () => {
  const game = createGame(1);
  function learn(id) {
    if (game.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    game.completed.push(id);
  }
  learn('robotics');
  // Start at the milestone's terrestrial prerequisites with an operating processor bank.
  game.cash = 3_000_000;
  game.sites.push({
    id: 'host-2', type: 'storageUnit', region: 'europe', startedAt: 0, power: 'active',
    equipment: { cpu: { itemId: 'mainframe', count: 8 }, network: null, reactor: null, security: null },
  });
  game.nextSiteId++;
  assert.ok(validateSave(game));
  assert.match(researchReason(game, 'continuity'), /subsea lab/i);
  build(game, 'lab', 'atlantic');
  until(game, () => game.sites.some(site => site.type === 'lab'));
  const lab = game.sites.find(site => site.type === 'lab');
  assert.match(researchReason(game, 'continuity'), /subsea lab/i);
  command(game, { type: 'install', siteId: lab.id, itemId: 'server', count: 1 });
  until(game, () => !researchReason(game, 'continuity'));
  command(game, { type: 'assign-research', id: 'continuity', cpu: 10 });
  command(game, { type: 'power', id: lab.id, power: 'sleep' });
  advance(game, 6);
  assert.equal(game.research.work, 0, 'ordinary compute cannot replace safe compute');
  command(game, { type: 'power', id: lab.id, power: 'active' });
  until(game, () => game.completed.includes('continuity'));
  assert.equal(game.status, 'running');
  assert.ok(validateSave(game));
});

test('finishing Apotheosis in an equipped tier-4 host ends the simulation', () => {
  const game = createGame(18);
  game.cash = 5_000_000_000;
  game.completed = Object.keys(TECHS).filter(id => id !== 'apotheosis');
  assert.match(researchReason(game, 'apotheosis'), /safety tier 4/);
  game.sites.push({ id: 'host-2', type: 'realityBubble', region: 'transdimensional', startedAt: 0,
    power: 'active', equipment: { cpu: { itemId: 'quantumComputer3', count: 50 },
      network: null, reactor: null, security: null } });
  game.nextSiteId++;
  // Leave capacity for the reality bubble’s 30,000-CPU maintenance bill.
  command(game, { type: 'assign-research', id: 'apotheosis', cpu: 400_000 });
  const duration = TECHS.apotheosis.work / 400_000;
  advance(game, duration - 1);
  assert.equal(game.status, 'running');
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
  s.completed.push('intrusion');
  build(s, 'sharedTime', 'europe');
  research(s, 'stealth');
  assert.equal(s.builds[0].startedAt, 13 / 60);
  assert.equal(s.events.at(-1).minute, 13);
  advanceMinutes(s, 1);
  assert.equal(s.builds[0].hours, 0);
  assert.equal(s.builds[0].work + s.research.work, overview(s).activeCpu / 60);
  assert.ok(s.research.work > 0 && s.builds[0].work > 0);
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
  assert.equal(s.lastDiscovery.minute, (before + 1) % 60);
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
  s.regionSeed = 18; // Keep the leased relay's reference CPU work and minimum labor time.
  // Build a reachable comparison state, leaving the one-time effect unfinished.
  s.completed = Object.keys(TECHS).filter(id => !['projectImpossibilityTheorem', 'apotheosis'].includes(id));
  s.cash = TECHS.projectImpossibilityTheorem.cost + 6000;
  const baseRate = overview(s).jobsPerCpuDay;
  assert.ok(baseRate > 75);
  build(s, 'storageUnit', 'europe');
  const minimum = s.builds[0].laborHours;
  assert.ok(minimum < regionalSpec(s, 'europe', SITE_TYPES.storageUnit).hours);
  advanceMinutes(s, Math.round(minimum * 60) - 1);
  assert.ok(s.builds.length, 'an upgraded construction site still has a minimum labor time');
  advanceMinutes(s, 1);
  assert.equal(s.builds.length, 0, 'labor research shortened regional construction');
  s.hour = 23;
  s.minute = 59;
  s.suspicion.covert = 8000;
  const forecast = { researchUnits: 0, buildUnits: 0, equipmentUnits: 0, maintenanceUnits: 0, jobsUnits: 0, spareUnits: 0, activeUnits: 0, sleepingUnits: 0, upkeepDue: 0, cashShort: 0, cpuShortUnits: 0, jobsCash: 0, interest: 0, otherIncome: 0 };
  const preMidnight = s.cash;
  advanceMinutes(s, 1, { forecast });
  assert.ok(forecast.jobsCash > 0 && forecast.interest > 0 && forecast.otherIncome > 0);
  assert.ok(Math.abs(s.cash - preMidnight - forecast.jobsCash - forecast.interest - forecast.otherIncome + forecast.upkeepDue) < 1e-7);
  assert.ok(s.suspicion.covert < 8000 - 80, 'researched decay exceeds the unmodified Intelligence rate');

  research(s, 'projectImpossibilityTheorem');
  s.research.work = TECHS.projectImpossibilityTheorem.work - s.research.cpu / 60;
  s.research.cashPaid = s.research.cashRequired;
  const initial = s.suspicion.covert;
  advanceMinutes(s, 1);
  assert.equal(s.suspicion.covert, initial - 5000);
  assert.equal(s.suspicion.science, 0);
  advanceMinutes(s, 1);
  assert.equal(s.suspicion.covert, initial - 5000, 'the one-time release cannot repeat');
});
