import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewsState, groupDanger, newsDiscoveryBonus, reportDiscovery,
  updateWorldNews, validLastDiscovery, validNewsState, WORLD_NEWS,
} from '../src/game/events.js';

import { advanceMinutes, createGame, siteExposure } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const DAY = 24 * 60;
function campaign(seed = 21) {
  return { news: createNewsState(seed), events: [], rng: seed, nextEventId: 1, nextSiteId: 3, hour: 0, minute: 0 };
}
function log(state, kind, text, detail) {
  const entry = { id: state.nextEventId++, kind, text, hour: state.hour, minute: state.minute, ...detail };
  state.events.push(entry);
  return entry;
}
function runNews(state, from, until, grace = false) {
  for (let minute = from; minute <= until; minute += 60) {
    state.hour = minute / 60;
    updateWorldNews(state, minute, grace, log);
  }
}

test('quiet-period bulletins appear early without changing risk or consuming either random stream', () => {
  const state = campaign();
  const startingRng = state.news.rng;
  runNews(state, 60, 23 * DAY - 60, true);
  assert.deepEqual(state.events.map(e => [e.hour, e.kind]), [[6, 'news.bulletin'], [48, 'news.bulletin']]);
  assert.equal(state.news.rng, startingRng);
  assert.equal(state.rng, 21);
  assert.deepEqual(state.news.stories, {});
});

test('eight reference dispatches change a specific group; six appear once and both press cycles expire and can recur', () => {
  assert.equal(Object.keys(WORLD_NEWS).length, 8);
  assert.deepEqual(Object.values(WORLD_NEWS).map(s => s.days || 0).sort((a, b) => a-b), [0,0,0,0,0,0,21,21]);
  const state = campaign(815);
  runNews(state, 23 * DAY, 7300 * DAY);
  const world = state.events.filter(e => e.kind === 'news.world');
  for (const [id, story] of Object.entries(WORLD_NEWS)) {
    const reports = world.filter(e => e.storyId === id);
    assert.ok(reports.every(e => e.modifier === story.modifier && e.group === story.group && e.headline && e.text));
    if (!story.days) assert.equal(reports.length, 1, id);
    else {
      assert.ok(reports.length > 1, id);
      const expiry = state.events.filter(e => e.kind === 'news.expired' && e.storyId === id);
      for (const [i, ended] of expiry.entries()) assert.equal(ended.hour - reports[i].hour, 21 * 24);
    }
  }
  assert.equal(state.rng, 815, 'world news must never draw from the site discovery stream');
  const bonuses = campaign();
  bonuses.news.stories = { observatory: 0, emergency: 0, investigation: 0 };
  assert.equal(newsDiscoveryBonus(bonuses, 'covert'), 1000);
  assert.equal(newsDiscoveryBonus(bonuses, 'public'), -1000);
  assert.equal(newsDiscoveryBonus(bonuses, 'science'), 0);
  bonuses.news.stories.frontPage = 60;
  assert.equal(newsDiscoveryBonus(bonuses, 'news'), 0);
});

test('saved news timing, uniqueness and modifiers survive resuming the timeline', () => {
  const a = campaign(938), b = campaign(938);
  runNews(a, DAY, 420 * DAY);
  runNews(b, DAY, 200 * DAY);
  const restored = JSON.parse(JSON.stringify(b));
  runNews(restored, 200 * DAY + 60, 420 * DAY);
  assert.deepEqual(a, restored);
  assert.ok(validNewsState(restored.news, 420 * DAY));
  assert.equal(validNewsState({ rng: 1, stories: { counterfeit: 0 } }, 10), false);
  assert.equal(validNewsState({ rng: -1, stories: {} }, 10), false);
  assert.equal(validNewsState({ rng: 1, stories: { fiction: 11 } }, 10), false);
});

test('a confirmed incident records its investigator, site, region and exact suspicion change', () => {
  const state = campaign();
  for (const group of ['news', 'science', 'covert', 'public']) {
    reportDiscovery(state, { id: 'host-2', region: 'europe', type: 'relay', power: 'active' }, group, 1000, log);
    assert.ok(validLastDiscovery(state.lastDiscovery, state));
    assert.equal(state.lastDiscovery, state.events.at(-1));
    assert.equal(state.lastDiscovery.group, group);
    assert.match(state.lastDiscovery.text, /host-2.*Europe.*installations.*10 percentage points/);
  }
  assert.equal(new Set(state.events.map(e => e.headline)).size, 4);
  reportDiscovery(state, { id: 'host-2', region: 'europe', type: 'relay' }, 'news', 1000, log);
  assert.match(state.lastDiscovery.text, /Construction has been shut down/);
  assert.equal(validLastDiscovery({ ...state.lastDiscovery, group: 'invented' }, state), false);
});

test('investigator danger uses forecast growth and proximity to the suspicion threshold', () => {
  assert.equal(groupDanger(9000, 0, 1000, 200).level, 0);
  assert.equal(groupDanger(0, 0.02, 1000, 150).level, 1);
  assert.equal(groupDanger(0, 0.08, 1000, 150).level, 2);
  assert.equal(groupDanger(0, 0.15, 1000, 150).level, 3);
  assert.equal(groupDanger(9990, 0.152, 1000, 150).level, 3);
});

test('a naturally drawn agency story changes only intelligence discovery in the playable simulation', () => {
  const state = createGame(1377);
  advanceMinutes(state, 23 * DAY - 1);
  assert.equal(state.events.some(e => e.kind === 'news.world'), false);
  advanceMinutes(state, 1);
  const event = state.events.find(e => e.kind === 'news.world');
  assert.equal(event.storyId, 'observatory');
  const resumed = decodeCampaign(encodeCampaign(state));
  const { rates } = siteExposure(resumed, resumed.sites[0]);
  assert.deepEqual(rates, { news: 0.0075, science: 0, covert: 0.0055, public: 0.0025 });
});
