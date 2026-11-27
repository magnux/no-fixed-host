import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, command, createGame } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

test('a portable save resumes construction, research, the clock and the random sequence', () => {
  const live = createGame(12345);
  command(live, { type: 'build', siteType: 'relay', region: 'europe' });
  command(live, { type: 'research', id: 'contracts' });
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
