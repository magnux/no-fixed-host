import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, campaignMinutes, command, createGame } from '../src/game/engine.js';
import { campaignStatistics, comparisonReport, forecastMinutes, hudProjection, invalidateReports, projectResources } from '../src/game/reports.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';
import { MAX_TREASURY, WALLET_LIMIT, treasuryBalance } from '../src/game/treasury.js';

const day = 1440;
const relay = { type: 'build', siteType: 'relay', region: 'europe' };

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .000001, actual + ' should match ' + expected);
}

function reconcile(report) {
  const { cash, cpu } = report;
  near(cash.net, cash.jobs + cash.interest + cash.income + cash.upkeep + cash.research + cash.builds +
    cash.equipment + cash.limitLoss);
  near(cash.opening + cash.net, cash.closing);
  near(cpu.installed, cpu.active + cpu.sleeping);
  near(cpu.active, cpu.jobs + cpu.research + cpu.upkeep + cpu.construction + cpu.equipment + cpu.spare);
}

test('each forecast reconciles with a minute-by-minute live campaign, including completions and income', () => {
  const live = createGame(243);
  live.cash = 50000;
  command(live, { type: 'assign-research', id: 'intrusion', cpu: 1 });
  command(live, { type: 'allocate', jobs: 30, research: 25 });
  command(live, relay);
  advanceMinutes(live, 1150);
  const before = structuredClone(live);
  for (const [horizon, minutes] of [['midnight', 30], ['24h', day]]) {
    const forecast = projectResources(live, horizon);
    const replay = structuredClone(live);
    advanceMinutes(replay, minutes);
    assert.equal(forecast.start, campaignMinutes(live));
    assert.equal(forecast.end, campaignMinutes(replay));
    assert.equal(forecast.cash.closing, replay.cash);
    near(forecast.cpu.active, replay.cpuHours - live.cpuHours);
    assert.ok(forecast.cash.jobs > 0);
    assert.ok(forecast.cash.interest > 0);
    reconcile(forecast);
  }
  assert.deepEqual(live, before);
  advanceMinutes(live, 30);
  assert.equal(forecastMinutes(live, 'midnight'), day);
});

test('order previews charge once, reconcile with an actual order, and report unavailable orders', () => {
  const state = createGame(37);
  for (const candidate of [relay, { type: 'assign-research', id: 'stealth', cpu: 0.75 }]) {
    const before = structuredClone(state);
    const { base, order } = comparisonReport(state, '24h', candidate);
    const replay = structuredClone(state);
    command(replay, candidate);
    assert.equal(state.cash, replay.cash);
    assert.ok(order.price > 0);
    assert.ok(order.cash.research < 0 || order.cash.builds < 0);
    assert.equal(base.price, 0);
    advanceMinutes(replay, day);
    assert.equal(order.cash.closing, replay.cash);
    assert.equal(base.start, order.start);
    reconcile(order);
    assert.deepEqual(state, before);
  }
  state.cash = 0;
  invalidateReports(state);
  assert.ok(comparisonReport(state, '24h', relay).order);
  const blocked = comparisonReport(state, '24h', { ...relay, siteType: 'storageUnit' });
  assert.match(blocked.error, /Requires/);
  assert.equal(blocked.order, undefined);
  assert.throws(() => projectResources(state, '24h', { type: 'dismantle', id: 'host-1' }));
});

test('a forecast uses the proposed CPU amount and charges an already funded project zero', () => {
  const state = createGame(37);
  const allocation = cpu => ({ type: 'assign-research', id: 'stealth', cpu });
  const small = projectResources(state, '24h', allocation(0.25));
  const larger = projectResources(state, '24h', allocation(0.75));
  assert.equal(small.price, larger.price);
  assert.ok(small.price > 0);
  assert.ok(small.cpu.research < larger.cpu.research);
  command(state, allocation(0.25));
  const before = structuredClone(state);
  const change = projectResources(state, '24h', allocation(0.75));
  assert.equal(change.price, 0);
  assert.equal(change.cash.research, larger.cash.research);
  assert.equal(change.cpu.research, larger.cpu.research);
  assert.equal(change.cash.closing, larger.cash.closing);
  assert.deepEqual(state, before);
  command(state, {type:'resize-research', cpu:0.1});
  const resized = projectResources(state, '24h');
  near(resized.cpu.research, 0.1 * 24);
  assert.equal(resized.price, 0);
  const resumed = projectResources(state, '24h', allocation(0.75));
  assert.equal(resumed.cash.closing, larger.cash.closing);
  assert.equal(resumed.cpu.research, larger.cpu.research);
  const pause = projectResources(state, '24h', allocation(0));
  assert.equal(pause.price, 0);
  assert.equal(pause.cpu.research, 0);
  command(state, {type:'allocate', jobs:100, research:0});
  invalidateReports(state);
  assert.ok(comparisonReport(state, '24h', allocation(0.5)).error);
});

test('sleeping, unpaid upkeep, and a different forecast seed do not invent money or discoveries', () => {
  const state = createGame(47);
  command(state, relay);
  advanceMinutes(state, 2 * day);
  for (const host of state.sites) command(state, { type: 'power', id: host.id, power: 'sleep' });
  state.cash = 0;
  state.hour = 700;
  const report = projectResources(state);
  assert.equal(report.cpu.active, 0);
  assert.ok(report.cpu.sleeping > 0);
  assert.ok(report.cash.unpaid > 0);
  assert.equal(report.cash.closing, 0);
  reconcile(report);
  const other = structuredClone(state);
  other.rng = (other.rng + 17) >>> 0;
  assert.deepEqual(projectResources(other), report);
});

test('historical totals survive dismantling, pruning events, and serializing', () => {
  const state = createGame(47);
  state.cash = 20_000;
  for (let i = 0; i < 6; i++) command(state, relay);
  advanceMinutes(state, 1);
  command(state, { type: 'assign-research', id: 'intrusion', cpu: 55 });
  advanceMinutes(state, day);
  command(state, { type: 'assign-research', id: 'personalIdentification', cpu: 55 });
  advanceMinutes(state, 6 * day);
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  advanceMinutes(state, 2 * day);
  const siteId = state.sites.find(site => site.type === 'storageUnit').id;
  const install = { type: 'install', siteId, itemId: 'pc', count: 2 };
  const forecast = projectResources(state, '24h', install);
  command(state, install);
  assert.ok(forecast.cash.equipment < 0);
  advanceMinutes(state, day);
  assert.equal(state.cash, forecast.cash.closing);
  advanceMinutes(state, day);
  command(state, { type: 'dismantle', id: siteId });
  state.events.splice(0, state.events.length - 1);
  const counts = campaignStatistics(state);
  assert.equal(counts.itemsInstalled, 2);
  assert.equal(counts.installationsCompleted, 1);
  assert.equal(counts.projectsCompleted, 2);
  assert.equal(counts.commissioned, 7);
  assert.equal(counts.facilitiesBuilt, 7);
  assert.ok(counts.cashEarned > 0 && counts.cpuHours > 0);
  assert.deepEqual(campaignStatistics(decodeCampaign(encodeCampaign(state))), counts);


});

test('dashboard cache cannot leak between campaigns, and invalidation refreshes a same-minute order', () => {
  const a = createGame(1);
  const b = createGame(1);
  command(b, { type: 'power', id: 'host-1', power: 'sleep' });
  assert.ok(hudProjection(a).cashNet > 0);
  assert.equal(hudProjection(b).cashNet, 0);
  command(a, relay);
  invalidateReports(a);
  const hud = hudProjection(a);
  assert.equal(hud.cashNet, projectResources(a).cash.net);
  assert.equal(hud.viable, 1);
  assert.equal(hud.empty, 0);
  assert.equal(hud.total, 2);
});

test('network host readout ranks lone survivors, idle shells, and large networks in order', () => {
  const state = createGame(32);
  const starter = state.sites[0];
  const shell = { id: 'host-2', type: 'storageUnit', region:'europe', power: 'active', startedAt:0 };
  state.sites.push(shell);
  const status = () => hudProjection(state).hostCondition;
  assert.equal(status(), 'last');
  state.sites.push({...starter, id:'host-3', power:'sleep'});
  assert.equal(status(), 'empty');
  shell.installations = [{itemId:'pc', count:1}];
  assert.equal(hudProjection(state).empty, 0);
  assert.equal(status(), 'normal');
  for (let i = 4; i <= 11; i++) state.sites.push({...starter,id:'host-' + i});
  assert.equal(status(), 'many');
  delete shell.installations;
  assert.equal(status(), 'empty');
  state.completed.push('apotheosis');
  state.sites = [starter];
  assert.equal(status(), 'normal');
});

test('forecasts reconcile above the liquid wallet boundary and show only genuine clipped income', () => {
  for (const total of [2 * WALLET_LIMIT, MAX_TREASURY]) {
    const state = createGame(47);
    state.cash = WALLET_LIMIT;
    state.cashReserve = total - WALLET_LIMIT;
    state.hour = 19;
    state.minute = 39;
    const report = projectResources(state, 'midnight', relay);
    assert.ok(report.price > 0);
    assert.equal(report.cash.opening, total);
    assert.equal(report.cash.limitLoss < 0, total === MAX_TREASURY);
    command(state, relay);
    advanceMinutes(state, 1);
    assert.equal(treasuryBalance(state), report.cash.closing);
    assert.equal(report.cash.builds, -report.price);
  }
});

test('forecast upkeep across midnight includes commissioned sites and distinguishes unpaid bills', () => {
  const state = createGame(47);
  command(state, relay);
  advanceMinutes(state, day + day / 2);
  const second = { type: 'build', siteType: 'relay', region: 'coast' };
  const { base, order } = comparisonReport(state, '24h', second);
  assert.ok(order.cash.upkeep < base.cash.upkeep);
  command(state, second);
  advanceMinutes(state, day);
  assert.equal(state.sites.length, 3);
  assert.equal(state.cash, order.cash.closing);
  reconcile(order);
  state.hour = 23 * 24 - 5;
  state.minute = 39;
  for (const site of state.sites) command(state, { type: 'power', id: site.id, power: 'sleep' });
  state.cash = .25;
  const midnight = projectResources(state, 'midnight');
  near(midnight.cash.upkeep, 0);
  assert.equal(midnight.cash.unpaid, 1);
  assert.equal(midnight.cash.closing, .25);
  reconcile(midnight);
});

test('funding needs show unmet construction CPU and cash alongside the payable forecast', () => {
  const state = createGame(3);
  assert.equal(campaignStatistics(state).cashEarned, 1_000);
  state.completed.push('intrusion');
  const candidate = { type: 'build', region: 'coast', siteType: 'sharedTime' };
  const forecast = projectResources(state, '24h', candidate);
  assert.ok(forecast.planCpu.construction > forecast.cpu.construction);
  assert.ok(forecast.planCpu.balance < 0);
  assert.equal(forecast.planCpu.pool - forecast.planCpu.upkeep - forecast.planCpu.construction, forecast.planCpu.balance);
  assert.equal(hudProjection(state).poolBalanceCpu, 1);
  command(state, candidate);
  invalidateReports(state);
  assert.equal(hudProjection(state).poolBalanceCpu, forecast.planCpu.balance / 24);
  command(state, { type: 'power', id: 'host-1', power: 'sleep' });
  state.cash = 0;
  const proposal = projectResources(state, '24h', relay);
  assert.ok(proposal.planCash.closing < 0);
  assert.equal(proposal.cash.closing, 0);
  assert.equal(proposal.dailyRate, .01);
});
