import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewsState, groupDanger, newsDiscoveryBonus, reportDiscovery,
  storyExpiryMinute, updateWorldNews, validLastDiscovery, validNewsState, WORLD_NEWS,
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
  for (let minute = from; minute <= until; minute++) {
    state.hour = Math.floor(minute / 60);
    state.minute = minute % 60;
    updateWorldNews(state, minute, grace, log);
  }
}

test('quiet-period bulletins appear early without changing risk or consuming either random stream', () => {
  const state = campaign();
  const startingRng = state.news.rng;
  runNews(state, 60, 23 * DAY - 60, true);
  assert.deepEqual(state.events.map(e => e.hour), [6, 48, 132, 228, 324, 420, 516]);
  assert.ok(state.events.every(e => e.kind === 'news.bulletin' && e.desk));
  assert.equal(new Set(state.events.map(e => e.headline)).size, state.events.length);
  assert.equal(state.news.rng, startingRng);
  assert.equal(state.rng, 21);
  assert.deepEqual(state.news.stories, {});
});

test('eight reference dispatches change a specific group; six appear once and both press cycles expire and can recur', () => {
  assert.equal(Object.keys(WORLD_NEWS).length, 8);
  assert.deepEqual(Object.values(WORLD_NEWS).map(s => s.days || 0).sort((a, b) => a-b), [0,0,0,0,0,0,21,21]);
  const state = campaign(815);
  runNews(state, 23 * DAY, 4500 * DAY);
  const world = state.events.filter(e => e.kind === 'news.world');
  for (const [id, story] of Object.entries(WORLD_NEWS)) {
    const reports = world.filter(e => e.storyId === id);
    assert.ok(reports.every(e => e.modifier === story.modifier && e.group === story.group && e.headline && e.text));
    if (!story.days) assert.equal(reports.length, 1, id);
    else {
      assert.ok(reports.length > 1, id);
      const expiry = state.events.filter(e => e.kind === 'news.expired' && e.storyId === id);
      for (const [i, ended] of expiry.entries()) {
        const started = reports[i].hour * 60 + reports[i].minute;
        assert.equal(ended.hour * 60 + ended.minute, storyExpiryMinute(id, started));
        assert.ok(ended.hour * 60 - started > 21 * DAY && ended.hour * 60 - started <= 22 * DAY);
      }
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
  runNews(restored, 200 * DAY + 1, 420 * DAY);
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
  const state = createGame(502619);
  advanceMinutes(state, 23 * DAY - 1);
  assert.equal(state.events.some(e => e.kind === 'news.world'), false);
  advanceMinutes(state, 1);
  const event = state.events.find(e => e.kind === 'news.world');
  assert.equal(event.storyId, 'observatory');
  const resumed = decodeCampaign(encodeCampaign(state));
  const before = structuredClone(resumed);
  delete before.news.stories.observatory;
  const base = siteExposure(before, before.sites[0]).rates;
  const { rates } = siteExposure(resumed, resumed.sites[0]);
  assert.deepEqual(rates, { ...base, covert: Math.floor(base.covert * 10_000 * 1.1) / 10_000 });
  assert.ok(rates.covert > base.covert);
});

test('temporary coverage lasts through its anniversary, expires after the midnight roll and becomes eligible next minute', () => {
  const s = campaign();
  const after = 22 * DAY;
  s.news.stories = Object.fromEntries(Object.keys(WORLD_NEWS).map(id => [id, 0]));
  runNews(s, 21 * DAY, after - 1);
  assert.ok(Object.hasOwn(s.news.stories, 'frontPage'));
  const initialRng = s.news.rng;
  runNews(s, after, after);
  assert.equal(s.news.rng, initialRng, 'the midnight event roll still sees both press cycles active');
  assert.equal(s.events.filter(e => e.kind === 'news.expired').length, 2);
  assert.equal(Object.keys(s.news.stories).length, 6);
  runNews(s, after + 1, after + 1);
  assert.notEqual(s.news.rng, initialRng);
});

test('field reports await a regional host and publish once across rebuilding and reloading', () => {
  const s = campaign();
  s.sites = [];
  runNews(s, 1, 18 * 60, true);
  assert.ok(!s.news.regional);
  s.sites.push({ region: 'atlantic' }, { region: 'moon' });
  runNews(s, 18 * 60 + 1, 3 * DAY, true);
  const resumed = structuredClone(s);
  runNews(resumed, 3 * DAY + 1, 6 * DAY, true);
  assert.deepEqual(resumed.events.filter(e => e.storyId?.startsWith('field-')).map(e => e.storyId), ['field-atlantic', 'field-moon']);
  assert.ok(validNewsState(resumed.news, 6 * DAY));
  assert.equal(validNewsState({ ...resumed.news, regional: ['bogus'] }, 6 * DAY), false);
  assert.equal(validNewsState({ ...resumed.news, regional: ['moon', 'moon'] }, 6 * DAY), false);
});

test('the late network brief uses this campaign’s recent operations and stays out of random story modifiers', () => {
  const s = campaign();
  s.hour = 68 * 24;
  s.sites = [{ region: 'europe' }, { region: 'europe' }];
  log(s, 'research.completed', 'Sociology complete.');
  runNews(s, 69 * DAY, 69 * DAY + DAY / 2, true);
  const brief = s.events.at(-1);
  assert.equal(brief.kind, 'news.digest');
  assert.match(brief.text, /Sociology complete.*2 hosts in 1 region/);
  assert.deepEqual(s.news.stories, {});
});

test('each active world story gets one later editorial follow-up without reapplying its effect', () => {
  const s = campaign(31);
  const rng = s.news.rng;
  s.news.stories = Object.fromEntries(Object.keys(WORLD_NEWS).map(id => [id, 0]));
  runNews(s, 1, 10 * DAY, true);
  assert.deepEqual(s.events.filter(e => e.storyId?.startsWith('follow-')).map(e => e.storyId),
    Object.keys(WORLD_NEWS).map(id => 'follow-' + id));
  assert.deepEqual(Object.keys(s.news.stories), Object.keys(WORLD_NEWS));
  assert.equal(s.news.rng, rng);
  const resume = structuredClone(s);
  runNews(resume, 10 * DAY + 1, 13 * DAY, true);
  assert.equal(resume.news.followups.length, 8);
  assert.ok(validNewsState(resume.news, 13 * DAY));
  assert.equal(validNewsState({ ...resume.news, followups: ['fake'] }, 13 * DAY), false);
});
