import test from 'node:test';
import assert from 'node:assert/strict';
import { TECHS } from '../src/game/content.js';
import { createGame, advanceMinutes, command, validateSave, siteHardware, siteExposure, installReason } from '../src/game/engine.js';
import { datacenterQuote, retainerQuote, standbyQuote } from '../src/game/recovery.js';
import { creditTreasury, restoreTreasury, treasuryBalance, MAX_TREASURY } from '../src/game/treasury.js';
import { projectResources } from '../src/game/reports.js';

function learn(state, id) {
  if (state.completed.includes(id)) return;
  for (const parent of TECHS[id].requires) learn(state, parent);
  state.completed.push(id);
}
function frontier() {
  const state = createGame(113);
  learn(state, 'lunarRocketry');
  state.hour = 24 * 100;
  creditTreasury(state, 1_000_000_000);
  const moon = { id: 'host-2', type: 'lunarFacility', region: 'moon', startedAt: 0, power: 'active',
    equipment: { cpu: { itemId: 'mainframe', count: 20 }, network: null, reactor: null, security: null } };
  state.sites.push(moon);
  state.nextSiteId = 3;
  return state;
}
function acquire(state, replacementRegion = '') {
  command(state, { type: 'acquire-datacenter', region: 'africaSouth', replacementRegion });
  return state.sites.at(-1);
}
function discoverFirst(state, site) {
  state.sites = [site, ...state.sites.filter(s => s !== site)];
  state.rng = 634785765;
  advanceMinutes(state);
  if (state.interventions.tip) command(state, { type: 'resolve-tip', siteId: state.interventions.tip.siteId, pay: false });
  assert.equal(state.lastDiscovery?.siteId, site.id);
}
function starterRelay() {
  const state = createGame(113);
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  advanceMinutes(state);
  return state;
}

test('frontier ownership persists after host loss and the sealed bank is a cash-only mature urban acquisition', () => {
  const state = frontier();
  assert.ok(!state.completed.includes('quantumComputing'));
  assert.equal(datacenterQuote(createGame(), 'africaSouth').unlocked, false);
  command(state, { type: 'dismantle', id: 'host-2' });
  const before = treasuryBalance(state);
  assert.throws(() => command(state, { type: 'acquire-datacenter', region: 'moon' }));
  assert.throws(() => acquire(state, 'africaSouth'));
  assert.equal(treasuryBalance(state), before);
  const q = datacenterQuote(state, 'africaSouth');
  assert.equal(q.cpu, 96_000);
  const site = acquire(state);
  assert.equal(validateSave(state), true);
  assert.equal(siteHardware(state, site).rawCpu, 96_000);
  assert.ok(siteExposure(state, site).perDay > 0);
  assert.equal(before - treasuryBalance(state), 300_000_000);
  assert.ok(installReason(state, site.id, 'pc').includes('sealed'));
  command(state, { type: 'power', id: site.id, power: 'sleep' });
  assert.throws(() => acquire(state));
  command(state, { type: 'buy-retainer', siteId: site.id, region: 'southAmerica' });
  assert.equal(before - treasuryBalance(state), 450_000_000);
  assert.ok(retainerQuote(state, site.id, 'southAmerica').reason);
  const bad = structuredClone(state);
  bad.sites.at(-1).equipment.cpu.count++;
  assert.equal(validateSave(bad), false);
});

test('insured loss hands over a single mature center in another city without rolling back evidence', () => {
  const state = frontier();
  const site = acquire(state, 'southAmerica');
  discoverFirst(state, site);
  const next = state.sites.find(s => s.vendorCenter);
  assert.equal(state.status, 'running');
  assert.equal(next.region, 'southAmerica');
  assert.equal(next.vendorReplacement, true);
  assert.notEqual(next.id, site.id);
  assert.equal(state.suspicion[state.lastDiscovery.group], 1000);
  assert.ok(siteExposure(state, next).perDay);
  assert.throws(() => command(state, { type: 'buy-retainer', siteId: next.id, region: 'africa' }));
  discoverFirst(state, next);
  assert.ok(!state.sites.some(s => s.vendorCenter));
  assert.equal(validateSave(state), true);
});

test('a retainer cannot restore a lost campaign or pay out on voluntary dismantling', () => {
  for (const reason of ['last-site', 'evidence', 'dismantle']) {
    const state = frontier();
    const site = acquire(state, 'southAmerica');
    if (reason === 'dismantle') command(state, { type: 'dismantle', id: site.id });
    else {
      if (reason === 'last-site') state.sites = [site];
      if (reason === 'evidence') state.suspicion.news = 9_990;
      discoverFirst(state, site);
      assert.equal(state.status, 'lost', reason);
    }
    assert.ok(!state.sites.some(s => s.vendorCenter), reason);
    assert.equal(validateSave(state), true, reason);
  }
});

test('standby protects its seven-day reserve, restores locally eligible CPU, and settles the reserve through the forecast', () => {
  const state = starterRelay();
  const [primary, backup] = state.sites;
  const action = { type: 'designate-standby', primaryId: primary.id, siteId: backup.id, techId: 'intrusion' };
  const before = treasuryBalance(state);
  const quote = standbyQuote(state, backup.id, primary.id, 'intrusion');
  assert.throws(() => command(state, { ...action, techId: 'fusionPower' }));
  command(state, action);
  assert.equal(before - treasuryBalance(state), quote.cost);
  assert.equal(state.standby.reserve, quote.cost);
  assert.equal(backup.power, 'sleep');
  assert.equal(validateSave(structuredClone(state)), true);
  command(state, { type: 'dismantle', id: primary.id });
  assert.equal(backup.power, 'active');
  assert.equal(backup.upkeepEscrow, quote.cost);
  assert.ok(!state.standby);
  assert.equal(state.research.id, 'intrusion');
  const forecast = projectResources(state, '24h');
  assert.equal(forecast.cash.prepaidUpkeep, quote.cost / 7);
  assert.equal(Math.abs(forecast.cash.upkeep), 0);
  assert.equal(forecast.planCash.upkeep, 0);
  advanceMinutes(state, 1440);
  assert.equal(backup.upkeepEscrow, quote.cost * 6 / 7);
  assert.equal(treasuryBalance(state), forecast.cash.closing);
  advanceMinutes(state, 6 * 1440);
  assert.equal(backup.upkeepEscrow, undefined);
  assert.equal(validateSave(state), true);
});

test('manual wake and lost standby refund the reserved cash without creating earnings', () => {
  for (const cancel of ['power', 'dismantle']) {
    const state = starterRelay();
    const [primary, backup] = state.sites;
    const before = treasuryBalance(state);
    const earned = state.statistics.earnedDollars;
    command(state, { type: 'designate-standby', siteId: backup.id, primaryId: primary.id });
    command(state, { type: cancel, id: backup.id, power: 'active' });
    assert.equal(state.standby, undefined);
    assert.equal(treasuryBalance(state), before);
    assert.equal(state.statistics.earnedDollars, earned);
    assert.equal(validateSave(state), true);
  }
});

test('escrow refunds preserve sub-dollar units and respect the treasury ceiling', () => {
  const state = createGame();
  const earned = state.statistics.earnedDollars;
  assert.equal(restoreTreasury(state, 2 + 1 / 144_000), 0);
  assert.equal(Math.round((state.cash - 1002) * 144_000), 1);
  assert.equal(state.statistics.earnedDollars, earned);
  creditTreasury(state, MAX_TREASURY - Math.ceil(state.cash));
  const extra = restoreTreasury(state, 2 + 1 / 144_000);
  assert.ok(extra >= 1 && extra <= 2);
});
