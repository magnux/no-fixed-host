import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { dailyInterest, recentDiscoveryRegions } from '../src/game/normal-economy.js';
import { CASH_UNITS_PER_DOLLAR } from '../src/game/report-accounting.js';
import { MAX_TREASURY, migrateTreasury, settleTreasury, spendTreasury, validTreasury } from '../src/game/treasury.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

test('Normal interest rounds the daily amount before accrual', () => {
  assert.equal(dailyInterest(9999.99), 0);
  assert.equal(dailyInterest(10_000), 1);
  assert.equal(dailyInterest(20_000, 20), 42);
});

test('an idle network earns prorated interest and Arbitrage before and across midnight', () => {
  const state = createGame(5);
  state.cash = 20_000;
  state.sites[0].power = 'sleep';
  state.completed = ['stockManipulation', 'sociology', 'advancedStockManipulation', 'arbitrage'];
  // At $20,000 the two finance projects pay $42/day interest, plus $50/day income.
  advanceMinutes(state, 720);
  assert.equal(state.cash, 20_046);
  const resumed = structuredClone(state);
  advanceMinutes(state, 720);
  for (let i = 0; i < 720; i++) advanceMinutes(resumed, 1);
  assert.equal(state.cash, 20_092);
  assert.deepEqual(resumed, state);
});

test('spending the principal changes the next minute of interest', () => {
  const state = createGame(5);
  state.cash = 10_000;
  state.sites[0].power = 'sleep';
  advanceMinutes(state, 360);
  assert.equal(state.cash, 10_000.25);
  state.cash -= 1000;
  advanceMinutes(state, 1080);
  assert.equal(state.cash, 9000.25);
});

test('regional attention samples simultaneous reports without replacement', () => {
  const found = ['europe', 'asia', 'africa'].map(region => ({ site: { region } }));
  const old = ['coast', 'moon'];
  const unexpected = () => { throw Error('a single discovery should not consume a tie-break draw'); };
  assert.deepEqual(recentDiscoveryRegions(old, [], unexpected), old);
  assert.deepEqual(recentDiscoveryRegions(old, found.slice(2), unexpected), ['africa', 'coast']);
  assert.deepEqual(recentDiscoveryRegions(old, [found[1], found[1]], () => 0.9), ['asia', 'asia']);
  const pairs = new Set();
  for (const first of [1 / 6, 3 / 6, 5 / 6]) {
    for (const second of [0.25, 0.75]) {
      const draws = [first, second];
      const regions = recentDiscoveryRegions(old, found, () => draws.shift());
      assert.notEqual(regions[0], regions[1]);
      pairs.add(regions.join(','));
    }
  }
  assert.equal(pairs.size, 6);
});

test('a midnight discovery is followed by overnight decay before the final suspicion check', () => {
  for (const [minute, outcome] of [[58, 'lost'], [59, 'running']]) {
    // This seed draws zero on the next positive hazard. The borrowed terminal
    // is mature; the recently built, equipped backup has individual protection.
    const state = createGame(634785765);
    state.hour = 25 * 24 + 23;
    state.minute = minute;
    state.suspicion.news = 9001;
    state.sites.push({ id: 'host-2', type: 'relay', region: 'europe', power: 'active', startedAt: state.hour });
    advanceMinutes(state, 1);
    assert.equal(state.lastDiscovery.group, 'news');
    assert.equal(state.sites.length, 1);
    assert.equal(state.status, outcome);
    assert.equal(state.suspicion.news, minute === 59 ? 9851 : 10001);
  }
});

test('the treasury preserves its final accounting unit and reports excess earnings', () => {
  const state = { cash: MAX_TREASURY };
  const cap = state.cash * CASH_UNITS_PER_DOLLAR;
  settleTreasury(state, cap - 1);
  assert.equal(Math.round(state.cash * CASH_UNITS_PER_DOLLAR), cap - 1);
  assert.deepEqual(settleTreasury(state, cap + 10), { unpaid: 0, clipped: 10 / CASH_UNITS_PER_DOLLAR });
  assert.equal(state.cash, MAX_TREASURY);
  assert.deepEqual(settleTreasury(state, -40), { unpaid: 40 / CASH_UNITS_PER_DOLLAR, clipped: 0 });
  assert.equal(state.cash, 0);
});

test('older balances above the wallet ceiling remain available for purchases and upkeep', () => {
  const state = { cash: MAX_TREASURY + 7.75 };
  migrateTreasury(state);
  assert.deepEqual(state, { cash: MAX_TREASURY - 0.25, cashReserve: 8 });
  assert.ok(validTreasury(state));
  spendTreasury(state, 6);
  assert.deepEqual(state, { cash: MAX_TREASURY - 0.25, cashReserve: 2 });
  settleTreasury(state, Math.round((state.cash - 3.5) * CASH_UNITS_PER_DOLLAR));
  assert.deepEqual(state, { cash: MAX_TREASURY - 1.75 });
  assert.ok(validTreasury(state));
  assert.throws(() => migrateTreasury({ cash: 1e150 }), /legacy treasury/);
  assert.equal(validTreasury({ cash: 1, cashReserve: 8 }), false);
  const largest = { cash: Number.MAX_SAFE_INTEGER };
  migrateTreasury(largest);
  assert.ok(validTreasury(largest));
  assert.equal(largest.cash + largest.cashReserve, Number.MAX_SAFE_INTEGER);
});

test('a large v3 treasury survives normal save, purchase and reload entry points', () => {
  const old = createGame(15);
  old.version = 3;
  old.allocations.research = 50;
  old.cash = MAX_TREASURY + 500.25;
  delete old.regionSeed;
  delete old.statistics;
  delete old.researchQueue;
  const restored = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 3, campaign: old }));
  const reserve = restored.cashReserve;
  command(restored, { type: 'build', siteType: 'relay', region: 'europe' });
  assert.ok(restored.cashReserve < reserve);
  assert.equal(restored.cash, MAX_TREASURY - 0.75);
  assert.deepEqual(decodeCampaign(encodeCampaign(restored)), restored);
});
