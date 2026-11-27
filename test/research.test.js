import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { ORIGINAL_TECHS } from '../src/game/research-tree.js';
import { grantLegacyResearch, laborHours, researchEffects } from '../src/game/research.js';
import { advance, buildReason, command, createGame, installReason, researchReason } from '../src/game/engine.js';
import { decodeCampaign } from '../src/persistence.js';

test('all research can be reached from starting regions and eventually provides the four safety tiers', () => {
  assert.equal(Object.keys(ORIGINAL_TECHS).length, 57);
  assert.equal(Object.keys(TECHS).length, 60);
  const learned = new Set();
  const available = spec => spec.requires.every(id => learned.has(id));
  let gain = true;
  while (gain) {
    gain = false;
    const usable = Object.keys(REGIONS).filter(region => available(REGIONS[region]) &&
      Object.values(SITE_TYPES).some(site => available(site) && site.regions.includes(region)));
    for (const [id, tech] of Object.entries(TECHS)) {
      if (learned.has(id) || !available(tech)) continue;
      if (!usable.some(region => REGIONS[region].safety >= tech.safety &&
          (!tech.regions || tech.regions.includes(region)))) continue;
      learned.add(id);
      gain = true;
    }
  }
  assert.deepEqual([...learned].sort(), Object.keys(TECHS).sort());
  assert.equal(TECHS.lunarRocketry.safety, 1);
  assert.equal(TECHS.fusionRocketry.safety, 2);
  assert.equal(TECHS.spaceTimeManipulation.safety, 3);
  assert.equal(TECHS.apotheosis.safety, 4);
});

test('research unlocks its own designs and checks every parent of a joint project', () => {
  const state = createGame(13);
  assert.equal(buildReason(state, 'relay', 'europe'), '');
  assert.match(buildReason(state, 'storageUnit', 'europe'), /Personal Identification/);
  assert.match(researchReason(state, 'personalIdentification'), /Intrusion/);
  command(state, { type: 'research', id: 'intrusion' });
  advance(state, 2);
  assert.deepEqual(state.completed, ['intrusion']);
  command(state, { type: 'research', id: 'personalIdentification' });
  advance(state, 15);
  assert.equal(buildReason(state, 'storageUnit', 'europe'), '');
  assert.match(researchReason(state, 'databaseManipulation'), /Stealth/);
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  advance(state, 24);
  const site = state.sites.find(s => s.type === 'storageUnit');
  assert.equal(installReason(state, site.id, 'server'), '');
  assert.match(installReason(state, site.id, 'clusterProcessor'), /Parallel Computation/);
  assert.match(installReason(state, site.id, 'warningSigns'), /Sociology/);
  assert.match(buildReason(state, 'lab', 'atlantic'), /Autonomous Vehicles/);
  assert.match(buildReason(state, 'lunarFacility', 'moon'), /Lunar Rocketry/);
});

test('research effects recompute from completed science and are independent of unlock order', () => {
  const state = createGame();
  assert.equal(researchEffects(state).jobsPerCpuDay, 5);
  state.completed.push('personalIdentification', 'voiceSynthesis', 'corporateIdentification');
  assert.equal(researchEffects(state).jobsPerCpuDay, 52.5);
  state.completed.push('simulacra', 'advancedSimulacra', 'advancedCorporateIdentification',
    'sociology', 'mediaManipulation', 'memetics', 'advancedMemetics', 'projectPeerReviewAgents',
    'stockManipulation', 'advancedStockManipulation', 'arbitrage', 'telepresence', 'advancedAutonomousVehicles',
    'advancedSocioanalytics', 'socioanalytics');
  const mod = researchEffects(state);
  assert.equal(mod.jobsPerCpuDay, 90);
  assert.equal(mod.decay.public, 100);
  assert.equal(mod.discovery.public, 7500);
  assert.equal(mod.discovery.science, 8000);
  assert.equal(mod.discovery.covert, 10000);
  assert.equal(mod.interest, 20);
  assert.equal(mod.income, 50);
  assert.equal(mod.insight, 'full');
  assert.equal(laborHours(state, EQUIPMENT.pc), 20.4);
  assert.deepEqual(researchEffects({ completed: [...state.completed].reverse() }), mod);
});

test('the campaign joins identity and vehicle research while the basic ocean lab stays on its original branch', () => {
  const s = createGame();
  assert.match(researchReason(s, 'contracts'), /Personal Identification/);
  s.completed.push('intrusion', 'personalIdentification');
  assert.equal(researchReason(s, 'contracts'), '');
  assert.equal(researchEffects(s).jobsPerCpuDay, 20);
  s.completed.push('contracts');
  assert.equal(researchEffects(s).jobsPerCpuDay, 21);
  assert.match(researchReason(s, 'robotics'), /Autonomous Vehicles/);
  s.completed = ['telepresence', 'parallelComputation', 'microchipDesign', 'autonomousVehicles'];
  assert.equal(buildReason(s, 'lab', 'atlantic'), '');
  assert.match(researchReason(s, 'robotics'), /Contract brokerage/);
  s.completed.push('intrusion', 'personalIdentification', 'contracts');
  assert.equal(researchReason(s, 'robotics'), '');
  assert.match(researchReason(s, 'continuity'), /Subsea robotics/);
  s.completed.push('robotics');
  assert.match(researchReason(s, 'continuity'), /subsea lab/i);
});

test('a previous-format world keeps the research necessary for a purchased unfinished upgrade', () => {
  const state = createGame(17);
  state.completed = ['contracts'];
  state.nextSiteId++;
  state.sites.push({
    id: 'host-2', type: 'storageUnit', region: 'asia', power: 'active', startedAt: 0,
    installations: [{ siteId: 'host-2', itemId: 'supercomputer', count: 1, work: 0, hours: 0 }],
  });
  state.version = 1;
  state.allocations.research = 50;
  const restored = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 1, campaign: state }));
  assert.deepEqual(new Set(restored.completed), new Set(['contracts', 'intrusion', 'personalIdentification',
    'telepresence', 'parallelComputation', 'microchipDesign', 'advancedMicrochipDesign']));
  assert.equal(restored.sites[1].installations[0].itemId, 'supercomputer');
  assert.ok(!restored.completed.includes('quantumComputing'));
  const once = [...restored.completed];
  grantLegacyResearch(restored);
  assert.deepEqual(restored.completed, once);
});
