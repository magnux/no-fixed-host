import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { dailyInterest, recentDiscoveryRegions } from '../src/game/normal-economy.js';
import { regionalSpec } from '../src/game/geography.js';
import { SITE_TYPES } from '../src/game/content.js';
import { laborHours } from '../src/game/research.js';
import { CASH_UNITS_PER_DOLLAR } from '../src/game/report-accounting.js';
import { MAX_TREASURY, WALLET_LIMIT, creditTreasury, treasuryBalance, settleTreasury, spendTreasury, validTreasury } from '../src/game/treasury.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

test('Normal interest rounds the daily amount before accrual', () => {
  assert.equal(dailyInterest(9999.99), 0);
  assert.equal(dailyInterest(10_000), 1);
  assert.equal(dailyInterest(20_000, 20), 42);
  assert.equal(dailyInterest(20_476.99, 20), 42);
  assert.equal(dailyInterest(3_139_999_999_997_619, 20), 6_593_999_999_994);
});

test('an idle network earns prorated interest and Arbitrage before and across midnight', () => {
  const state = createGame(5);
  state.cash = 20_000;
  state.sites[0].power = 'sleep';
  state.completed = ['stockManipulation', 'sociology', 'advancedStockManipulation', 'arbitrage'];
  // Normal Arbitrage pays $1,000/day. The daily interest starts at $42,
  // reaches $43 during the first half-day and $44 during the second.
  advanceMinutes(state, 720);
  assert.equal(state.cash, 20_521 + 60 / 1440);
  const resumed = structuredClone(state);
  advanceMinutes(state, 720);
  for (let i = 0; i < 720; i++) advanceMinutes(resumed, 1);
  assert.equal(state.cash, 21_042 + 903 / 1440);
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

test('an automation discount precedes regional construction speed and both truncate to minutes', () => {
  const state = createGame(1);
  const terms = regionalSpec(state, 'farReaches', SITE_TYPES.scientificOutpost);
  // 72h * 85% = 3,672 minutes. Survey speed of 0.095 gives 38,652 complete minutes.
  assert.equal(laborHours(state, terms, { labor: 8500 }), 38652 / 60);
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
  for (const [minute, outcome] of [[38, 'lost'], [39, 'running']]) {
    // This seed draws zero on the next positive hazard. The borrowed terminal
    // is mature; the recently built, equipped backup has individual protection.
    const state = createGame(634785765);
    state.hour = 25 * 24 + 19;
    state.minute = minute;
    state.suspicion.news = 9001;
    state.sites.push({ id: 'host-2', type: 'cluster', region: 'europe', power: 'active', startedAt: state.hour, laborHours: 24 });
    advanceMinutes(state, 1, { tipPolicy: 'decline' });
    assert.equal(state.lastDiscovery.group, 'news');
    assert.equal(state.sites.length, 1);
    assert.equal(state.status, outcome);
    assert.equal(state.suspicion.news, minute === 39 ? 9851 : 10001);
  }
});

test('late-game funds retain the last fractional unit and cover purchases above $10 billion', () => {
  const state = createGame(2);
  state.cash = WALLET_LIMIT;
  const units = CASH_UNITS_PER_DOLLAR;
  settleTreasury(state, WALLET_LIMIT * units + 1);
  assert.equal(state.cashReserve, 1);
  assert.equal(Math.round(state.cash * units), (WALLET_LIMIT - 1) * units + 1);
  creditTreasury(state, 100_000_000_000);
  assert.equal(state.statistics.earnedDollars, 100_000_001_000);
  assert.ok(validTreasury(state));
  spendTreasury(state, 80_000_000_000);
  assert.equal(state.cashReserve, 20_000_000_001);
  assert.deepEqual(decodeCampaign(encodeCampaign(state)), state);
  const ceiling = { cash: WALLET_LIMIT, cashReserve: MAX_TREASURY - WALLET_LIMIT };
  assert.deepEqual(settleTreasury(ceiling, WALLET_LIMIT * units + 10), { unpaid: 0, clipped: 10 / units });
  assert.equal(treasuryBalance(ceiling), MAX_TREASURY);
  assert.deepEqual(settleTreasury({cash:0}, -40), { unpaid: 40 / units, clipped: 0 });
  assert.equal(validTreasury({ cash: 1, cashReserve: 8 }), false);
});
