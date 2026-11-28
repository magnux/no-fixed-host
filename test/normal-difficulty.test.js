import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, createGame, siteExposure } from '../src/game/engine.js';
import { REGIONS } from '../src/game/content.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

test('seeded new campaigns start in all inhabited regions and keep their location on load', () => {
  const regions = new Set();
  const inhabited = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
  for (let seed = 0; seed < inhabited.length; seed++) {
    const game = createGame(seed);
    regions.add(game.sites[0].region);
    assert.equal(game.rng, seed);
    assert.deepEqual(decodeCampaign(encodeCampaign(game)), game);
  }
  assert.deepEqual(regions, new Set(inhabited));
});

test('a quote made mid-hour keeps its entire protection period including the final minute', () => {
  const game = createGame();
  game.hour = 33 * 24;
  const site = { id: 'host-2', type: 'storageUnit', region: 'europe',
    startedAt: (game.hour * 60 - 2 * 1462) / 60, laborHours: 1462 / 60, power: 'active' };
  assert.equal(siteExposure(game, site).perDay, 0);
  game.minute++;
  assert.ok(siteExposure(game, site).perDay > 0);
});

test('concealment retains exactly 63 basis points from 90 with 30% security', () => {
  const game = createGame();
  game.regionSeed = 18; // Europe has the neutral profile for this seed.
  game.hour = 33 * 24;
  game.suspicion.news = 2000;
  const site = { id: 'host-2', type: 'storageUnit', region: 'europe', startedAt: 0, power: 'active',
    equipment: { cpu: { itemId: 'pc', count: 1 }, security: { itemId: 'hypnosisField', count: 1 } } };
  assert.equal(siteExposure(game, site).rates.news, 0.0063);
});

test('the four Normal agencies decay independently at midnight after an equal discovery gain', () => {
  const state = createGame();
  state.hour = 19;
  state.minute = 39;
  state.suspicion = { news: 1000, science: 1000, covert: 1000, public: 1000 };
  advanceMinutes(state);
  assert.deepEqual(state.suspicion, { news: 985, science: 995, covert: 990, public: 980 });
  state.hour = 43;
  state.minute = 39;
  state.suspicion = { news: 0, science: 1, covert: 2, public: 3 };
  advanceMinutes(state);
  assert.deepEqual(state.suspicion, { news: 0, science: 0, covert: 1, public: 2 });
});

test('Normal probability compounds over exposed time and independent mature sites', () => {
  const game = createGame();
  game.regionSeed = 18;
  game.hour = 33 * 24;
  const relay = { id: 'host-2', type: 'relay', region: 'europe', startedAt: 0, power: 'active' };
  const { perDay } = siteExposure(game, relay);
  const pct = probability => (100 * probability).toFixed(2);
  assert.equal(pct(perDay), '2.71');
  assert.equal(pct(1 - (1 - perDay) ** 7), '17.51');
  assert.equal(pct(1 - (1 - perDay) ** 10), '24.04');
});
