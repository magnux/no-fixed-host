import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, campaignMinutes, command, createGame } from '../src/game/engine.js';
import { campaignStatistics, comparisonReport, forecastMinutes, hudProjection, invalidateReports, projectResources } from '../src/game/reports.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';
import { MAX_TREASURY } from '../src/game/treasury.js';

const day = 1440;
const relay = { type: 'build', siteType: 'relay', region: 'europe' };

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < .000001, actual + ' should match ' + expected);
}

function reconcile(report) {
  const { cash, cpu } = report;
  near(cash.net, cash.jobs + cash.interest + cash.income + cash.upkeep + cash.research + cash.builds +
    cash.equipment + cash.reserveTransfer + cash.limitLoss);
  near(cash.opening + cash.net, cash.closing);
  near(cpu.installed, cpu.active + cpu.sleeping);
  near(cpu.active, cpu.jobs + cpu.research + cpu.upkeep + cpu.construction + cpu.equipment + cpu.spare);
}

test('each forecast reconciles with a minute-by-minute live campaign, including completions and income', () => {
  const live = createGame(243);
  live.cash = 50000;
  command(live, { type: 'research', id: 'intrusion' });
  command(live, { type: 'allocate', jobs: 30, research: 25 });
  command(live, relay);
  advanceMinutes(live, 1410);
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
  for (const candidate of [relay, { type: 'research', id: 'stealth' }]) {
    const before = structuredClone(state);
    const { base, order } = comparisonReport(state, '24h', candidate);
    const replay = structuredClone(state);
    command(replay, candidate);
    const price = state.cash - replay.cash;
    assert.ok(price > 0);
    assert.equal(order.cash.upfront, price);
    assert.equal(candidate.type === 'research' ? order.cash.research : order.cash.builds, -price);
    assert.equal(base.cash.upfront, 0);
    advanceMinutes(replay, day);
    assert.equal(order.cash.closing, replay.cash);
    assert.equal(base.start, order.start);
    reconcile(order);
    assert.deepEqual(state, before);
  }
  state.cash = 0;
  invalidateReports(state);
  const blocked = comparisonReport(state, '24h', relay);
  assert.match(blocked.error, /commission/);
  assert.equal(blocked.order, undefined);
  assert.throws(() => projectResources(state, '24h', { type: 'dismantle', id: 'host-1' }));
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

test('historical totals survive dismantling, pruning events, serializing and legacy migration', () => {
  const state = createGame(47);
  command(state, { type: 'research', id: 'intrusion' });
  advanceMinutes(state, 4 * 60);
  command(state, { type: 'research', id: 'personalIdentification' });
  advanceMinutes(state, day);
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
  assert.equal(counts.projectsCompleted, 2);
  assert.equal(counts.commissioned, 1);
  assert.equal(counts.facilitiesBuilt, 1);
  assert.ok(counts.cashEarned > 0 && counts.cpuHours > 0);
  assert.equal(counts.partial, false);
  assert.deepEqual(campaignStatistics(decodeCampaign(encodeCampaign(state))), counts);

  const old = structuredClone(state);
  old.version = 3;
  delete old.statistics;
  const restored = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 3, campaign: old }));
  const migrated = campaignStatistics(restored);
  assert.equal(migrated.partial, true);
  assert.equal(migrated.trackedFromMinute, campaignMinutes(old));
  assert.equal(migrated.cashEarned, 0);
  assert.equal(migrated.projectsCompleted, 0);
  assert.equal(migrated.cpuHours, counts.cpuHours);
  assert.equal(migrated.commissioned, counts.commissioned);
  advanceMinutes(restored, 60);
  assert.ok(campaignStatistics(restored).cashEarned > 0);
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

test('a legacy reserve finances the order and capped income is itemized separately from actual earnings', () => {
  const state = createGame(47);
  state.cash = MAX_TREASURY;
  state.cashReserve = 1000;
  // One minute isolates treasury units without losing precision summing a whole day at this balance.
  state.hour = 23;
  state.minute = 59;
  const report = projectResources(state, 'midnight', relay);
  assert.ok(report.cash.upfront > 0 && report.cash.upfront < state.cashReserve);
  assert.equal(report.cash.upfront, report.cash.reserveTransfer);
  assert.equal(report.cash.closingReserve, 1000 - report.cash.reserveTransfer);
  assert.ok(report.cash.limitLoss < 0);
  assert.equal(report.cash.opening, report.cash.closing);
  reconcile(report);
  command(state, relay);
  advanceMinutes(state, 1);
  assert.equal(state.cash, report.cash.closing);
  near(campaignStatistics(state).cashEarned, report.cash.jobs + report.cash.interest);
});

test('cash upkeep uses billed installments over half-days, across midnight and after construction finishes', () => {
  const state = createGame(47);
  command(state, relay);
  advanceMinutes(state, day + day / 2);
  assert.equal(state.sites.length, 2);
  const second = { type: 'build', siteType: 'relay', region: 'coast' };
  const { base: half, order: halfWithOrder } = comparisonReport(state, 'midnight', second);
  // At noon the $5/day European relay has paid $2; the remaining installments total $3.
  assert.equal(half.cash.upkeep, -3);
  assert.equal(halfWithOrder.cash.upkeep, -3);
  const { base, order } = comparisonReport(state, '24h', second);
  assert.equal(base.cash.upkeep, -5);
  // The second relay opens at 08:00 tomorrow. At the earlier $5/day rate, $1 has
  // fallen due since midnight. The new $11/day rate bills $2 between 08:00 and noon.
  assert.equal(order.cash.upkeep, -(3 + 1 + 2));
  command(state, second);
  advanceMinutes(state, day / 2);
  assert.equal(state.cash, halfWithOrder.cash.closing);
  advanceMinutes(state, day / 2);
  assert.equal(state.sites.length, 3);
  assert.equal(state.cash, order.cash.closing);
  reconcile(order);

  advanceMinutes(state, day / 2 - 1);
  const midnight = projectResources(state, 'midnight');
  assert.equal(midnight.end - midnight.start, 1);
  assert.equal(midnight.cash.upkeep, -1);
  const short = structuredClone(state);
  for (const host of short.sites) command(short, { type: 'power', id: host.id, power: 'sleep' });
  short.cash = .25;
  const underfunded = projectResources(short, 'midnight');
  assert.equal(underfunded.cash.upkeep, -.25);
  assert.equal(underfunded.cash.unpaid, .75);
  reconcile(underfunded);
  advanceMinutes(short, 1);
  assert.equal(short.cash, underfunded.cash.closing);

  advanceMinutes(state, 1);
  assert.equal(state.cash, midnight.cash.closing);
});

test('a migrated mid-day save retains fractional upkeep until its first midnight', () => {
  const previous = createGame(47);
  command(previous, relay);
  advanceMinutes(previous, day + day / 4);
  previous.version = 3;
  delete previous.statistics;
  const state = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 3, campaign: previous }));
  const firstNight = projectResources(state, 'midnight');
  const tomorrow = projectResources(state, '24h');
  near(firstNight.cash.upkeep, -3.75);
  near(tomorrow.cash.upkeep, -4.75);
  advanceMinutes(state, day * 3 / 4);
  assert.equal(state.cash, firstNight.cash.closing);
  assert.equal(state.legacyIncomeDay, undefined);
  advanceMinutes(state, day / 4);
  assert.equal(state.cash, tomorrow.cash.closing);
});
