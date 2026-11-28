import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, campaignMinutes, command, createGame, log, previewSiteExposure, validateSave } from '../src/game/engine.js';
import { publicCampaignQuote, recordScientificCase, scientificStudyQuote, studyCases } from '../src/game/interventions.js';
import { projectResources } from '../src/game/reports.js';
import { minutesToMidnight } from '../src/game/calendar.js';
import { geographyRoll } from '../src/game/geography.js';

const DAY = 1440;
const firstRollZero = 634785765;
const afterGrace = 25 * DAY;
const elapsed = (s, value) => { s.hour = Math.floor(value / 60); s.minute = value % 60; };

function subject(state, region = 'moon') {
  const event = log(state, 'site.discovered', 'Scientists reported a signal at the test site.', {
    group: 'science', region, siteId: 'host-2', siteType: 'lunarFacility', siteName: 'Signal observatory',
  });
  recordScientificCase(state, event);
  return event.id;
}

function quiet(seed = 1) {
  const s = createGame(seed);
  elapsed(s, afterGrace);
  s.cash = 500_000;
  s.sandbox = { detection: false, analysis: 'none' };
  s.completed.push('sociology', 'mediaManipulation');
  return s;
}

test('public campaign accelerates seven midnight decays and each commission has an independent 30-day clock', () => {
  const s = quiet();
  const caseId = subject(s);
  const otherCase = subject(s);
  assert.equal(publicCampaignQuote(s).reason, '');
  command(s, {type:'launch-campaign'});
  const stop = publicCampaignQuote(s).availableAt;
  assert.equal(stop, afterGrace + 30 * DAY);
  assert.match(publicCampaignQuote(s).reason, /Cooldown/);
  assert.equal(scientificStudyQuote(s, caseId).reason, '');
  s.suspicion.public = 6000;
  advanceMinutes(s, 100);
  command(s, {type:'commission-study', caseId});
  assert.equal(scientificStudyQuote(s, otherCase).availableAt, stop + 100);
  assert.match(scientificStudyQuote(s, caseId).reason, /already/);
  const seventhMidnight = afterGrace + minutesToMidnight(afterGrace) + 6 * DAY;
  advanceMinutes(s, seventhMidnight - campaignMinutes(s));
  assert.equal(s.suspicion.public, 4512);
  assert.equal(s.interventions.campaign, null);
  assert.equal(validateSave(s), true);
  advanceMinutes(s, stop - campaignMinutes(s));
  assert.equal(publicCampaignQuote(s).reason, '');
  assert.match(scientificStudyQuote(s, otherCase).reason, /Cooldown/);
  advanceMinutes(s, 100);
  assert.equal(scientificStudyQuote(s, otherCase).reason, '');
  assert.match(scientificStudyQuote(s, caseId).reason, /already/);
  assert.equal(studyCases(s).at(-1).reviewed, true);
});

test('public sponsorship exposure records its evidence exactly once without losing a host', () => {
  let s;
  for (let seed = 1; seed < 1000; seed++) {
    s = quiet(seed);
    command(s, {type:'launch-campaign'});
    if (geographyRoll(seed, 'campaign/' + afterGrace + '/story') / 0x100000000 < 0.2) break;
  }
  const key = 'campaign/' + afterGrace;
  const group = geographyRoll(s.regionSeed, key + '/group') / 0x100000000 < 0.5 ? 'news' : 'covert';
  const untilExposure = Math.floor(geographyRoll(s.regionSeed, key + '/time') / 0x100000000 * (s.interventions.campaign.endsAt - afterGrace));
  assert.ok(!Object.hasOwn(s.interventions.campaign, 'exposeAt'));
  advanceMinutes(s, untilExposure);
  const copy = structuredClone(s);
  advanceMinutes(s, 1);
  advanceMinutes(copy, 1);
  assert.deepEqual(s, copy);
  assert.equal(s.interventions.cases.length, 0);
  assert.equal(s.sites.length, 1);
  assert.equal(s.events.filter(event => event.kind === 'news.expose').length, 1);
  assert.ok(s.suspicion[group] >= 295);
  advanceMinutes(s, 7 * DAY);
  assert.equal(s.events.filter(event => event.kind === 'news.expose').length, 1);
});

test('a case-bound study changes only regional future scientific exposure for 14 days and preserves evidence', () => {
  const seen = new Set();
  for (let seed = 1; seen.size < 3 && seed < 100; seed++) {
    const s = quiet(seed);
    delete s.sandbox;
    const caseId = subject(s);
    command(s, {type:'commission-study', caseId});
    const study = s.interventions.study;
    assert.equal(study.outcome, null);
    const baseline = previewSiteExposure(s, 'lunarFacility', 'moon').rates;
    const elsewhere = previewSiteExposure(s, 'scientificOutpost', 'farReaches').rates.science;
    // End the actual seven-day interval one minute from now, without changing its terms.
    elapsed(s, study.publishesAt - 1);
    assert.ok(validateSave(s));
    advanceMinutes(s, 1);
    assert.equal(s.suspicion.science, 0);
    assert.equal(s.events.at(-1).outcome, study.outcome);
    seen.add(study.outcome);
    const effective = previewSiteExposure(s, 'lunarFacility', 'moon').rates;
    const factor = { explained: 0.75, inconclusive: 1, corroborated: 1.25 }[study.outcome];
    assert.equal(effective.science, baseline.science * factor);
    for (const group of ['news', 'covert', 'public']) assert.equal(effective[group], baseline[group]);
    assert.equal(previewSiteExposure(s, 'scientificOutpost', 'farReaches').rates.science, elsewhere);
    elapsed(s, study.expiresAt - 1);
    advanceMinutes(s, 1);
    assert.equal(s.interventions.study, null);
    assert.deepEqual(previewSiteExposure(s, 'lunarFacility', 'moon').rates, baseline);
    assert.deepEqual(studyCases(s).map(c => c.id), [caseId]);
  }
  assert.equal(seen.size, 3);
});

function tipFixture(accepted, offset = 0) {
  const at = afterGrace + offset + 1;
  const key = 'private-tip/' + at + '/host-1/news';
  for (let seed = 1; seed < 10000; seed++) {
    if (geographyRoll(seed, key + '/offer') / 0x100000000 >= .10 ||
      (geographyRoll(seed, key + '/outcome') / 0x100000000 < .60) !== accepted) continue;
    const state = createGame(seed);
    elapsed(state, at - 1);
    state.rng = firstRollZero;
    state.cash = 10_000;
    return state;
  }
  assert.fail('No matching incident in fixture range');
}

test('unfiled urban tip interrupts fast playback and a declined or paid refusal completes the real discovery minute', () => {
  const s = tipFixture(false, minutesToMidnight(afterGrace) - 1);
  s.suspicion.covert = 500;
  const baseline = structuredClone(s);
  advanceMinutes(baseline, 1, {tipPolicy:'decline'});
  const start = campaignMinutes(s);
  advanceMinutes(s, 10080);
  assert.equal(campaignMinutes(s), start + 1);
  assert.equal(s.status, 'running');
  assert.equal(s.lastDiscovery, null);
  assert.equal(s.interventions.tip.price, 1000);
  assert.ok(validateSave(s));
  assert.throws(() => command(s, {type:'power', id:'host-1', power:'sleep'}), /open tip/);
  const refused = JSON.parse(JSON.stringify(s));
  const paused = structuredClone(s);
  const forecast = projectResources(s);
  assert.equal(forecast.end, forecast.start);
  assert.equal(forecast.cash.net, 0);
  assert.equal(forecast.planCash.net, 0);
  assert.ok(!Object.hasOwn(s.interventions.tip, 'accepted'));
  advanceMinutes(s, DAY);
  assert.deepEqual(s, paused);
  command(s, {type:'resolve-tip',siteId:'host-1',pay:false});
  assert.equal(s.status, 'lost');
  assert.deepEqual(s.suspicion, baseline.suspicion);
  assert.deepEqual(s.news, baseline.news);
  assert.equal(s.rng, baseline.rng);
  assert.deepEqual(s.recentRegions, baseline.recentRegions);
  assert.equal(s.cash, baseline.cash);
  command(refused, {type:'resolve-tip',siteId:'host-1',pay:true});
  assert.equal(refused.events.find(e => e.kind === 'news.tip-result').outcome, 'refused');
  assert.equal(refused.suspicion.covert, 693);
  assert.equal(refused.status, 'lost');
  assert.equal(Math.round(s.cash - refused.cash), 1000);
  assert.ok(validateSave(refused));
});

test('accepted payoff preserves one site and its history, cannot be retried and starts a seven-day offer cooldown', () => {
  const s = tipFixture(true);
  advanceMinutes(s, 400);
  const {siteId, at} = s.interventions.tip;
  const evidence = {...s.suspicion};
  command(s, {type:'resolve-tip',siteId,pay:true});
  assert.deepEqual(s.suspicion, evidence);
  assert.equal(s.sites.length, 1);
  assert.equal(s.lastDiscovery, null);
  assert.equal(s.interventions.tipAvailableAt, at + 7 * DAY);
  assert.throws(() => command(s, {type:'resolve-tip',siteId,pay:true}), /no longer/);
  assert.ok(validateSave(s));
  s.rng = firstRollZero;
  advanceMinutes(s);
  assert.equal(s.interventions.tip, null);
  assert.equal(s.status, 'lost');
});

test('an upkeep failure and simultaneous discovery settle without offering the otherwise eligible single-site tip', () => {
  // Successive production RNG outputs are 17453 and 87976 / 2^32. The first
  // misses a CPU bill and the second finds the highly exposed warehouse.
  const forcedRolls = 2329542278;
  for (let seed = 1; seed < 1000; seed++) {
    const s = quiet(seed);
    delete s.sandbox;
    const group = 'news';
    const key = 'private-tip/' + (afterGrace + 1) + '/host-3/' + group;
    if (geographyRoll(seed, key + '/offer') / 0x100000000 >= .10) continue;
    s.rng = forcedRolls;
    const survivor = s.sites[0];
    const warehouse = { id:'host-3', type:'largeWarehouse', region:'europe', power:'active', startedAt:0,
      equipment: { cpu: { itemId:'pc', count:1 }, reactor:null, network:null, security:null } };
    s.sites = [{id:'host-2',type:'lunarFacility',region:'moon',power:'active',startedAt:0}, warehouse, survivor];
    s.nextSiteId = 4;
    s.suspicion.news = 8980;
    s.recentRegions = ['europe','europe'];
    if (previewSiteExposure(s, 'largeWarehouse', 'europe').rates.news < .02951) continue;
    advanceMinutes(s);
    assert.ok(s.events.some(event => event.siteId === 'host-2' && event.kind === 'site.failed'));
    assert.equal(s.lastDiscovery.siteId, 'host-3');
    assert.deepEqual(s.sites.map(site => site.id), ['host-1']);
    assert.equal(s.interventions.tip, null);
    return;
  }
  assert.fail('No eligible deterministic simultaneous fixture');
});

test('a real Scientists discovery adds a selectable case that survives journal rotation', () => {
  const s = quiet();
  delete s.sandbox;
  const survivor = s.sites[0];
  s.sites = [{id:'host-2',type:'capsule',region:'moon',power:'active',startedAt:0}, survivor];
  s.nextSiteId = 3;
  // Let the region-adjusted construction grace expire. The capsule's first hazard is Scientists.
  elapsed(s, 100 * DAY);
  s.rng = firstRollZero;
  advanceMinutes(s);
  assert.equal(s.lastDiscovery.group, 'science');
  const [entry] = studyCases(s);
  assert.equal(entry.id, s.lastDiscovery.id);
  for (let index = 0; index < 1000; index++) log(s, 'journal.note', 'Later entry');
  assert.ok(!s.events.some(event => event.id === entry.id));
  command(s, {type:'commission-study', caseId:entry.id});
  assert.equal(s.interventions.study.region, 'moon');
  assert.equal(s.events.at(-1).cashFlow, -50_000);
});
