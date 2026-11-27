import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { regionalSpec } from '../src/game/geography.js';
import { facilityIcon } from '../src/ui/facility-icons.js';

test('all original destinations and hardware families are represented', () => {
  assert.equal(Object.keys(REGIONS).length, 12);
  assert.equal(Object.values(REGIONS).filter(region => region.terrain === 'urban').length, 6);
  assert.equal(Object.keys(SITE_TYPES).filter(id => id !== 'seed').length, 13);

  const counts = { cpu: 0, network: 0, reactor: 0, security: 0 };
  for (const item of Object.values(EQUIPMENT)) {
    assert.ok(Object.hasOwn(counts, item.slot));
    counts[item.slot]++;
  }
  assert.deepEqual(counts, { cpu: 9, network: 4, reactor: 6, security: 7 });
});

test('each facility in the catalog has a distinct decorative icon', () => {
  const icons = Object.keys(SITE_TYPES).map(facilityIcon);
  assert.equal(new Set(icons).size, icons.length);
  for (const svg of icons) {
    assert.match(svg, /aria-hidden="true"/);
    assert.notEqual(svg, facilityIcon('unknown'));
  }
});

test('hardware can be installed in a configurable site once its research is complete', () => {
  const sites = Object.values(SITE_TYPES);
  for (const [id, item] of Object.entries(EQUIPMENT)) {
    assert.ok(item.requires.every(tech => Object.hasOwn(TECHS, tech)), id);
    assert.ok(item.regions.every(region => Object.hasOwn(REGIONS, region)), id);
    assert.ok(sites.some(site => !site.fixedCpu && site.regions.some(region => item.regions.includes(region))), id);
  }
  for (const [id, site] of Object.entries(SITE_TYPES)) {
    assert.ok(site.requires.every(tech => Object.hasOwn(TECHS, tech)), id);
    assert.ok(site.regions.every(region => Object.hasOwn(REGIONS, region)), id);
    if (site.fixedCpu) assert.equal(EQUIPMENT[site.fixedCpu].slot, 'cpu', id);
    if (site.starterCpu) {
      assert.ok(site.startCount <= site.slots, id);
      assert.equal(EQUIPMENT[site.starterCpu].quality * site.startCount, site.cpu, id);
    }
  }
  assert.equal(sites.filter(site => site.regions.includes('orbit')).length, 0);
  assert.ok(EQUIPMENT.highSpeedInternet.regions.includes('southAmerica'));
  assert.ok(!EQUIPMENT.highSpeedInternet.regions.includes('moon'));
  assert.ok(EQUIPMENT.passiveCamouflage.regions.includes('atlantic'));
  assert.ok(!EQUIPMENT.solarCollector.regions.includes('atlantic'));
});

test('Normal keeps opening output, late-game costs and CPU-day conversions at reference scale', () => {
  const amounts = spec => [spec.cost, spec.work, spec.hours];
  assert.deepEqual([SITE_TYPES.seed.cpu, SITE_TYPES.relay.cpu, SITE_TYPES.cluster.cpu], [1, 10, 35]);
  for (const spec of Object.values(SITE_TYPES)) {
    if (spec.fixedCpu) assert.equal(spec.cpu, EQUIPMENT[spec.fixedCpu].quality * spec.slots);
    else assert.ok(!spec.starterCpu && spec.cpu === 0);
  }
  assert.deepEqual(amounts(TECHS.personalIdentification), [0, 300 * 24, 0]);
  assert.deepEqual(amounts(TECHS.apotheosis), [100_000_000, 3_000_000 * 24, 0]);
  assert.deepEqual(amounts(SITE_TYPES.lab), [2_000_000, 2000 * 24, 10 * 24]);
  assert.deepEqual([SITE_TYPES.lab.upkeep, SITE_TYPES.lab.cpuUpkeep], [2500, 30]);
  assert.deepEqual(amounts(SITE_TYPES.realityBubble), [80_000_000_000, 6_000_000 * 24, 50 * 24]);
  assert.deepEqual(amounts(EQUIPMENT.quantumComputer), [100_000, 1000 * 24, 10 * 24]);
});

test('remote region modifiers apply to facility construction and upkeep, with uniform equipment prices', () => {
  const state = { regionSeed: 7 };
  const outpost = regionalSpec(state, 'farReaches', SITE_TYPES.scientificOutpost);
  assert.equal(outpost.cost, 1_000_000_000);
  assert.equal(outpost.work, 3_000_000 * 24);
  assert.equal(outpost.hours, 30 * 24);
  assert.equal(outpost.upkeep, 9_000_000);
  assert.equal(outpost.cpuUpkeep, 1500);
  for (const region of ['coast', 'moon', 'farReaches']) {
    assert.equal(regionalSpec(state, region, EQUIPMENT.supercomputer), EQUIPMENT.supercomputer);
  }
});
