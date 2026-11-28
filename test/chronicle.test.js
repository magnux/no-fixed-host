import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMinutes, command, createGame, log, overview, siteExposure, validateSave } from '../src/game/engine.js';
import { CHAPTERS, currentWarnings, eventCategory, reportsAt, storyKey } from '../src/game/chronicle.js';
import { copyToSandbox } from '../src/game/devtools.js';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { newsDiscoveryBonus } from '../src/game/events.js';
import { MAX_TREASURY, WALLET_LIMIT } from '../src/game/treasury.js';
import { regionalSpec } from '../src/game/geography.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const dev = (game, operation, params = {}) => command(game, {type: 'developer', operation, ...params});
const warningIds = warnings => warnings.map(warning => warning.id);

test('journal retains the newest 1,000 reports and groups detail replay by the recorded minute', () => {
  const state = createGame(42);
  for (let i = 0; i < 1004; i++) log(state, 'campaign.note', `Entry ${i}`);
  advanceMinutes(state, 1);
  log(state, 'site.renamed', 'Renamed a site.');
  log(state, 'site.discovered', 'Local reports.');
  advanceMinutes(state, 1);
  log(state, 'news.bulletin', 'An unrelated bulletin.');
  const restored = decodeCampaign(encodeCampaign(state));
  assert.deepEqual(restored.events, state.events);
  assert.equal(restored.events.length, 1000);
  assert.equal(restored.events[0].id, state.nextEventId - 1000);
  assert.deepEqual(reportsAt(restored.events, restored.events.at(-2)).map(eventCategory), ['facilities', 'discoveries']);
});

test('each campaign milestone and both loss causes select the matching authored story', () => {
  const rows = [
    ['campaign.started', '', 'opening'], ['grace.ended', '', 'grace'],
    ['campaign.won', 'Apotheosis complete.', 'victory'], ['campaign.continuity', '', 'continuity'],
    ['campaign.won', 'Continuity secured.', 'continuity'],
    ['campaign.lost', 'Your last viable host was lost.', 'lastHost'],
    ['campaign.lost', 'News established your existence beyond doubt.', 'suspicion'],
  ];
  for (const [kind, text, chapter] of rows) {
    assert.equal(storyKey({kind, text}), chapter);
    assert.ok(CHAPTERS[chapter].pages.length >= 2);
  }
  assert.equal(storyKey({kind:'news.world'}), null);
});

test('unused research and unassigned pool capacity have independent warnings', () => {
  const state = createGame(9);
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'lastHost']);
  command(state, {type:'assign-research', id:'intrusion', cpu:0.5});
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'lastHost']);
  command(state, {type:'resize-research', cpu:0.25});
  assert.deepEqual(warningIds(currentWarnings(state, {unassigned:false})), ['lastHost']);
  command(state, {type:'power', id:state.sites[0].id, power:'sleep'});
  assert.deepEqual(warningIds(currentWarnings(state)), ['spareCpu', 'lastHost'], 'assignment lost its eligible processors');
  command(state, {type:'power', id:state.sites[0].id, power:'active'});
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'lastHost']);
  state.research.work = TECHS.intrusion.work;
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'spareCpu', 'lastHost']);
  assert.deepEqual(warningIds(currentWarnings(state, {spareCpu:false})), ['unassigned', 'lastHost']);
  command(state, {type:'resize-research', cpu:0});
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'lastHost']);
  command(state, {type:'assign-research', id:'intrusion', cpu:0});
  assert.deepEqual(warningIds(currentWarnings(state)), ['unassigned', 'lastHost']);
  command(state, {type:'allocate', jobs:100, research:0});
  state.completed.push('intrusion');
  state.sites.push({ id: 'host-2', type: 'capsule', region: 'antarctic', power: 'sleep', startedAt: 0 });
  state.nextSiteId = 3;
  command(state, { type: 'build', siteType: 'sharedTime', region: 'europe' });
  assert.deepEqual(warningIds(currentWarnings(state)), ['stalledBuild', 'maintenance']);
  assert.deepEqual(warningIds(currentWarnings(state, {maintenance:false})), ['stalledBuild']);
  assert.deepEqual(warningIds(currentWarnings(state, {stalledBuild:false})), ['maintenance']);
  state.status = 'lost';
  assert.deepEqual(currentWarnings(state), []);
});

test('the 99% assignment boundary includes CPU explicitly committed to construction', () => {
  const state = createGame();
  const warning = () => warningIds(currentWarnings(state)).includes('unassigned');
  command(state, {type:'assign-task', task:'pool', cpu:0.98});
  assert.ok(warning());
  command(state, {type:'assign-task', task:'pool', cpu:0.99});
  assert.equal(warning(), false);
  command(state, {type:'build', region:'europe', siteType:'relay'});
  state.cash = 0;
  const lastHost = () => warningIds(currentWarnings(state)).includes('lastHost');
  assert.ok(lastHost());
  const build = state.builds[0];
  build.cashPaid = build.cashRequired;
  build.hours = build.laborHours;
  build.work = build.workRequired;
  assert.equal(lastHost(), false, 'a powered backup will commission on the next minute');
});

test('warn about an empty reserved pool even while unfunded research returns enough CPU', () => {
  const state = createGame(18);
  state.completed.push('intrusion');
  state.cash = 0;
  command(state, {type:'assign-research', id:'stealth', cpu:1});
  command(state, {type:'build', region:'europe', siteType:'sharedTime'});
  const warnings = () => currentWarnings(state);
  assert.match(warnings().find(w => w.id === 'stalledBuild').text, /return unused CPU/);
  state.sites.push({id:'host-3', type:'capsule', region:'antarctic', power:'sleep', startedAt:0});
  assert.match(warnings().find(w => w.id === 'maintenance').text, /depends on CPU returned/);
});

test('warnings name the stalled order and distinguish cash, queue contention and labor-only installation', () => {
  const state = createGame(12);
  state.completed = ['intrusion', 'personalIdentification'];
  const build = type => command(state, { type: 'build', siteType: type, region: 'coast' });
  const stalled = () => currentWarnings(state).find(warning => warning.id === 'stalledBuild');
  build('sharedTime');
  assert.equal(stalled(), undefined);
  build('sharedTime');
  assert.match(stalled().text, /earlier facility orders/);
  for (const order of [...state.builds]) command(state, { type: 'cancel-build', id: order.id });
  state.cash = 0;
  build('relay');
  assert.match(stalled().text, /funds/);
  state.cash = 500;
  assert.equal(stalled(), undefined);
  command(state, { type: 'cancel-build', id: state.builds[0].id });
  state.sites.push({ id: 'host-5', type: 'storageUnit', region: 'coast', power: 'active', startedAt: 0 });
  state.nextSiteId = 6;
  command(state, { type: 'install', siteId: 'host-5', itemId: 'pc', count: 1 });
  command(state, { type: 'allocate', jobs: 100 });
  assert.equal(stalled(), undefined, 'a labor-only PC installation can run with all CPU allocated to jobs');
  state.cash = 0;
  assert.match(stalled().text, /PC.*funds/);
});

test('sandbox cheats require an isolated campaign, preserve RNG, update real event effects, and survive save validation', () => {
  const live = createGame(65);
  const original = encodeCampaign(live);
  assert.throws(() => dev(live, 'funds', {amount:5}), /sandbox/);
  const state = copyToSandbox(live);
  dev(state, 'funds', {amount:2000});
  assert.equal(state.cash, 3000);
  assert.throws(() => dev(state, 'funds', {amount:-2}), /positive/);
  dev(state, 'withdraw', {amount:103});
  assert.equal(state.cash, 2897);
  assert.throws(() => dev(state, 'withdraw', {amount:4000}), /balance/);
  const rich = copyToSandbox(createGame());
  rich.cash = WALLET_LIMIT;
  rich.cashReserve = MAX_TREASURY - WALLET_LIMIT;
  assert.throws(() => dev(rich, 'funds', {amount:1}), /treasury limit/);
  dev(state, 'trigger', {storyId:'frontPage'});
  assert.equal(newsDiscoveryBonus(state, 'news'), -1000);
  assert.throws(() => dev(state, 'trigger', {storyId:'frontPage'}), /already active/);
  dev(state, 'expire', {storyId:'frontPage'});
  assert.equal(newsDiscoveryBonus(state, 'news'), 0);
  assert.throws(() => dev(state, 'expire', {storyId:'frontPage'}), /not active/);
  dev(state, 'trigger', {storyId:'observatory'});
  assert.throws(() => dev(state, 'expire', {storyId:'observatory'}), /rest of the campaign/);
  state.hour = 600;
  assert.ok(siteExposure(state, state.sites[0]).perDay > 0);
  dev(state, 'detection', {enabled:false});
  dev(state, 'analysis', {level:'partial'});
  dev(state, 'analysis', {level:'full'});
  assert.throws(() => dev(state, 'analysis', {level:'invalid'}), /analysis level/);
  assert.equal(siteExposure(state, state.sites[0]).perDay, 0);
  state.suspicion.news = 1200;
  dev(state, 'suspicion');
  assert.equal(state.suspicion.news, 0);
  assert.equal(state.rng, live.rng);
  assert.equal(state.news.rng, live.news.rng);
  assert.deepEqual(decodeCampaign(encodeCampaign(state)), state);
  assert.equal(encodeCampaign(live), original);
});

test('sandbox inspiration only completes research receiving CPU', () => {
  const state = copyToSandbox(createGame(183));
  command(state, {type:'assign-research', id:'intrusion', cpu:1});
  command(state, {type:'assign-research', id:'intrusion', cpu:0});
  assert.throws(() => dev(state, 'research'), /Assign CPU/);
  command(state, {type:'assign-research', id:'stealth', cpu:1});
  dev(state, 'research');
  advanceMinutes(state, 1);
  assert.ok(state.completed.includes('stealth'));
  assert.equal(state.research.id, 'intrusion');
  assert.equal(state.research.work, 0);
});

test('sandbox completion honors each regional work target, saved labor estimate and installed hardware', () => {
  const state = copyToSandbox(createGame(65));
  const region = Object.keys(REGIONS).find(id => SITE_TYPES.sharedTime.regions.includes(id) && regionalSpec(state, id, SITE_TYPES.sharedTime).work > SITE_TYPES.sharedTime.work);
  assert.ok(region, 'seed must exercise a nonstandard target');
  dev(state, 'funds', {amount:50000});
  command(state, {type:'assign-research', id:'intrusion', cpu:1});
  dev(state, 'research');
  advanceMinutes(state, 1);
  command(state, {type:'build', siteType:'sharedTime', region});
  dev(state, 'construction');
  assert.ok(validateSave(state));
  assert.equal(state.builds[0].work, regionalSpec(state, region, SITE_TYPES.sharedTime).work);
  advanceMinutes(state, 1);
  assert.ok(state.completed.includes('intrusion'));
  command(state, {type:'assign-research', id:'personalIdentification', cpu:1});
  dev(state, 'research');
  advanceMinutes(state, 1);
  command(state, {type:'build', siteType:'storageUnit', region});
  dev(state, 'construction');
  advanceMinutes(state, 1);
  const site = state.sites.find(site => site.region === region && site.type === 'storageUnit');
  assert.ok(site);
  command(state, {type:'install',siteId:site.id,itemId:'highSpeedInternet', count:1});
  dev(state, 'construction');
  assert.equal(site.installations[0].work, regionalSpec(state, site.region, EQUIPMENT.highSpeedInternet).work);
  assert.ok(validateSave(state));
  advanceMinutes(state, 1);
  assert.equal(site.equipment.network.itemId, 'highSpeedInternet');
  assert.ok(validateSave(state));
});

test('free play requires Apotheosis, survives reload and bypasses lost hosts, suspicion and upkeep', () => {
  const state = createGame(94);
  assert.throws(() => command(state, {type:'free-play'}));
  state.completed = Object.keys(TECHS);
  state.status = 'won';
  state.ending = 'Apotheosis complete.';
  const won = decodeCampaign(encodeCampaign(state));
  command(won, {type:'free-play'});
  command(won, {type:'build', siteType:'relay', region:'europe'});
  advanceMinutes(won, 60 * 30);
  assert.ok(won.sites.some(site => site.type === 'relay'));
  assert.equal(overview(won).upkeepPerDay, 0);
  assert.equal(overview(won).cpuUpkeep, 0);
  won.hour = 1000;
  assert.equal(siteExposure(won, won.sites[0]).perDay, 0);
  won.sites = [];
  won.suspicion.public = 11000;
  advanceMinutes(won, 1);
  assert.equal(won.status, 'running');
  assert.deepEqual(decodeCampaign(encodeCampaign(won)), won);
});
