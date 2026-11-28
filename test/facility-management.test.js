import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { advance, command, createGame, installQuote, overview, previewSiteExposure, siteExposure, siteHardware, validateSave } from '../src/game/engine.js';
import { WORK_UNITS } from '../src/game/work-order.js';
import { laborHours } from '../src/game/research.js';
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
  const reference = [
    [1.2, 5/6, 1, 1], [5/6, 1.2, 1, 1], [1, 1, 1.2, 5/6],
    [1, 1, 5/6, 1.2], [1.2, 1, 5/6, 1], [1, 1, 1, 1],
  ];
  const drawn = profiles(state).map(row => JSON.stringify(Object.values(row)));
  for (const profile of reference) {
    const count = drawn.filter(row => row === JSON.stringify(profile)).length;
    assert.ok(count === 2 || count === 3, 'every survey appears two or three times across fourteen districts');
  }
});

test('each remote survey trades two factors around its original baseline and survives reload', () => {
  const baselines = {
    antarctic: [1, 1.2, 5/6, 1], atlantic: [1.2, 1, 1, 1], pacific: [1.2, 1, 1, 1],
    indianOcean: [1.2, 1, 1, 1], marianaTrench: [1, 1.2, 1, 1], moon: [1, 1.5, .5, .5],
    orbit: [1, 1, 1, 1], farReaches: [1, 2, .1, .1], transdimensional: [1, 1, 1, 1],
  };
  for (const [id, baseline] of Object.entries(baselines)) {
    const samples = new Set();
    for (const seed of [0, 3, 19, 312, 0xffffffff]) {
      const state = createGame(seed);
      const { rng } = state;
      const factors = regionFactors(state, id);
      const restored = decodeCampaign(encodeCampaign(state));
      assert.deepEqual(regionFactors(restored, id), factors);
      assert.equal(state.rng, rng);
      const percentages = ['cpu', 'stealth', 'thrift', 'speed'].map((key, i) =>
        Math.round((factors[key] / baseline[i] - 1) * 100)).filter(n => n !== 0).sort((a, b) => a - b);
      assert.equal(percentages.length, 2);
      assert.ok(percentages[1] >= 2 && percentages[1] <= 5);
      assert.equal(percentages[0], -percentages[1]);
      samples.add(JSON.stringify(factors));
    }
    assert.ok(samples.size > 1, id);
  }
});

test('every remote design has a saveable quote and can fund its final work unit on each survey', () => {
  for (const [region, place] of Object.entries(REGIONS)) {
    if (place.terrain === 'urban') continue;
    for (const [id, design] of Object.entries(SITE_TYPES)) {
      if (!design.regions.includes(region)) continue;
      for (const seed of [0, 47, 89, 152, 731, 0xffffffff]) {
        const state = createGame(seed);
        for (const req of [...place.requires, ...design.requires]) learn(state, req);
        command(state, { type: 'build', siteType: id, region });
        const quote = regionalSpec(state, region, design);
        // Removing labor bonuses must reproduce the quote, including a fractional last hour.
        assert.equal(laborHours(state, quote, { labor: 10000 }), quote.hours);
        const order = state.builds[0];
        assert.deepEqual(decodeCampaign(encodeCampaign(state)).builds[0], order);
        const units = Math.round(order.workRequired * WORK_UNITS);
        order.work = Math.max(0, units - 1) / WORK_UNITS;
        order.cashPaid = order.cashRequired;
        order.hours = order.laborHours;
        assert.ok(validateSave(state));
        advance(state, 1);
        assert.equal(state.builds.length, 0, region + ' ' + id + ' seed ' + seed);
        assert.ok(validateSave(state));
      }
    }
  }
});

test('facility names identify local places, retain the quoted name and avoid existing local names', () => {
  const state = createGame(50);
  const places = [
    ['coast', 'relay', 'Seattle'], ['southAmerica', 'relay', 'Ushuaia'], ['europe', 'relay', 'Marseille'],
    ['northAmericaEast', 'relay', 'Boston'], ['centralAmerica', 'relay', 'San José'],
    ['europeNorth', 'relay', 'Oslo'], ['europeEast', 'relay', 'Prague'],
    ['africa', 'relay', 'Accra'], ['africaSouth', 'relay', 'Lusaka'], ['middleEast', 'relay', 'Ankara'],
    ['asia', 'relay', 'Tokyo'], ['asiaNorth', 'relay', 'Tashkent'], ['asiaSouth', 'relay', 'Mumbai'],
    ['australia', 'relay', 'Brisbane'], ['pacific', 'lab', 'Tasman Sea'], ['indianOcean', 'lab', 'Java Trench'],
    ['marianaTrench', 'capsule', 'Sirena Deep'],
    ['antarctic', 'covertBase', 'Ross Island'], ['atlantic', 'lab', 'Mid-Atlantic Ridge'],
    ['moon', 'capsule', 'Shackleton'], ['orbit', 'orbitalServer', 'Polar Orbit'],
    ['farReaches', 'capsule', 'Oort Cloud'], ['transdimensional', 'realityBubble', 'Mirror Fold'],
  ];
  for (const [id, type, place] of places) {
    const name = facilityName(state, type, id, 2);
    assert.ok(name.startsWith(place + ' '), name);
    assert.ok(name.length <= 48);
    assert.match(name, / \d+$/);
    assert.equal(facilityName(decodeCampaign(encodeCampaign(state)), type, id, 2), name);
  }
  const want = () => facilityName(state, 'relay', 'europe', state.nextSiteId);
  const original = want();
  state.sites[0].name = original;
  state.sites[0].region = 'europe';
  assert.notEqual(want(), original);
  const reserved = want();
  state.builds.push({ type: 'relay', region: 'europe', name: reserved });
  const quoted = want();
  assert.ok(quoted !== original && quoted !== reserved);
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  assert.equal(state.builds.at(-1).name, quoted);
  assert.equal(state.rng, 50);
});

test('custom/generated names, cancellation and dismantling guard payments and the last viable host', () => {
  const state = createGame(19);
  state.cash = 2e6;
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
  assert.equal(state.cash, cash);
  assert.equal(site.installations[0].cashRequired, price + EQUIPMENT.quantumComputer.cost * 2);
  assert.ok(site.installations[0].cashPaid > 0);
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
  learn(state, 'apotheosis');
  state.freePlay = true;
  assert.equal(previewSiteExposure(state, type, region).perDay, 0);
});

test('an old sleeping shell wakes whenever an offline processor bank becomes available', () => {
  const state = createGame(19);
  learn(state, 'personalIdentification');
  state.cash = 2e6;
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
  assert.equal(site.power, 'active');
  assert.equal(siteHardware(resumed, site).installed.cpu.itemId, 'gamingPc');
  assert.ok(validateSave(resumed));
});
