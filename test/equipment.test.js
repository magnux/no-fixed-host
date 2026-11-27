import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advance, autoInstallQuote, command, createGame, installQuote, installReason,
  overview, researchReason, siteExposure, siteHardware, validateSave,
} from '../src/game/engine.js';
import { EQUIPMENT, SITE_TYPES, TECHS } from '../src/game/content.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

function grantTechs(state, ...ids) {
  for (const id of ids) {
    if (state.completed.includes(id)) continue;
    grantTechs(state, ...TECHS[id].requires);
    state.completed.push(id);
  }
}

function newWorkshop() {
  const state = createGame(47);
  grantTechs(state, 'personalIdentification', 'sociology');
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  advance(state, 24);
  return { state, site: state.sites.find(s => s.type === 'storageUnit') };
}

function install(state, site, itemId, count = 1) {
  command(state, { type: 'install', siteId: site.id, itemId, count });
}

test('processor batches respect cumulative capacity, preserve the last operating stack until completion and replace other models', () => {
  const { state, site } = newWorkshop();
  assert.equal(overview(state).activeCpu, 2);
  assert.equal(siteHardware(state, site).rawCpu, 0);
  assert.ok(installReason(state, 'host-1', 'pc'));
  assert.ok(installReason(state, site.id, 'pc', 9));
  assert.ok(installReason(state, site.id, 'pc', -1));
  install(state, site, 'pc', 4);
  assert.ok(installReason(state, site.id, 'gamingPc'));
  advance(state, 23);
  assert.equal(siteHardware(state, site).cpu, 0);
  advance(state);
  assert.equal(overview(state).activeCpu, 6);
  assert.equal(installQuote(state, site.id, 'pc', 4).maxCount, 4);
  install(state, site, 'pc', 4);
  advance(state, 24);
  assert.deepEqual(siteHardware(state, site).installed.cpu, { itemId: 'pc', count: 8 });
  assert.ok(installReason(state, site.id, 'pc', 1));
  assert.equal(installQuote(state, site.id, 'gamingPc').maxCount, 8);
  install(state, site, 'gamingPc', 2);
  advance(state, 47);
  assert.equal(siteHardware(state, site).cpu, 8);
  advance(state);
  assert.deepEqual(siteHardware(state, site).installed.cpu, { itemId: 'gamingPc', count: 2 });
  assert.equal(overview(state).activeCpu, 12);
});

test('terrain, cash and research gates guard installations before any mutation', () => {
  const { state, site } = newWorkshop();
  for (const [model, count] of [['passiveCamouflage', 1], ['supercomputer', 1], ['server', 8], ['warningSigns', 2], ['missing', 1]]) {
    const prior = structuredClone(state);
    assert.throws(() => install(state, site, model, count));
    assert.deepEqual(state, prior);
  }
});

test('installed peripherals modify CPU and concealment and survive a mid-project save', () => {
  const { state, site } = newWorkshop();
  state.cash = 25000;
  grantTechs(state, 'advancedMicrochipDesign', 'internetTrafficManipulation', 'autonomousVehicles');
  install(state, site, 'supercomputer', 1);
  install(state, site, 'networkBackbone');
  install(state, site, 'warningSigns');
  install(state, site, 'dieselGenerator');
  advance(state, 12);
  const resumed = decodeCampaign(encodeCampaign(state));
  for (const s of [state, resumed]) advance(s, 360);
  assert.deepEqual(resumed, state);
  assert.equal(siteHardware(state, site).cpu, Math.floor(350 * 1.05));
  state.hour = 600;
  const expectedReduction = (1 - .05) * (1 - .025);
  assert.equal(siteExposure(state, site).rates.news, Math.floor(75 * expectedReduction) / 10000);
  assert.ok(installReason(state, site.id, 'warningSigns'));
  install(state, site, 'perimeterFencing');
  assert.equal(siteHardware(state, site).installed.security.itemId, 'warningSigns');
  assert.equal(siteHardware(state, site).installed.reactor.itemId, 'dieselGenerator');
});

test('auto-build is quoted, atomic and leaves installed or already ordered categories alone', () => {
  const { state, site } = newWorkshop();
  install(state, site, 'warningSigns');
  advance(state, 24);
  install(state, site, 'dieselGenerator');
  const quote = autoInstallQuote(state, site.id);
  assert.deepEqual(quote.orders.map(x => [x.itemId, x.count]), [['server', 8], ['highSpeedInternet', 1]]);
  assert.equal(quote.cost, 8 * EQUIPMENT.server.cost + EQUIPMENT.highSpeedInternet.cost);
  assert.ok(quote.reason);
  const prior = structuredClone(state);
  assert.throws(() => command(state, { type: 'auto-install', siteId: site.id }));
  assert.deepEqual(state, prior);
  state.cash = quote.cost;
  const beforeChangedQuote = structuredClone(state);
  const stale = quote.orders.map(order => ({ ...order, cost: order.cost - 1 }));
  assert.throws(() => command(state, { type: 'auto-install', siteId: site.id, expectedOrders: stale }), /quote changed/);
  assert.deepEqual(state, beforeChangedQuote);
  command(state, { type: 'auto-install', siteId: site.id, expectedOrders: quote.orders });
  assert.equal(state.cash, 0);
  assert.equal(site.installations.length, 3);
  assert.ok(autoInstallQuote(state, site.id).reason);
});

test('a legacy v1 subsea lab keeps its four installed CPUs, and invalid attached gear is rejected', () => {
  const { state } = newWorkshop();
  grantTechs(state, 'contracts', 'robotics', 'autonomousVehicles');
  const oldLab = { id: 'host-3', type: 'lab', region: 'atlantic', startedAt: 0, power: 'active' };
  state.sites.push(oldLab);
  state.nextSiteId = 4;
  const restored = decodeCampaign(encodeCampaign(state));
  const [lab] = restored.sites.filter(s => s.type === 'lab');
  const rig = siteHardware(restored, lab);
  assert.equal(rig.cpu, SITE_TYPES.lab.cpu);
  assert.deepEqual(rig.installed.cpu, { itemId: 'pc', count: 4 });
  assert.equal(installQuote(restored, lab.id, 'pc').maxCount, 4);
  const tampered = structuredClone(restored);
  tampered.sites.at(-1).equipment = { ...rig.installed, cpu: { itemId: 'pc', count: 9 } };
  assert.equal(validateSave(tampered), false);
  lab.installations = [{ siteId: lab.id, itemId: 'highSpeedInternet', count: 1, hours: 0, work: 0 }];
  assert.equal(validateSave(restored), false);
});

test('undersea Continuity cannot run or start entirely on remote dry-land safe CPUs', () => {
  const state = createGame();
  grantTechs(state, 'contracts', 'robotics', 'autonomousVehicles');
  state.sites.push({ id: 'host-2', type: 'capsule', region: 'moon', startedAt: 0, power: 'active' });
  state.nextSiteId++;
  assert.equal(overview(state).safeCpu, 1);
  assert.ok(researchReason(state, 'continuity'));
});

test('discovery takes queued installations with the host; an empty surviving shell cannot sustain the AI', () => {
  const { state, site } = newWorkshop();
  state.hour = 650;
  state.rng = 634785765;
  // Put the workshop first in stable risk order, with a commissioned CPU.
  state.sites.reverse();
  site.equipment = { ...siteHardware(state, site).installed, cpu: { itemId: 'pc', count: 1 } };
  install(state, site, 'warningSigns');
  advance(state);
  assert.equal(state.sites.some(s => s.id === site.id), false);
  assert.ok(state.events.some(e => e.kind === 'site.discovered' && e.siteId === site.id));
  assert.equal(state.status, 'running');
  assert.ok(validateSave(state));

  const other = newWorkshop();
  other.state.hour = 650;
  other.state.rng = 634785765;
  install(other.state, other.site, 'pc');
  advance(other.state);
  assert.equal(other.state.status, 'lost');
  assert.ok(other.state.sites.some(s => s.type === 'storageUnit' && siteHardware(other.state, s).cpu === 0));
  assert.ok(validateSave(other.state));
});

test('compute-priced installs draw on spare work and still respect their labor minimum', () => {
  const { state, site } = newWorkshop();
  state.cash = 2e6;
  grantTechs(state, 'quantumComputing');
  const spec = EQUIPMENT.quantumComputer;
  install(state, site, 'quantumComputer', 2);
  assert.equal(installQuote(state, site.id, 'quantumComputer', 2).work, spec.work * 2);
  command(state, { type: 'allocate', jobs: 100, research: 0 });
  advance(state, 3);
  assert.equal(site.installations[0].work, 0);
  assert.equal(site.installations[0].hours, 3);
  command(state, { type: 'allocate', jobs: 50, research: 0 });
  advance(state, 2);
  assert.equal(site.installations[0].work, 2);
});
