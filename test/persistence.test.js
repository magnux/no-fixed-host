import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, command, createGame } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign, GAME_VERSION, UnsupportedCampaignError } from '../src/persistence.js';

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

test('releases and schema revisions must match before reading any campaign data', () => {
  const envelope = JSON.parse(encodeCampaign(createGame(4)));
  for (const format of [1, 2, 3, 4, 5, 99]) {
    assert.throws(() => decodeCampaign(JSON.stringify({ ...envelope, format, campaign: null })), UnsupportedCampaignError);
  }
  assert.equal(envelope.gameVersion, GAME_VERSION);
  for (const gameVersion of [undefined, '0.2.0', '999.0.0']) {
    assert.throws(() => decodeCampaign(JSON.stringify({ ...envelope, gameVersion })), UnsupportedCampaignError);
  }
  assert.throws(() => decodeCampaign(JSON.stringify({ ...envelope, campaign: {} })), /damaged/);
});
