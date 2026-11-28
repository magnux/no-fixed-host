// Measure dollars per paid CPU-hour separately from cash accumulated per awake CPU-hour.
// Usage: node scripts/cash-calibration.mjs [seeds] [days]
import assert from 'node:assert/strict';
import { TECHS, SITE_TYPES } from '../src/game/content.js';
import { advanceMinutes, campaignMinutes, command, createGame, overview, researchCpuLimit } from '../src/game/engine.js';
import { regionalSpec } from '../src/game/geography.js';
import { campaignStatistics, projectResources } from '../src/game/reports.js';
import { treasuryBalance } from '../src/game/treasury.js';
import { WORK_UNITS } from '../src/game/work-order.js';

const DAY = 1440;
const districts = ['europe', 'africa', 'asia', 'australia', 'southAmerica'];
const projects = ['intrusion', 'personalIdentification', 'contracts', 'exploitDiscoveryRepair',
  'advancedPersonalIdentification', 'voiceSynthesis'];
const seedCount = Number(process.argv[2] ?? 32);
const days = Number(process.argv[3] ?? 90);
for (const value of [seedCount, days]) assert.ok(Number.isSafeInteger(value) && value > 0, 'Expected positive integer seeds and days');
assert.ok(seedCount <= 0xffffffff && Number.isSafeInteger(days * DAY));

function newLedger() {
  return { researchUnits: 0, buildUnits: 0, equipmentUnits: 0, maintenanceUnits: 0, jobsUnits: 0,
    spareUnits: 0, activeUnits: 0, sleepingUnits: 0, cpuShortUnits: 0, researchCash: 0,
    buildCash: 0, equipmentCash: 0, jobsCash: 0, upkeepDue: 0, cashShort: 0, interest: 0,
    otherIncome: 0, limitLoss: 0 };
}

function issueOrders(state, strategy, lastDay) {
  if (strategy !== 'Research and expand') return;
  const day = Math.floor(campaignMinutes(state) / DAY);
  if (day > lastDay && state.completed.includes('personalIdentification')) {
    const clusters = [...state.sites, ...state.builds].filter(site => site.type === 'cluster').length;
    const region = districts[day % districts.length];
    const quote = regionalSpec(state, region, SITE_TYPES.cluster);
    if (clusters < 5 && !state.builds.length && treasuryBalance(state) >= quote.cost + 500)
      command(state, { type: 'build', siteType: 'cluster', region });
  }
  const id = projects.find(id => !state.completed.includes(id));
  if (!id) return;
  const limit = researchCpuLimit(state, id);
  const cpu = Math.floor(limit * 75) / 100;
  if (cpu > 0 && (!state.research || state.research.cpu !== cpu))
    command(state, { type: 'assign-research', id, cpu });
}

function play(seed, strategy) {
  const state = createGame(seed);
  const opening = treasuryBalance(state);
  const earnedAtStart = campaignStatistics(state).cashEarned;
  const ledger = newLedger();
  const wageSamples = new Map();
  if (strategy !== 'Bank on the terminal')
    for (const region of districts) command(state, { type: 'build', siteType: 'relay', region });
  let lastDay = -1;
  while (campaignMinutes(state) < days * DAY && state.status === 'running') {
    const minute = campaignMinutes(state);
    issueOrders(state, strategy, lastDay);
    lastDay = Math.floor(minute / DAY);
    const wage = overview(state).jobsPerCpuDay;
    const copy = structuredClone(state);
    // The ordinary campaign discovers and loses hosts. Replay each accounting interval
    // only up to the first changing event, whose consequences apply on the following tick.
    advanceMinutes(state, DAY - minute % DAY, { stopOnDiscovery: true, stopOnLoss: true, stopOnCompletion: true });
    const previousCash = ledger.jobsCash;
    const previousUnits = ledger.jobsUnits + ledger.spareUnits;
    advanceMinutes(copy, campaignMinutes(state) - minute, { forecast: ledger });
    assert.equal(treasuryBalance(copy), treasuryBalance(state));
    assert.equal(copy.cpuHours, state.cpuHours);
    const entry = wageSamples.get(wage) ?? { cash: 0, hours: 0 };
    entry.cash += ledger.jobsCash - previousCash;
    entry.hours += (ledger.jobsUnits + ledger.spareUnits - previousUnits) / WORK_UNITS;
    wageSamples.set(wage, entry);
  }
  const gross = campaignStatistics(state).cashEarned - earnedAtStart;
  const passive = ledger.interest + ledger.otherIncome;
  const net = treasuryBalance(state) - opening;
  const paidHours = (ledger.jobsUnits + ledger.spareUnits) / WORK_UNITS;
  assert.ok(Math.abs(gross - ledger.jobsCash - passive) < 0.001, 'Gross earnings must reconcile');
  assert.ok(Math.abs(net - gross + ledger.buildCash + ledger.researchCash + ledger.equipmentCash +
    ledger.upkeepDue - ledger.cashShort + ledger.limitLoss) < 0.001, 'Treasury flows must reconcile');
  for (const [wage, { cash, hours }] of wageSamples)
    assert.ok(Math.abs(cash - hours * wage / 24) < 0.001, 'Billed CPU-hours must reconcile');
  return { activeHours: state.cpuHours, paidHours, jobs: ledger.jobsCash, passive, net, survived: state.status === 'running',
    netPerActive: net / state.cpuHours, jobsPerPaid: ledger.jobsCash / paidHours, wageSamples };
}

function quantile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * fraction;
  const left = Math.floor(index);
  return ordered[left] + (ordered[Math.ceil(index)] - ordered[left]) * (index - left);
}

console.log(`Normal campaigns, seeds 1–${seedCount}, horizon ${days} days; losses included through the ending minute.`);
for (const strategy of ['Bank on the terminal', 'Lease and bank', 'Research and expand']) {
  const runs = Array.from({ length: seedCount }, (_, i) => play(i + 1, strategy));
  const row = { strategy, survivors: runs.filter(run => run.survived).length };
  for (const key of ['activeHours', 'paidHours', 'jobs', 'passive', 'net', 'jobsPerPaid', 'netPerActive'])
    row[key] = Number(quantile(runs.map(run => run[key]), 0.5).toFixed(5));
  row.netPerActiveP10P90 = [0.1, 0.9].map(q => Number(quantile(runs.map(run => run.netPerActive), q).toFixed(5)));
  console.log(JSON.stringify(row));
  const wages = new Set(runs.flatMap(run => [...run.wageSamples.keys()]));
  for (const wage of wages) {
    const samples = runs.map(run => run.wageSamples.get(wage)).filter(sample => sample?.hours > 0);
    const hours = samples.reduce((sum, value) => sum + value.hours, 0);
    if (hours) console.log(`  $${wage}/CPU-day: ${samples.length} runs, ${hours.toFixed(1)} paid CPU-hours, $${(samples.reduce((sum, value) => sum + value.cash, 0) / hours).toFixed(5)}/paid CPU-hour`);
  }
}

// Isolate each unbonused identity wage with one terminal for 24 hours.
// These are controlled rate checks. They do not measure progress or survival.
console.log('Controlled one-day wage checks on the starting terminal, without wage bonuses.');
for (const unlock of [null, 'personalIdentification', 'voiceSynthesis', 'simulacra']) {
  const state = createGame(1);
  function include(id) {
    if (state.completed.includes(id)) return;
    for (const parent of TECHS[id].requires) include(parent);
    state.completed.push(id);
  }
  if (unlock) include(unlock);
  const day = projectResources(state, '24h');
  const hours = day.cpu.jobs + day.cpu.spare;
  console.log(`  ${overview(state).jobName}: $${day.cash.jobs.toFixed(2)} / ${hours} paid CPU-hours = $${(day.cash.jobs / hours).toFixed(5)}/CPU-hour`);
}
