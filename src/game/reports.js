import { advanceMinutes, campaignMinutes, command } from './engine.js';
import { siteHardware } from './equipment.js';
import { CASH_UNITS_PER_DOLLAR } from './report-accounting.js';

const DAY = 1440;
const CPU_HOUR_UNITS = 6000;
const purchases = new Set(['build', 'install', 'auto-install', 'research']);
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
    partial: stats.partial, trackedFromMinute: stats.trackedFromMinute,
  };
}

export function forecastMinutes(state, horizon) {
  if (horizon === '24h') return DAY;
  if (horizon === 'midnight') return DAY - campaignMinutes(state) % DAY;
  throw new RangeError('Choose midnight or the next 24 hours.');
}

function quotedCampaign(state, candidate) {
  const copy = structuredClone(state);
  if (!candidate) return { copy, upfront: 0 };
  if (!purchases.has(candidate.type)) throw new Error('Choose a research, construction or equipment order.');
  command(copy, candidate);
  // A legacy reserve can refill the wallet immediately after the purchase.
  const paid = (state.cash - copy.cash) + ((state.cashReserve || 0) - (copy.cashReserve || 0));
  return { copy, upfront: Math.round(paid * CASH_UNITS_PER_DOLLAR) / CASH_UNITS_PER_DOLLAR };
}

export function orderPrice(state, candidate) {
  return quotedCampaign(state, candidate).upfront;
}

// Forecasts settle purchases and work using the real campaign rules on a private copy.
// Unknown future discoveries, random news and maintenance failures have no forecast price.
export function projectResources(state, horizon = '24h', candidate = null) {
  const start = campaignMinutes(state);
  const target = start + forecastMinutes(state, horizon);
  const { copy, upfront } = quotedCampaign(state, candidate);
  const opening = state.cash;
  const ledger = {
    researchUnits: 0, buildUnits: 0, equipmentUnits: 0, maintenanceUnits: 0, jobsUnits: 0,
    spareUnits: 0, activeUnits: 0, sleepingUnits: 0, cpuShortUnits: 0,
    jobsCash: 0, upkeepDue: 0, cashShort: 0, interest: 0, otherIncome: 0, limitLoss: 0,
  };
  advanceMinutes(copy, target - start, { forecast: ledger });
  const end = campaignMinutes(copy);
  const cash = {
    opening, upfront,
    jobs: ledger.jobsCash, interest: ledger.interest, income: ledger.otherIncome,
    research: candidate?.type === 'research' ? -upfront : 0,
    builds: candidate?.type === 'build' ? -upfront : 0,
    equipment: ['install', 'auto-install'].includes(candidate?.type) ? -upfront : 0,
    upkeep: -(ledger.upkeepDue - ledger.cashShort), unpaid: ledger.cashShort,
    limitLoss: -ledger.limitLoss, reserveTransfer: (state.cashReserve || 0) - (copy.cashReserve || 0),
    closingReserve: copy.cashReserve || 0,
    net: copy.cash - opening, closing: copy.cash,
  };
  const cpu = {
    installed: (ledger.activeUnits + ledger.sleepingUnits) / CPU_HOUR_UNITS,
    active: ledger.activeUnits / CPU_HOUR_UNITS,
    sleeping: ledger.sleepingUnits / CPU_HOUR_UNITS,
    jobs: ledger.jobsUnits / CPU_HOUR_UNITS, research: ledger.researchUnits / CPU_HOUR_UNITS,
    upkeep: ledger.maintenanceUnits / CPU_HOUR_UNITS,
    construction: ledger.buildUnits / CPU_HOUR_UNITS,
    equipment: ledger.equipmentUnits / CPU_HOUR_UNITS,
    spare: ledger.spareUnits / CPU_HOUR_UNITS,
    upkeepShort: ledger.cpuShortUnits / CPU_HOUR_UNITS,
  };
  return { start, target, end, cash, cpu };
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
  const viable = state.sites.filter(site => siteHardware(state, site).rawCpu > 0).length;
  const hours = (report.end - report.start) / 60;
  return {
    cashNet: report.cash.net,
    poolBalanceCpu: hours ? (report.cpu.spare - report.cpu.upkeepShort) / hours : 0,
    viable, empty: state.sites.length - viable, total: state.sites.length + state.builds.length,
    asOfMinute: report.start,
  };
}
