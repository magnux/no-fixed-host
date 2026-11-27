import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, advanceMinutes, command } from '../src/game/engine.js';
import { networkThreat } from '../src/game/threat.js';

function exposed() {
  const game = createGame(18);
  game.hour = 24 * 25;
  return game;
}

test('protection and Apotheosis take precedence over old readings', () => {
  const game = createGame();
  game.suspicion.public = 8000;
  assert.deepEqual(networkThreat(game), {
    level: 'protected', cause: 'protection', sourceGroup: null, insight: 'none', rows: [],
  });
  game.hour = 24 * 40;
  game.completed.push('apotheosis');
  assert.equal(networkThreat(game).cause, 'apotheosis');
  game.freePlay = true;
  assert.equal(networkThreat(game).level, 'protected');
});

test('the strongest visible evidence or discovery grade determines the color at each insight tier', () => {
  const game = exposed();
  game.sites = [];
  for (const completed of [[], ['socioanalytics'], ['socioanalytics', 'advancedSocioanalytics']]) {
    game.completed = completed;
    for (const [points, level] of [[0, 'quiet'], [2499, 'quiet'], [2500, 'guarded'], [5000, 'high'], [7500, 'critical']]) {
      game.suspicion.science = points;
      const reading = networkThreat(game);
      assert.equal(reading.level, level);
      assert.equal(reading.cause, points < 2500 ? 'quiet' : 'evidence');
      assert.equal(reading.sourceGroup, points < 2500 ? null : 'science');
      const row = reading.rows.find(row => row.id === 'science');
      assert.equal(row.suspicion.level, Math.floor(points / 2500));
      assert.equal(row.danger.level, 0);
    }
  }
  const active = exposed();
  active.sites = Array.from({ length: 22 }, (_, i) =>
    ({ id: 'host-' + (i + 2), type: 'relay', region: 'europe', power: 'active', startedAt: 0 }));
  const reading = networkThreat(active);
  assert.equal(reading.level, 'critical');
  assert.equal(reading.cause, 'outlook');
  assert.equal(reading.rows.find(row => row.id === reading.sourceGroup).danger.level, 3);
  assert.ok(reading.rows.every(row => row.suspicion.level === 0));
});

test('a confirmed discovery remains high after acknowledgement, then yields to current readings in game time', () => {
  const game = exposed();
  game.sites[0].power = 'sleep';
  game.lastDiscovery = { id: 3, group: 'news', hour: game.hour, minute: game.minute };
  game.suspicion.news = 1000;
  const original = structuredClone(game);
  const atDiscovery = networkThreat(game);
  assert.equal(atDiscovery.level, 'high');
  assert.equal(atDiscovery.cause, 'discovery');
  assert.equal(atDiscovery.sourceGroup, 'news');
  assert.deepEqual(game, original);
  command(game, { type: 'acknowledge-discovery', id: 3 });
  assert.equal(networkThreat(game).cause, 'discovery');
  game.hour += 23;
  game.minute = 59;
  assert.equal(networkThreat(game).level, 'high');
  game.hour++;
  game.minute = 0;
  assert.equal(networkThreat(game).level, 'guarded');
  assert.equal(networkThreat(game).cause, 'outlook');
  assert.deepEqual(networkThreat(structuredClone(game)), networkThreat(game));
  game.dismissedDiscoveryId = 0;
  assert.equal(networkThreat(game).cause, 'discovery');
  game.suspicion.public = 7600;
  assert.equal(networkThreat(game).level, 'critical');
  assert.equal(networkThreat(game).sourceGroup, 'public');
});

test('terminal investigations are critical while past discoveries do not turn an upkeep failure into an investigation ending', () => {
  const game = exposed();
  game.rng = 634785765; // First positive hazard discovers the last terminal.
  advanceMinutes(game, 1);
  assert.equal(game.status, 'lost');
  assert.equal(networkThreat(game).level, 'critical');
  assert.equal(networkThreat(game).cause, 'investigation-loss');
  assert.equal(networkThreat(game).sourceGroup, game.lastDiscovery.group);
  game.events.push({ kind: 'site.failed', hour: game.hour, minute: game.minute });
  assert.notEqual(networkThreat(game).cause, 'investigation-loss');
  game.hour++;
  assert.notEqual(networkThreat(game).cause, 'investigation-loss');
  game.suspicion.science = 10_001;
  assert.equal(networkThreat(game).cause, 'investigation-loss');
  assert.equal(networkThreat(game).sourceGroup, 'science');
});
