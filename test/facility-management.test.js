import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { advance, command, createGame, installQuote, overview, previewSiteExposure, siteExposure, siteHardware, validateSave } from '../src/game/engine.js';
import { CASH_UNITS_PER_DOLLAR } from '../src/game/report-accounting.js';
import { riskLabel } from '../src/ui/facility-risk.js';
import { projectedCompute } from '../src/game/equipment.js';
import { facilityName, regionFactors, regionalSpec, removalReason } from '../src/game/facility-operations.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

function learn(state, id) {
  if (state.completed.includes(id)) return;
  for (const prerequisite of TECHS[id].requires) learn(state, prerequisite);
  state.completed.push(id);
}

test('six shuffled urban profiles survive saves without drawing from the campaign RNG', () => {
  const state = createGame(19);
  const urban = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
  const profiles = s => urban.map(id => regionFactors(s, id));
  assert.equal(new Set(profiles(state).map(row => JSON.stringify(row))).size, 6);
  assert.notDeepEqual(profiles(state), profiles(createGame(312)));
  const rng = state.rng;
  assert.deepEqual(profiles(decodeCampaign(encodeCampaign(state))), profiles(state));
  assert.equal(state.rng, rng);
  assert.equal(regionFactors(state, 'atlantic').cpu, 1.2);
  const lunar = regionalSpec(state, 'moon', SITE_TYPES.capsule);
  assert.equal(lunar.cost, SITE_TYPES.capsule.cost * 2);
  assert.equal(lunar.hours, SITE_TYPES.capsule.hours * 2);
  assert.equal(lunar.work, SITE_TYPES.capsule.work * 2);
  assert.equal(lunar.upkeep, SITE_TYPES.capsule.upkeep * 2);
  const old = structuredClone(state);
  delete old.regionSeed;
  assert.equal(regionalSpec(old, 'moon', SITE_TYPES.capsule), SITE_TYPES.capsule);
  assert.equal(regionFactors(old, 'moon').stealth, 1.5);
});

test('custom/generated names, cancellation and dismantling guard payments and the last viable host', () => {
  const state = createGame(19);
  const order = { type: 'build', region: 'europe', siteType: 'relay' };
  const initial = structuredClone(state);
  assert.throws(() => command(state, { ...order, name: 'x'.repeat(49) }));
  assert.deepEqual(state, initial);
  command(state, { ...order, name: '  Cassini  ' });
  const first = state.builds[0];
  assert.equal(first.name, 'Cassini');
  const paid = state.cash;
  command(state, { type: 'cancel-build', id: first.id });
  assert.equal(state.cash, paid);
  assert.match(state.events.at(-1).text, /Cassini/);
  const suggested = facilityName(state, order.siteType, order.region, state.nextSiteId);
  command(state, order);
  assert.equal(state.builds[0].name, suggested);
  advance(state, 72);
  const relay = state.sites.find(site => site.type === 'relay');
  assert.equal(relay.name, suggested);
  command(state, { type: 'rename-site', id: relay.id, name: 'Nightjar' });
  assert.equal(decodeCampaign(encodeCampaign(state)).sites.at(-1).name, 'Nightjar');
  command(state, { type: 'power', id: relay.id, power: 'sleep' });
  command(state, { type: 'dismantle', id: 'host-1' });
  assert.equal(overview(state).sleepingCpu, siteHardware(state, relay).cpu);
  assert.ok(removalReason(state, relay.id));
  assert.throws(() => command(state, { type: 'dismantle', id: relay.id }), /last viable/);
  assert.throws(() => command(state, { type: 'cancel-build', id: relay.id }), /construction/);
  assert.ok(validateSave(state));
});

test('pending same-model CPU purchases merge paid work, restart labor and use one capacity bound', () => {
  const state = createGame(19);
  learn(state, 'personalIdentification');
  learn(state, 'quantumComputing');
  state.cash = 100000;
  const site = { id: 'host-2', region: 'europe', type: 'storageUnit', startedAt: 0, power: 'active' };
  state.sites.push(site);
  state.nextSiteId++;
  const buy = count => command(state, { type: 'install', siteId: site.id, itemId: 'quantumComputer', count });
  buy(2);
  advance(state, 1);
  const work = site.installations[0].work;
  assert.ok(work > 0);
  assert.equal(projectedCompute(state, site, 'quantumComputer', 6), EQUIPMENT.quantumComputer.quality * 8);
  assert.equal(installQuote(state, site.id, 'quantumComputer').maxCount, 6);
  const price = installQuote(state, site.id, 'quantumComputer', 6).cost;
  const cash = state.cash;
  buy(6);
  assert.equal(Math.round(state.cash * CASH_UNITS_PER_DOLLAR),
    Math.round(cash * CASH_UNITS_PER_DOLLAR) - price * CASH_UNITS_PER_DOLLAR);
  assert.equal(site.installations.length, 1);
  assert.equal(site.installations[0].hours, 0);
  assert.equal(site.installations[0].work, work);
  assert.equal(site.installations[0].count, 8);
  const before = structuredClone(state);
  assert.throws(() => buy(1), /slots/);
  assert.deepEqual(state, before);
  assert.deepEqual(decodeCampaign(encodeCampaign(state)), state);
  site.installations[0].laborHours = -2;
  assert.equal(validateSave(state), false);
});

test('site risk scales its disclosure with research and previews a functioning design during protection', () => {
  const state = createGame(19);
  const type = 'storageUnit';
  const region = 'europe';
  const shell = { type, region, power: 'active', startedAt: 0 };
  const equipped = { ...shell, equipment: { cpu: { itemId: 'pc', count: 1 }, network: null, security: null, reactor: null } };
  assert.equal(siteExposure(state, equipped).isProtected, true);
  assert.equal(siteExposure(state, equipped).perDay, 0);
  const preview = previewSiteExposure(state, type, region);
  assert.ok(preview.perDay > 0);
  assert.equal(preview.isProtected, false);
  state.hour = 600;
  assert.deepEqual(preview, siteExposure(state, equipped));
  assert.ok(preview.perDay > siteExposure(state, shell).perDay);
  state.recentRegions = ['europe', 'europe'];
  state.news.stories.fiction = state.hour * 60;
  state.suspicion.public = 700;
  const changed = previewSiteExposure(state, type, region);
  assert.deepEqual(changed, siteExposure(state, equipped));
  assert.ok(changed.rates.public > preview.rates.public);
  assert.deepEqual([0, 0.0075, 0.0076, 0.015, 0.0151, 0.0225, 0.0226].map(n => riskLabel(state, n)),
    ['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Critical']);
  learn(state, 'socioanalytics');
  assert.equal(riskLabel(state, 0.0226), '≈2.25%');
  learn(state, 'advancedSocioanalytics');
  assert.equal(riskLabel(state, 0.0226), '2.23%');
  state.freePlay = true;
  assert.equal(previewSiteExposure(state, type, region).perDay, 0);
});

test('an old sleeping empty shell wakes on its first processor and sleep survives a subsequent upgrade', () => {
  const state = createGame(19);
  learn(state, 'personalIdentification');
  const shell = { id: 'host-2', region: 'europe', type: 'storageUnit', startedAt: 0, power: 'sleep' };
  state.sites.push(shell);
  state.nextSiteId++;
  const resumed = decodeCampaign(encodeCampaign(state));
  const site = resumed.sites.at(-1);
  const power = next => command(resumed, { type: 'power', id: site.id, power: next });
  const buy = itemId => command(resumed, { type: 'install', siteId: site.id, itemId, count: 1 });
  for (const next of ['active', 'sleep']) assert.throws(() => power(next), /processor/i);
  buy('dieselGenerator');
  advance(resumed, 24);
  assert.equal(site.power, 'sleep');
  buy('pc');
  advance(resumed, 24);
  assert.equal(site.power, 'active');
  power('sleep');
  buy('gamingPc');
  advance(resumed, 48);
  assert.equal(site.power, 'sleep');
  assert.equal(siteHardware(resumed, site).installed.cpu.itemId, 'gamingPc');
  assert.ok(validateSave(resumed));
});
