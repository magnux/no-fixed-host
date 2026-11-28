import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advance, autoInstallQuote, autoUpgradeQuote, command, createGame, equipmentRank, hostRank, installQuote, installReason,
  overview, researchReason, siteExposure, siteHardware, validateSave,
} from '../src/game/engine.js';
import { EQUIPMENT, SITE_TYPES, TECHS } from '../src/game/content.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';
import { projectResources } from '../src/game/reports.js';

function grantTechs(state, ...ids) {
  for (const id of ids) {
    if (state.completed.includes(id)) continue;
    grantTechs(state, ...TECHS[id].requires);
    state.completed.push(id);
  }
}

function newWorkshop() {
  const state = createGame(47);
  state.cash = 2e6;
  grantTechs(state, 'personalIdentification', 'sociology');
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  advance(state, 24);
  return { state, site: state.sites.find(s => s.type === 'storageUnit') };
}

function install(state, site, itemId, count = 1) {
  command(state, { type: 'install', siteId: site.id, itemId, count });
}

test('expanding and replacing a processor stack takes the bank offline and respects slot capacity', () => {
  const { state, site } = newWorkshop();
  const backupCpu = overview(state).activeCpu;
  assert.equal(siteHardware(state, site).rawCpu, 0);
  assert.ok(installReason(state, 'host-1', 'pc'));
  assert.ok(installReason(state, site.id, 'pc', 9));
  assert.ok(installReason(state, site.id, 'pc', -1));
  install(state, site, 'pc', 4);
  assert.ok(installReason(state, site.id, 'gamingPc'));
  advance(state, 23);
  assert.equal(siteHardware(state, site).cpu, 0);
  advance(state);
  assert.equal(overview(state).activeCpu, backupCpu + 4);
  assert.equal(installQuote(state, site.id, 'pc', 4).maxCount, 4);
  install(state, site, 'pc', 4);
  assert.equal(siteHardware(state, site).rawCpu, 0);
  assert.equal(overview(state).activeCpu, backupCpu);
  advance(state, 24);
  assert.deepEqual(siteHardware(state, site).installed.cpu, { itemId: 'pc', count: 8 });
  assert.ok(installReason(state, site.id, 'pc', 1));
  assert.equal(installQuote(state, site.id, 'gamingPc').maxCount, 8);
  install(state, site, 'gamingPc', 2);
  advance(state, 47);
  assert.equal(siteHardware(state, site).cpu, 0);
  assert.deepEqual(siteHardware(state, site).offlineSlots, ['cpu']);
  advance(state);
  assert.deepEqual(siteHardware(state, site).installed.cpu, { itemId: 'gamingPc', count: 2 });
  assert.equal(overview(state).activeCpu, backupCpu + 10);
});

test('terrain, capacity and research gates guard installations before any mutation', () => {
  const { state, site } = newWorkshop();
  for (const [model, count] of [['passiveCamouflage', 1], ['supercomputer', 1], ['server', 9], ['warningSigns', 2], ['missing', 1]]) {
    const prior = structuredClone(state);
    assert.throws(() => install(state, site, model, count));
    assert.deepEqual(state, prior);
  }
});

test('installed peripherals modify CPU and concealment and survive a mid-project save', () => {
  const { state, site } = newWorkshop();
  state.cash = 2e6;
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
  assert.equal(siteHardware(state, site).exposureFactor, 0.975);
  assert.equal(siteHardware(state, site).cpu, Math.floor(350 * 1.05));
  install(state, site, 'highSpeedInternet');
  assert.equal(siteHardware(state, site).networkBonus, 0);
  assert.equal(siteHardware(state, site).cpu, 350);
  const preview = decodeCampaign(encodeCampaign(state));
  assert.deepEqual(siteHardware(preview, preview.sites.at(-1)).offlineSlots, ['security', 'network']);
});

test('auto-build is quoted, atomic and leaves installed or already ordered categories alone', () => {
  const { state, site } = newWorkshop();
  install(state, site, 'warningSigns');
  advance(state, 24);
  install(state, site, 'dieselGenerator');
  const quote = autoInstallQuote(state, site.id);
  assert.deepEqual(quote.orders.map(x => [x.itemId, x.count]), [['server', 8], ['highSpeedInternet', 1]]);
  assert.equal(quote.cost, 8 * EQUIPMENT.server.cost + EQUIPMENT.highSpeedInternet.cost);
  assert.equal(quote.reason, '');
  state.cash = 0;
  const beforeChangedQuote = structuredClone(state);
  const stale = quote.orders.map(order => ({ ...order, cost: order.cost - 1 }));
  assert.throws(() => command(state, { type: 'auto-install', siteId: site.id, expectedOrders: stale }), /quote changed/);
  assert.deepEqual(state, beforeChangedQuote);
  command(state, { type: 'auto-install', siteId: site.id, expectedOrders: quote.orders });
  assert.equal(state.cash, 0);
  assert.equal(site.installations.length, 3);
  assert.equal(site.installations.every(row => row.cashPaid === 0), true);
  const edited = structuredClone(state);
  edited.sites.at(-1).installations[0].cashRequired = 0;
  assert.equal(validateSave(edited), false);
  assert.ok(autoInstallQuote(state, site.id).reason);
});

test('orbital builds need satellite access and the orbital capsule also needs preservation research', () => {
  const state = createGame(47);
  const build = siteType => command(state, { type: 'build', region: 'orbit', siteType });
  assert.throws(() => build('orbitalServer'), /Leech Satellite/);
  grantTechs(state, 'knowledgePreservation');
  assert.throws(() => build('capsule'), /Leech Satellite/);
  const accessible = createGame(47);
  grantTechs(accessible, 'leechSatellite');
  assert.throws(() => command(accessible, { type: 'build', region: 'orbit', siteType: 'capsule' }), /Knowledge Preservation/);
  grantTechs(state, 'leechSatellite');
  build('capsule');
  assert.throws(() => command(state, { type: 'build', region: 'moon', siteType: 'orbitalServer' }), /compatible region/);
  assert.equal(decodeCampaign(encodeCampaign(state)).builds[0].type, 'capsule');
  state.sandbox = { analysis: false, detection: false };
  command(state, { type: 'developer', operation: 'construction' });
  advance(state);
  const capsule = state.sites.find(site => site.region === 'orbit');
  assert.equal(siteHardware(state, capsule).rawCpu, 1);
  assert.match(installReason(state, capsule.id, 'server'), /fixed hardware/);
  command(state, { type: 'power', id: capsule.id, power: 'sleep' });
  assert.equal(decodeCampaign(encodeCampaign(state)).sites.find(site => site.id === capsule.id).power, 'sleep');
});

test('an orbital server commissions, accepts two processors and orbital gear, and rejects terrestrial fittings', () => {
  const { state, site: workshop } = newWorkshop();
  state.sandbox = { analysis: false, detection: false };
  grantTechs(state, 'leechSatellite', 'clusterNetworking', 'solarCollectors', 'autonomousVehicles', 'advancedHeatSignatureReduction', 'quantumComputing');
  workshop.equipment = { cpu: { itemId: 'quantumComputer', count: 4 }, network: null, reactor: null, security: null };
  command(state, { type: 'build', siteType: 'orbitalServer', region: 'orbit' });
  assert.ok(decodeCampaign(encodeCampaign(state)).builds.some(build => build.type === 'orbitalServer'));
  advance(state, Math.ceil(state.builds[0].laborHours) + 1);
  const site = state.sites.find(host => host.type === 'orbitalServer');
  assert.ok(site);
  assert.equal(siteHardware(state, site).rawCpu, 0);
  const quote = autoInstallQuote(state, site.id);
  assert.ok(quote.orders.every(order => EQUIPMENT[order.itemId].regions.includes('orbit')));
  assert.equal(quote.orders.find(order => EQUIPMENT[order.itemId].slot === 'security').itemId, 'heatsink');
  assert.throws(() => install(state, site, 'server', 3), /quantity exceeds/i);
  for (const itemId of ['warningSigns', 'perimeterFencing', 'armedGuards', 'hypnosisField', 'groundSourceHeatsink', 'highSpeedInternet', 'networkBackbone', 'dieselGenerator']) {
    assert.throws(() => install(state, site, itemId), /unavailable in this environment/i);
  }
  for (const itemId of ['server', 'interconnectionSwitch', 'solarCollector', 'passiveCamouflage']) {
    install(state, site, itemId, itemId === 'server' ? 2 : 1);
  }
  advance(state, 120);
  assert.equal(siteHardware(state, site).rawCpu, 20);
  assert.equal(siteHardware(state, site).networkBonus, 200);
  assert.equal(overview(state).tiers[1], siteHardware(state, site).cpu);
  assert.equal(overview(state).tiers[2], 0);
  const restored = decodeCampaign(encodeCampaign(state));
  const refit = restored.sites.find(host => host.id === site.id);
  assert.equal(siteHardware(restored, refit).installed.security.itemId, 'passiveCamouflage');
  refit.equipment.security.itemId = 'groundSourceHeatsink';
  assert.equal(validateSave(restored), false);
});

test('a new subsea lab has eight empty bays and rejects incompatible gear', () => {
  const { state } = newWorkshop();
  grantTechs(state, 'contracts', 'robotics', 'autonomousVehicles');
  const shell = { id: 'host-3', type: 'lab', region: 'atlantic', startedAt: 0, power: 'active' };
  state.sites.push(shell);
  state.nextSiteId = 4;
  const restored = decodeCampaign(encodeCampaign(state));
  const [lab] = restored.sites.filter(s => s.type === 'lab');
  const rig = siteHardware(restored, lab);
  assert.equal(rig.cpu, SITE_TYPES.lab.cpu);
  assert.equal(rig.installed.cpu, null);
  assert.equal(installQuote(restored, lab.id, 'pc').maxCount, 8);
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

test('discovery takes queued installations with the host; a surviving host with its processor bank offline cannot sustain the AI', () => {
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
  other.site.equipment = { ...siteHardware(other.state, other.site).installed, cpu: { itemId: 'pc', count: 1 } };
  install(other.state, other.site, 'pc');
  assert.equal(siteHardware(other.state, other.site).rawCpu, 0);
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
  assert.equal(site.installations[0].hours, 0);
  command(state, { type: 'allocate', jobs: 50, research: 0 });
  advance(state, 2);
  assert.equal(site.installations[0].work, overview(state).activeCpu);
});

test('auto-upgrade replaces only researched stronger occupied gear, preserving bank count and funding terms', () => {
  const { state, site } = newWorkshop();
  site.equipment = {
    cpu: { itemId: 'gamingPc', count: 3 }, network: null,
    reactor: { itemId: 'dieselGenerator', count: 1 }, security: { itemId: 'warningSigns', count: 1 },
  };
  grantTechs(state, 'autonomousVehicles', 'fuelOxidation');
  install(state, site, 'perimeterFencing');
  const quote = autoUpgradeQuote(state, site.id);
  assert.equal(quote.reason, '');
  assert.deepEqual(quote.orders.map(({ itemId, count }) => [itemId, count]), [['mainframe', 3], ['fuelCell', 1]]);
  assert.equal(quote.cost, EQUIPMENT.mainframe.cost * 3 + EQUIPMENT.fuelCell.cost);
  const before = structuredClone(state);
  const candidate = { type: 'auto-upgrade', siteId: site.id, expectedOrders: quote.orders };
  const forecast = projectResources(state, '24h', candidate);
  assert.ok(forecast.cpu.active < projectResources(state, '24h').cpu.active);
  assert.deepEqual(state, before, 'forecast isolates downstream cash, CPU and exposure');
  assert.throws(() => command(state, { ...candidate, expectedOrders: quote.orders.slice(1) }), /quote changed/);
  assert.deepEqual(state, before);
  command(state, candidate);
  assert.equal(state.cash, before.cash);
  assert.equal(siteHardware(state, site).rawCpu, 0);
  assert.equal(siteHardware(state, site).exposureFactor, 1);
  const submitted = structuredClone(state);
  assert.ok(autoUpgradeQuote(state, site.id).reason);
  assert.throws(() => command(state, candidate), /quote changed/);
  assert.deepEqual(state, submitted);
  advance(state, EQUIPMENT.fuelCell.hours);
  assert.deepEqual(site.equipment.cpu, { itemId: 'mainframe', count: 3 });
  assert.equal(site.equipment.reactor.itemId, 'fuelCell');
  assert.equal(site.equipment.security.itemId, 'perimeterFencing');
  assert.equal(site.equipment.network, null);
  assert.ok(autoUpgradeQuote(state, site.id).reason);
});

test('the final processor bank cannot be refitted singly or via a package until a backup can sustain the AI', () => {
  const { state, site } = newWorkshop();
  site.equipment = { ...siteHardware(state, site).installed, cpu: { itemId: 'pc', count: 2 } };
  const backup = state.sites.shift();
  for (const itemId of ['pc', 'server']) {
    assert.match(installReason(state, site.id, itemId), /last viable host/);
    assert.throws(() => install(state, site, itemId), /last viable host/);
  }
  const prior = structuredClone(state);
  assert.match(autoUpgradeQuote(state, site.id).reason, /last viable host/);
  assert.throws(() => command(state, { type: 'auto-upgrade', siteId: site.id }), /last viable host/);
  assert.deepEqual(state, prior);
  backup.power = 'sleep';
  state.sites.push(backup);
  install(state, site, 'pc');
  assert.equal(siteHardware(state, site).rawCpu, 0);
  assert.equal(site.installations[0].cashRequired, EQUIPMENT.pc.cost);
  assert.ok(validateSave(state));
});

test('equipment and host ranks reflect installed performance, fixed chassis and empty slots', () => {
  const { state, site } = newWorkshop();
  assert.equal(equipmentRank('pc'), 1);
  assert.equal(equipmentRank('quantumComputer3'), 5);
  assert.equal(equipmentRank('perimeterFencing'), equipmentRank('passiveCamouflage'));
  assert.equal(equipmentRank(null), 0);
  assert.equal(hostRank(site), 0);
  assert.equal(hostRank(state.sites[0]), equipmentRank(SITE_TYPES.seed.fixedCpu));
  const mk3 = { itemId: 'quantumComputer3', count: 1 };
  site.equipment = { ...siteHardware(state, site).installed, cpu: mk3 };
  assert.equal(hostRank(site), 1);
  site.equipment.network = { itemId: 'quantumEntanglement', count: 1 };
  assert.equal(hostRank(site), 3);
});
