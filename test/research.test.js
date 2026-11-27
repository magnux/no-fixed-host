import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { ORIGINAL_TECHS } from '../src/game/research-tree.js';
import { laborHours, researchEffects } from '../src/game/research.js';
import { advance, buildReason, command, createGame, installReason, researchReason } from '../src/game/engine.js';

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
  state.cash = 30_000;
  // Establish capacity through regular lease orders while discovery grace is active.
  for (let i = 0; i < 8; i++) command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  advance(state, 1);
  command(state, { type: 'assign-research', id: 'intrusion', cpu: 30 });
  advance(state, TECHS.intrusion.work / 30);
  assert.deepEqual(state.completed, ['intrusion']);
  command(state, { type: 'assign-research', id: 'personalIdentification', cpu: 30 });
  advance(state, TECHS.personalIdentification.work / 30);
  assert.equal(buildReason(state, 'storageUnit', 'europe'), '');
  assert.match(researchReason(state, 'databaseManipulation'), /Stealth/);
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe' });
  advance(state, 48);
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
  assert.equal(researchEffects(state).jobsPerCpuDay, 52);
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
  assert.equal(mod.income, 1000);
  assert.equal(mod.insight, 'full');
  assert.equal(laborHours(state, EQUIPMENT.pc), 20.4);
  assert.deepEqual(researchEffects({ completed: [...state.completed].reverse() }), mod);
});

test('the campaign joins identity and vehicle research while the basic ocean lab stays on its original branch', () => {
  const s = createGame();
  s.cash = 3_000_000;
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
