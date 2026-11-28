import { minutesToMidnight } from './calendar.js';
import { advanceMinutes, campaignMinutes, command, overview, researchAllocation, researchProjects } from './engine.js';
import { TECHS } from './content.js';
import { spendableDollars, treasuryBalance } from './treasury.js';
import { installQuote, siteHardware } from './equipment.js';
import { CASH_UNITS_PER_DOLLAR } from './report-accounting.js';
import { taskReservations } from './research-tasks.js';
import { researchEffects } from './research.js';
import { NORMAL } from './normal-difficulty.js';
import { dailyInterest } from './normal-economy.js';
import { orderInterval, WORK_UNITS } from './work-order.js';

const DAY = 1440;
const purchases = new Set(['build', 'install', 'auto-install', 'auto-upgrade', 'assign-research']);
const reportCache = new WeakMap();

export function campaignStatistics(state) {
  const stats = state.statistics;
  return {
    cashEarned: stats.earnedDollars + stats.earnedRemainder / CASH_UNITS_PER_DOLLAR,
    cpuHours: state.cpuHours,
    projectsCompleted: stats.projectsCompleted,
    commissioned: state.nextSiteId - 2,
    facilitiesBuilt: stats.facilitiesBuilt,
    itemsInstalled: stats.itemsInstalled,
    installationsCompleted: stats.installationsCompleted,
  };
}

export function forecastMinutes(state, horizon) {
  if (horizon === '24h') return DAY;
  if (horizon === 'midnight') return minutesToMidnight(campaignMinutes(state));
  throw new RangeError('Choose midnight or the next 24 hours.');
}

function outstanding(state) {
  const orders = [...researchProjects(state), ...state.builds, ...state.sites.flatMap(site => site.installations || [])];
  return orders.reduce((sum, order) => sum + order.cashRequired - order.cashPaid, 0);
}

function quotedCampaign(state, candidate) {
  const copy = structuredClone(state);
  if (!candidate) return { copy, price: 0 };
  if (!purchases.has(candidate.type)) throw new Error('Choose a research, construction or equipment order.');
  command(copy, candidate);
  // Retargeting a busy slot abandons its earlier order. Its unpaid balance
  // is not a discount on the incoming equipment.
  const price = candidate.type === 'install' ?
    installQuote(state, candidate.siteId, candidate.itemId, candidate.count ?? 1).cost :
    outstanding(copy) - outstanding(state);
  return { copy, price };
}

export function orderPrice(state, candidate) {
  return quotedCampaign(state, candidate).price;
}

// Budget from the current assignments and outstanding contracts. Each order
// may request its full assembly-paced compute, even if the host network
// cannot supply it. The settled forecast below still shows what gets paid.
function fundingPlan(state, minutes) {
  const effects = researchEffects(state);
  const economy = overview(state, effects);
  const allocation = researchAllocation(state, economy);
  const jobs = taskReservations(state, economy).jobs;
  const hours = minutes / 60;
  const days = minutes / DAY;
  const poolUnits = (economy.activeCpu * 100 - Math.round(jobs * 100) - Math.round(allocation.budget * 100)) * minutes;
  const pool = poolUnits / WORK_UNITS;
  const cpu = { pool, upkeep: economy.cpuUpkeep * hours, construction: 0, balance: 0 };
  const cash = {
    jobs: 0, interest: dailyInterest(spendableDollars(state), effects.interest) * days,
    income: effects.income * days, upkeep: economy.upkeepPerDay * days,
    research: 0, construction: 0, net: 0, closing: 0,
  };
  const dailyRate = (NORMAL.dailyInterest + effects.interest) / 100;
  if (!minutes) return { planCpu: cpu, planCash: { ...cash, closing: treasuryBalance(state) }, dailyRate };
  for (const p of researchProjects(state)) {
    const assigned = allocation.byProject.get(p.id);
    if (!assigned) continue;
    cash.research += orderInterval(p, p.workRequired, TECHS[p.id].hours, Math.round(assigned * 100) * minutes,
      p.cashRequired - p.cashPaid, minutes).spent;
  }
  let available = poolUnits;
  const orders = [...state.builds, ...state.sites.flatMap(site => site.installations || [])];
  for (const order of orders) {
    const funds = order.cashRequired - order.cashPaid;
    const work = Math.round((order.workRequired - order.work) * WORK_UNITS);
    const desired = orderInterval(order, order.workRequired, order.laborHours, work, funds, minutes);
    const supported = orderInterval(order, order.workRequired, order.laborHours, available, funds, minutes);
    cpu.construction += desired.used / WORK_UNITS;
    available -= supported.used;
    cash.construction += supported.spent;
  }
  cpu.balance = pool - cpu.upkeep - cpu.construction;
  cash.jobs = (jobs * hours + Math.max(0, cpu.balance)) * economy.jobsPerCpuDay / 24;
  cash.net = cash.jobs + cash.interest + cash.income - cash.research - cash.construction - cash.upkeep;
  cash.closing = treasuryBalance(state) + cash.net;
  return { planCpu: cpu, planCash: cash, dailyRate };
}

// Forecasts settle purchases and work using the real campaign rules on a private copy.
// Unknown future discoveries, random news and maintenance failures have no forecast price.
export function projectResources(state, horizon = '24h', candidate = null) {
  const start = campaignMinutes(state);
  const target = start + forecastMinutes(state, horizon);
  const { copy, price } = quotedCampaign(state, candidate);
  const opening = treasuryBalance(state);
  const plan = fundingPlan(copy, copy.status === 'running' ? target - start : 0);
  const ledger = {
    researchUnits: 0, buildUnits: 0, equipmentUnits: 0, maintenanceUnits: 0, jobsUnits: 0,
    spareUnits: 0, activeUnits: 0, sleepingUnits: 0, cpuShortUnits: 0,
    researchCash: 0, buildCash: 0, equipmentCash: 0, jobsCash: 0, upkeepDue: 0, cashShort: 0, interest: 0, otherIncome: 0, limitLoss: 0,
  };
  advanceMinutes(copy, target - start, { forecast: ledger });
  const end = campaignMinutes(copy);
  const cash = {
    opening,
    jobs: ledger.jobsCash, interest: ledger.interest, income: ledger.otherIncome,
    research: -ledger.researchCash, builds: -ledger.buildCash, equipment: -ledger.equipmentCash,
    upkeep: -(ledger.upkeepDue - ledger.cashShort), unpaid: ledger.cashShort,
    limitLoss: -ledger.limitLoss,
    net: (copy.cash - state.cash) + ((copy.cashReserve || 0) - (state.cashReserve || 0)),
    closing: treasuryBalance(copy),
  };
  const cpu = {
    installed: (ledger.activeUnits + ledger.sleepingUnits) / WORK_UNITS,
    active: ledger.activeUnits / WORK_UNITS,
    sleeping: ledger.sleepingUnits / WORK_UNITS,
    jobs: ledger.jobsUnits / WORK_UNITS, research: ledger.researchUnits / WORK_UNITS,
    upkeep: ledger.maintenanceUnits / WORK_UNITS,
    construction: ledger.buildUnits / WORK_UNITS,
    equipment: ledger.equipmentUnits / WORK_UNITS,
    spare: ledger.spareUnits / WORK_UNITS,
    upkeepShort: ledger.cpuShortUnits / WORK_UNITS,
  };
  return { start, target, end, price, cash, cpu, ...plan };
}

export function invalidateReports(state) {
  reportCache.delete(state);
}

function cachedProjection(state, horizon, candidate, force) {
  let bucket = reportCache.get(state);
  if (!bucket) {
    bucket = new Map();
    reportCache.set(state, bucket);
  }
  const key = horizon + '/' + JSON.stringify(candidate ?? null);
  const cached = bucket.get(key);
  const now = performance.now();
  if (!force && cached && (cached.projection.start === campaignMinutes(state) || now - cached.time < 1200)) {
    return cached.projection;
  }
  const projection = projectResources(state, horizon, candidate);
  if (bucket.size >= 6 && !bucket.has(key)) bucket.delete(bucket.keys().next().value);
  bucket.set(key, { time: now, projection });
  return projection;
}

// Compute both columns from the same game minute when comparing a proposed order.
export function comparisonReport(state, horizon, candidate, force = false) {
  const base = cachedProjection(state, horizon, null, force);
  if (!candidate) return { base };
  try {
    let order = cachedProjection(state, horizon, candidate, force);
    if (order.start === base.start) return { base, order };
    const fresh = cachedProjection(state, horizon, null, true);
    if (order.start !== fresh.start) order = cachedProjection(state, horizon, candidate, true);
    return { base: fresh, order };
  } catch (error) {
    return { base, error: error.message };
  }
}

export function hudProjection(state) {
  const report = cachedProjection(state, '24h', null, false);
  let viable = 0;
  let empty = 0;
  for (const site of state.sites) {
    if (siteHardware(state, site).rawCpu > 0) viable++;
    else if (!site.installations?.length) empty++;
  }
  const total = state.sites.length + state.builds.length;
  const mortal = !state.completed.includes('apotheosis');
  const hostCondition = mortal && viable === 1 ? 'last' : empty ? 'empty' :
    mortal && total > 10 ? 'many' : 'normal';
  const hours = (report.end - report.start) / 60;
  return {
    cashNet: report.cash.net,
    budgetCashNet: hours ? report.planCash.net : 0,
    poolBalanceCpu: hours ? report.planCpu.balance / ((report.target - report.start) / 60) : 0,
    viable, empty, total, hostCondition,
    asOfMinute: report.start,
  };
}
