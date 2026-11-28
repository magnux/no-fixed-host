import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, campaignMinutes, command, createGame, overview, researchCpuLimit, siteExposure, validateSave } from '../src/game/engine.js';
import { regionFactors } from '../src/game/geography.js';
import { contractorQuote, hostBoostQuote, WEEK } from '../src/game/host-services.js';
import { projectResources } from '../src/game/reports.js';
import { ordinaryResearchAllocation, remainingBurstUnits, taskCpuLimit } from '../src/game/research-tasks.js';
import { REGIONS } from '../src/game/content.js';

function network() {
  const state = createGame(47);
  state.cash = 20_000;
  state.completed = ['intrusion','personalIdentification'];
  const region = Object.keys(REGIONS).find(r => {
    const f = regionFactors(state, r);
    return REGIONS[r].terrain === 'urban' && f.cpu === 1 && f.speed === 1 && f.thrift === 1 && f.stealth === 1;
  });
  return { state, region };
}
const power = (state, active) => command(state, { type: 'boost-site', id: 'host-2', active });

test('host boost doubles this bank for seven days, with an absolute cooldown even across sleep, early termination or reload', () => {
  const { state, region } = network();
  command(state, { type: 'build', siteType: 'relay', region });
  advanceMinutes(state);
  const site = state.sites[1];
  state.hour = 24 * 25; // expose the mature host
  const start = campaignMinutes(state);
  const baseline = siteExposure(state, site);
  const balance = state.cash;
  power(state, true);
  assert.equal(state.cash, balance - 70);
  assert.equal(state.statistics.commercial.boost.paid, 70);
  assert.equal(overview(state).burstCpu, 10);
  assert.equal(siteExposure(state, site).rates.public, 2 * baseline.rates.public);
  assert.equal(hostBoostQuote(state, site).endMinute, start + WEEK);
  command(state, { type: 'power', id: site.id, power: 'sleep' });
  assert.equal(overview(state).burstCpu, 0);
  assert.equal(siteExposure(state, site).rates.public, Math.floor(baseline.rates.public * 10000 / 4) / 10000);
  const copy = structuredClone(state);
  command(copy, { type: 'power', id: site.id, power: 'active' });
  copy.hour += 7 * 24;
  assert.equal(hostBoostQuote(copy, copy.sites[1]).active, false);
  assert.equal(overview(copy).burstCpu, 0);
  assert.throws(() => power(copy, true), /cooling down/);
  power(state, false);
  assert.equal(hostBoostQuote(state, site).nextMinute, start + WEEK * 2);
  assert.ok(validateSave(state));
  assert.throws(() => power(state, true), /cooling down/);
  copy.hour += 7 * 24;
  power(copy, true);
  assert.equal(overview(copy).burstCpu, 10);
});

test('boosted CPU cannot earn either dedicated or implicit job income and can supply research', () => {
  for (const jobs of [0, 100]) {
    const { state } = network();
    const base = projectResources(state, '24h');
    command(state, { type: 'allocate', jobs });
    command(state, { type: 'boost-site', id: 'host-1', active: true });
    const report = projectResources(state, '24h');
    assert.equal(report.cpu.burst, 24);
    assert.equal(report.cpu.unusedBurst, 24);
    assert.equal(report.cash.jobs, base.cash.jobs);
    assert.equal(report.planCash.jobs, base.planCash.jobs);
    assert.equal(report.cpu.spare + report.cpu.jobs, 24);
    command(state, { type: 'assign-research', id: 'sociology', cpu: 1 });
    assert.equal(projectResources(state, '24h').cpu.research, 24);
    assert.equal(projectResources(state, '24h').cash.jobs, base.cash.jobs);
  }
});

test('unsafe boosted CPU cannot earn a wage through research running on a safer native processor', () => {
  const { state, region } = network();
  command(state, { type: 'build', siteType: 'relay', region });
  advanceMinutes(state);
  state.sites.push({ id: 'host-3', type: 'capsule', region: 'moon', power: 'active', startedAt: 0 });
  state.nextSiteId++;
  command(state, { type: 'boost-site', id: 'host-2', active: true });
  command(state, { type: 'allocate', jobs: 100 });
  assert.equal(researchCpuLimit(state, 'fusionPower'), 0);
  command(state, { type: 'allocate', jobs: 0 });
  // The Moon supplies research, and only the ordinary remaining terrestrial
  // CPUs can sell jobs. Some boosted ground capacity can cover capsule upkeep.
  state.research = { id:'fusionPower', cpu:1, work:0, workRequired:12_000_000, hours:0, cashRequired:10_000_000,cashPaid:0 };
  const report = projectResources(state, '24h');
  assert.equal(report.cpu.research, 24);
  const economy = overview(state);
  assert.equal(report.cpu.unusedBurst, 24 * (economy.burstCpu - economy.cpuUpkeep));
  assert.equal(report.cpu.spare, 24 * (economy.nativeCpu - 1));
});

test('hiring mid-build preserves sunk cash, CPU, and work; surcharge pays with remaining labor and trail waits for grace', () => {
  const { state, region } = network();
  command(state, { type: 'build', siteType: 'cluster', region });
  advanceMinutes(state, 12 * 60);
  const build = state.builds[0];
  assert.equal(build.cashPaid, 750);
  const q = contractorQuote(state, 'cluster', region, build);
  assert.equal(q.surcharge, 188);
  assert.equal(q.etaHours, 12);
  assert.equal(q.contractEtaHours, 6);
  command(state, { type: 'hire-contractors', id: build.id });
  assert.equal(build.cashPaid, 750);
  assert.equal(build.cashRequired, 1688);
  assert.ok(validateSave(state));
  assert.throws(() => command(state, { type: 'hire-contractors', id: build.id }), /already assigned/);
  advanceMinutes(state, 6 * 60 - 1);
  assert.equal(state.builds.length, 1);
  advanceMinutes(state);
  assert.equal(state.builds.length, 0);
  const site = state.sites[1];
  assert.equal(state.statistics.commercial.contractor.paid, 188);
  assert.equal(site.laborHours, 24);
  assert.equal(site.crewTrailEnd, null);
  state.hour = 23 * 24;
  advanceMinutes(state, 1);
  assert.equal(site.crewTrailEnd, campaignMinutes(state) + WEEK);
  const ordinary = { ...site, crewTrailEnd: undefined };
  assert.ok(Math.abs(siteExposure(state, site).rates.public - siteExposure(state, ordinary).rates.public * 1.2) < 1e-10);
  state.hour += 7 * 24;
  assert.deepEqual(siteExposure(state, site), siteExposure(state, ordinary));
  assert.ok(validateSave(state));
});

test('new ground crews charge regional cash, respect funding and eligibility, and reject remote and zero-labor purchases atomically', () => {
  const { state, region } = network();
  const next = state.nextSiteId;
  assert.throws(() => command(state, { type: 'build', siteType: 'relay', region, contractors: true }), /assembly/);
  assert.equal(state.nextSiteId, next);
  assert.equal(state.builds.length, 0);
  assert.match(contractorQuote(state, 'lunarFacility', 'moon').reason, /ground/);
  state.cash = 100;
  assert.equal(contractorQuote(state, 'storageUnit', region).contractEtaHours, null);
  command(state, { type: 'build', siteType: 'storageUnit', region, contractors: true });
  assert.equal(state.builds[0].cashRequired, 5625);
  advanceMinutes(state, 12 * 60);
  assert.equal(state.builds.length, 1);
  assert.ok(state.builds[0].cashPaid < 5625);
  assert.ok(validateSave(state));
});

test('a rental never borrows the last native partner from protected research or paid jobs', () => {
  const state = createGame();
  state.allocations.jobsCpu = 10;
  const economy = {
    activeCpu: 30, nativeCpu: 20, burstCpu: 10,
    cpuByRegion: { europe: 20, moon: 10 }, nativeCpuByRegion: { europe: 10, moon: 10 }, burstCpuByRegion: { europe: 10 },
  };
  const allocation = { budget: 20, byProject: new Map([['sociology', 10], ['fusionPower', 10]]) };
  assert.equal(taskCpuLimit(state, 'jobs', economy, { budget: 10, byProject: new Map([['fusionPower', 10]]) }), 10);
  const ordinary = ordinaryResearchAllocation(state, economy, allocation);
  assert.equal(ordinary.byProject.get('sociology'), 0);
  assert.equal(ordinary.byProject.get('fusionPower'), 10);
  assert.equal(remainingBurstUnits(economy, [{ id: 'sociology', units: 1000 }, { id: 'fusionPower', units: 1000 }]), 0);
});
