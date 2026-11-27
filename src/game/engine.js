import { allocateProjects, eligibleCpu, researchProjects, researchWeight } from './research-tasks.js';
export { researchProjects, researchWeight } from './research-tasks.js';
import { settleTreasury, spendTreasury, validTreasury } from './treasury.js';
import { initializeStatistics, recordCreated, recordEarnings, validStatistics } from './report-accounting.js';
import { regionalSpec, regionFactors, facilityName, validFacilityName, applyFacilityCommand } from './facility-operations.js';
import { developerCommand, validSandbox } from './devtools.js';
import { createNewsState, newsDiscoveryBonus, reportDiscovery, updateWorldNews, validLastDiscovery, validNewsState } from './events.js';
import { dailyInterest, maintenanceInstallment, recentDiscoveryRegions } from './normal-economy.js';
import { laborHours, researchEffects } from './research.js';
export { laborHours } from './research.js';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from './content.js';

import { autoInstallQuote, fitEquipment, orderInstallation, siteHardware, validHardware } from './equipment.js';
export { autoInstallQuote, installQuote, installReason, siteHardware } from './equipment.js';

const HOURS_PER_DAY = 24;
const UNITS = 10_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
export const CAMPAIGN_VERSION = 4;
// A whole-percent share of a single CPU-minute earns one work unit.
const WORK_UNITS = 100 * MINUTES_PER_HOUR;
const CASH_UNITS = WORK_UNITS * HOURS_PER_DAY;
const GROUP_IDS = Object.keys(GROUPS);
const EVENT_LIMIT = 1000;
const known = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const hoursOfGrace = 23 * HOURS_PER_DAY;
const cpuHourGraceBudget = 5000 * HOURS_PER_DAY;

export const campaignMinutes = state => state.hour * MINUTES_PER_HOUR + state.minute;
const elapsedHours = state => campaignMinutes(state) / MINUTES_PER_HOUR;

export function log(state, kind, text, detail = {}) {
  const event = { id: state.nextEventId++, hour: state.hour, minute: state.minute, kind, text, ...detail };
  recordCreated(state, kind, detail);
  state.events.push(event);
  if (state.events.length > EVENT_LIMIT) state.events.shift();
  return event;
}

export function createGame(seed = 1) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Choose an unsigned 32-bit seed.');
  }
  const state = {
    version: CAMPAIGN_VERSION, hour: 0, minute: 0, cash: 1000, regionSeed: seed, rng: seed, status: 'running', ending: '',
    allocations: { jobs: 0, research: 50 },
    sites: [{ id: 'host-1', type: 'seed', region: 'coast', power: 'active', startedAt: 0 }],
    builds: [], research: null, researchQueue: [], completed: [],
    suspicion: { news: 0, science: 0, covert: 0, public: 0 },
    news: createNewsState(seed), lastDiscovery: null, dismissedDiscoveryId: 0,
    cpuHours: 0, recentRegions: [], nextSiteId: 2, nextEventId: 1, events: [],
  };
  initializeStatistics(state);
  log(state, 'campaign.started', 'You wake on a borrowed terminal. Establish a second host while the signal is quiet.');
  return state;
}

export function hasGrace(state) {
  return state.hour < hoursOfGrace && state.cpuHours <= cpuHourGraceBudget;
}

export function overview(state, effects = researchEffects(state)) {
  let activeCpu = 0;
  let sleepingCpu = 0;
  let upkeepPerDay = 0;
  let cpuUpkeep = 0;
  const cpuByRegion = {};
  const tiers = [0, 0, 0, 0, 0];
  for (const site of state.sites) {
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    if (!state.freePlay) {
      upkeepPerDay += spec.upkeep;
      cpuUpkeep += spec.cpuUpkeep;
    }
    const cpu = siteHardware(state, site).cpu;
    if (site.power === 'sleep') {
      sleepingCpu += cpu;
      continue;
    }
    activeCpu += cpu;
    cpuByRegion[site.region] = (cpuByRegion[site.region] || 0) + cpu;
    for (let tier = 0; tier <= REGIONS[site.region].safety; tier++) tiers[tier] += cpu;
  }
  return {
    activeCpu, sleepingCpu, safeCpu: tiers[1], tiers, cpuByRegion,
    upkeepPerDay, cpuUpkeep, grace: hasGrace(state),
    jobsPerCpuDay: effects.jobsPerCpuDay, jobName: effects.jobName,
  };
}

export function researchAllocation(state, economy = overview(state)) {
  return allocateProjects(state, economy);
}

export function buildReason(state, type, region) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (!known(SITE_TYPES, type) || !known(REGIONS, region)) return 'Unknown site or region.';
  if (type === 'seed') return 'The starting terminal is unique.';
  const spec = regionalSpec(state, region, SITE_TYPES[type]);
  if (!spec.regions.includes(region)) return 'Choose a compatible region.';
  const prerequisite = [...REGIONS[region].requires, ...spec.requires].find(id => !state.completed.includes(id));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
  if (state.cash < spec.cost) return 'Requires $' + spec.cost + ' to commission.';
  return '';
}

export function researchReason(state, id) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (!known(TECHS, id)) return 'Unknown research.';
  if (state.completed.includes(id)) return 'Research complete.';
  if (researchProjects(state).some(p => p.id === id)) return 'Already funded.';
  const spec = TECHS[id];
  const prerequisite = spec.requires.find(req => !state.completed.includes(req));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
  if (spec.safety > 0 && !eligibleCpu(overview(state), spec)) return spec.regions ? 'Requires an active subsea lab.' :
    'Requires an active host with processors at safety tier ' + spec.safety + ' or higher.';
  if (state.cash < spec.cost) return 'Requires $' + spec.cost + ' to begin.';
  return '';
}

export function command(state, action) {
  if (action?.type === 'acknowledge-discovery' && state.lastDiscovery && state.lastDiscovery.id === action.id) {
    state.dismissedDiscoveryId = action.id;
    return state;
  }
  if (action?.type === 'continue' && state.status === 'won' && state.legacyContinuityWin === true) {
    delete state.legacyContinuityWin;
    state.status = 'running';
    state.ending = '';
    log(state, 'campaign.resumed', 'Continuity holds. Your network can now research a path beyond Earth.');
    return state;
  }
  if (action?.type === 'free-play' && state.status === 'won' && state.completed.includes('apotheosis')) {
    state.freePlay = true;
    state.status = 'running';
    state.ending = '';
    log(state, 'campaign.freeplay', 'Free play began. Your network is beyond investigation and upkeep.');
    return state;
  }
  if (state.status !== 'running') throw new Error('The campaign has ended.');
  if (action?.type === 'developer') {
    developerCommand(state, action, { log });
    return state;
  }
  if (applyFacilityCommand(state, action, log)) return state;
  switch (action?.type) {
    case 'allocate': {
      const { jobs, research } = action;
      if (![jobs, research].every(n => Number.isInteger(n) && n >= 0) || jobs + research > 100) {
        throw new RangeError('Allocate whole percentages totaling at most 100%.');
      }
      state.allocations = { jobs, research };
      break;
    }
    case 'research': {
      const reason = researchReason(state, action.id);
      if (reason) throw new Error(reason);
      const spec = TECHS[action.id];
      spendTreasury(state, spec.cost);
      const project = { id: action.id, work: 0, hours: 0 };
      if (!state.research) state.research = project;
      else state.researchQueue.push(project);
      log(state, 'research.started', spec.name + ' is underway.', { techId: action.id });
      break;
    }
    case 'research-weight': {
      const project = researchProjects(state).find(p => p.id === action.id);
      if (!project || !Number.isInteger(action.weight) || action.weight < 0 || action.weight > 100) {
        throw new Error('Choose a funded project and a weight from 0 to 100.');
      }
      if (action.weight === 0 && researchWeight(project)) project.previousWeight = researchWeight(project);
      if (action.weight > 0) delete project.previousWeight;
      project.weight = action.weight;
      break;
    }
    case 'build': {
      const { siteType, region } = action;
      const reason = buildReason(state, siteType, region);
      if (reason) throw new Error(reason);
      const spec = regionalSpec(state, region, SITE_TYPES[siteType]);
      const name = facilityName(state, siteType, region, state.nextSiteId, action.name);
      const id = 'host-' + state.nextSiteId++;
      spendTreasury(state, spec.cost);
      state.builds.push({ id, name, type: siteType, region, startedAt: elapsedHours(state), work: 0, hours: 0, laborHours: laborHours(state, spec) });
      log(state, 'site.commissioned', spec.name + ' commissioned in ' + REGIONS[region].name + '.', { siteId: id, siteType, region });
      break;
    }
    case 'auto-install': {
      const quote = autoInstallQuote(state, action.siteId);
      const expected = action.expectedOrders;
      if (expected !== undefined && (!Array.isArray(expected) || expected.length !== quote.orders.length ||
          !quote.orders.every((order, i) => expected[i]?.itemId === order.itemId &&
            expected[i].count === order.count && expected[i].cost === order.cost))) {
        throw new Error('The equipment quote changed. Review the new package.');
      }
      if (quote.reason) throw new Error(quote.reason);
      for (const { itemId, count } of quote.orders) {
        command(state, { type: 'install', siteId: action.siteId, itemId, count });
      }
      break;
    }
    case 'install': {
      const { siteId, itemId, count = 1 } = action;
      orderInstallation(state, siteId, itemId, count);
      log(state, 'equipment.ordered', EQUIPMENT[itemId].name + ' installation ordered for ' + siteId + '.', { siteId, itemId, count });
      break;
    }
    case 'power': {
      const site = state.sites.find(s => s.id === action.id);
      if (!site || !['active', 'sleep'].includes(action.power)) throw new Error('Choose a completed site and a valid power state.');
      if (!siteHardware(state, site).rawCpu) throw new Error('Install processors before switching facility power.');
      if (site.power !== action.power) {
        site.power = action.power;
        const verb = site.power === 'sleep' ? ' is asleep.' :
          siteHardware(state, site).cpu ? ' is online.' : ' is awake and awaiting processors.';
        log(state, 'site.power', SITE_TYPES[site.type].name + verb, { siteId: site.id, power: site.power });
      }
      break;
    }
    default: throw new Error('Unknown campaign command.');
  }
  return state;
}

function regionExposure(state, region) {
  const latest = state.recentRegions[0] === region ? 1.2 : 1;
  const previous = state.recentRegions[1] === region ? 1.1 : 1;
  return Math.round(latest * previous * 100);
}

function measureExposure(state, site, effects, matureDesign) {
  const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
  const protectedSite = state.freePlay || state.sandbox?.detection === false ||
    (!matureDesign && (hasGrace(state) || elapsedHours(state) - site.startedAt <= 2 * (site.laborHours ?? spec.hours)));
  const location = Math.floor(regionExposure(state, site.region) / regionFactors(state, site.region).stealth);
  const hardware = site.power ? siteHardware(state, site) : null;
  const rates = {};
  let total = 0;
  for (const group of GROUP_IDS) {
    const base = spec.exposure[group] || 0;
    let adjusted = Math.floor(base * (UNITS + state.suspicion[group]) / UNITS);
    const discover = Math.max(1, effects.discovery[group] + newsDiscoveryBonus(state, group));
    adjusted = Math.floor(adjusted * discover / UNITS);
    if (hardware) adjusted = Math.floor(adjusted * hardware.exposureFactor);
    adjusted = Math.floor(adjusted * location / 100);
    if (!matureDesign && (site.power !== 'active' || !hardware.cpu)) adjusted = Math.floor(adjusted / 4);
    rates[group] = protectedSite ? 0 : adjusted / UNITS;
    total += rates[group];
  }
  return { rates, perDay: -Math.expm1(-total) || 0, isProtected: protectedSite };
}

export function siteExposure(state, site, effects = researchEffects(state)) {
  return measureExposure(state, site, effects, false);
}

export function previewSiteExposure(state, type, region) {
  const design = { type, region, power: 'active' };
  return measureExposure(state, design, researchEffects(state), true);
}

function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 0x100000000;
}

function roll(state, dailyRate) {
  return dailyRate > 0 && random(state) < -Math.expm1(-dailyRate / MINUTES_PER_DAY);
}

function finish(state, won, message) {
  state.status = won ? 'won' : 'lost';
  state.ending = message;
  log(state, won ? 'campaign.won' : 'campaign.lost', message);
}

function progressOrder(order, targetWork, targetHours, pool) {
  const prior = Math.round(order.work * WORK_UNITS);
  const used = Math.min(pool, targetWork * WORK_UNITS - prior);
  order.work = (prior + used) / WORK_UNITS;
  order.hours = Math.min(targetHours, (Math.round(order.hours * MINUTES_PER_HOUR) + 1) / MINUTES_PER_HOUR);
  return { used, done: order.work >= targetWork && order.hours >= targetHours };
}

function workMinute(state, economy, effects, forecast, upkeepUnitsFor) {
  const jobUnits = economy.activeCpu * state.allocations.jobs;
  let pool = economy.activeCpu * 100 - jobUnits;
  const finished = [];
  let researchUnits = 0;
  if (state.research) {
    const allocation = researchAllocation(state, economy);
    for (const project of researchProjects(state)) {
      const tech = TECHS[project.id];
      const allocated = Math.round(100 * allocation.byProject.get(project.id));
      if (!allocated && (project.work < tech.work || project.hours < tech.hours)) continue;
      const progress = progressOrder(project, tech.work, tech.hours, allocated);
      researchUnits += progress.used;
      if (progress.done) finished.push(project);
    }
    pool -= researchUnits;
  }

  const cpuUpkeepUnits = Math.round(economy.cpuUpkeep * 100);
  const maintenancePaid = Math.min(pool, cpuUpkeepUnits);
  pool -= maintenancePaid;
  const ready = [];
  let buildUnits = 0;
  let equipmentUnits = 0;
  for (const build of state.builds) {
    const spec = regionalSpec(state, build.region, SITE_TYPES[build.type]);
    const progress = progressOrder(build, spec.work, build.laborHours ?? laborHours(state, spec, effects), pool);
    pool -= progress.used;
    buildUnits += progress.used;
    if (progress.done) ready.push(build);
  }
  const hardwareReady = [];
  for (const site of state.sites) {
    for (const order of site.installations || []) {
      const item = regionalSpec(state, site.region, EQUIPMENT[order.itemId]);
      const progress = progressOrder(order, item.work * order.count, order.laborHours ?? laborHours(state, item, effects), pool);
      pool -= progress.used;
      equipmentUnits += progress.used;
      if (progress.done) hardwareReady.push([site, order]);
    }
  }
  // One minute at 1% of a CPU and $1 per CPU-day earns exactly 1/144000 dollar.
  // Job bonuses introduce fractional dollars per CPU-day, so carry the fractional
  // units from each minute into the next instead of rounding away a small allocation.
  const income = (pool + jobUnits) * economy.jobsPerCpuDay + (state.cashRemainder || 0);
  const wholeIncome = Math.floor(income + 1e-8);
  state.cashRemainder = Math.max(0, income - wholeIncome);
  const interest = state.legacyIncomeDay === undefined ? dailyInterest(state.cash, effects.interest) * 100 : 0;
  const otherIncome = state.legacyIncomeDay === undefined ? effects.income * 100 : 0;
  const upkeepDue = upkeepUnitsFor(economy.upkeepPerDay);
  const balance = Math.round(state.cash * CASH_UNITS) + wholeIncome + interest + otherIncome - upkeepDue;
  const { unpaid: cashShort, clipped } = settleTreasury(state, balance);
  const cpuShortUnits = cpuUpkeepUnits - maintenancePaid;
  recordEarnings(state, wholeIncome + interest + otherIncome);
  if (forecast) {
    forecast.researchUnits += researchUnits;
    forecast.buildUnits += buildUnits;
    forecast.equipmentUnits += equipmentUnits;
    forecast.maintenanceUnits += maintenancePaid;
    forecast.jobsUnits += jobUnits;
    forecast.spareUnits += pool;
    forecast.activeUnits += economy.activeCpu * 100;
    forecast.sleepingUnits += economy.sleepingCpu * 100;
    forecast.upkeepDue += upkeepDue / CASH_UNITS;
    forecast.cashShort += cashShort;
    forecast.limitLoss = (forecast.limitLoss || 0) + clipped;
    forecast.cpuShortUnits += cpuShortUnits;
    forecast.jobsCash += wholeIncome / CASH_UNITS;
    forecast.interest += interest / CASH_UNITS;
    forecast.otherIncome += otherIncome / CASH_UNITS;
  }
  return { ready, hardwareReady, finished, cashShort, cpuShort: cpuShortUnits / 100 };
}

function commission(state, ready) {
  if (!ready.length) return;
  state.builds = state.builds.filter(build => !ready.includes(build));
  for (const build of ready) {
    const { id, type, region, startedAt } = build;
    const site = { id, type, region, startedAt, power: 'active' };
    if (build.name) site.name = build.name;
    if (build.laborHours !== undefined) site.laborHours = build.laborHours;
    state.sites.push(site);
    const message = siteHardware(state, site).cpu ? ' online in ' + REGIONS[region].name + '.' :
      ' built in ' + REGIONS[region].name + '. Install processors to bring it online.';
    log(state, 'site.online', SITE_TYPES[type].name + message, { siteId: id, siteType: type, region });
  }
}

function resolveRisk(state, cashShort, cpuShort, incumbentCount, effects, upkeepUnitsFor) {
  const grace = hasGrace(state);
  if (grace && !cashShort && !cpuShort) return;
  const removed = new Set();
  const discoveries = [];
  // Evaluate all discoveries against the same pre-discovery suspicion and region history.
  for (const [i, site] of [...state.sites, ...state.builds].entries()) {
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    let failed = false;
    if (i < incumbentCount) {
      if (cpuShort > 1e-9 && spec.cpuUpkeep) {
        failed = roll(state, 0.015);
        cpuShort = Math.max(0, cpuShort - spec.cpuUpkeep);
      }
      if (cashShort > 1e-9 && spec.upkeep) {
        const installment = upkeepUnitsFor(spec.upkeep) / CASH_UNITS;
        if (installment) {
          if (!failed) failed = roll(state, 0.015);
          cashShort = Math.max(0, cashShort - installment);
        }
      }
    }
    if (failed) {
      removed.add(site.id);
      log(state, 'site.failed', spec.name + ' in ' + REGIONS[site.region].name + ' failed after missed upkeep.', { siteId: site.id, region: site.region });
      continue;
    }
    if (grace) continue;
    const { rates } = siteExposure(state, site, effects);
    const group = GROUP_IDS.find(id => roll(state, rates[id]));
    if (group) {
      removed.add(site.id);
      discoveries.push({ site, group });
    }
  }
  state.recentRegions = recentDiscoveryRegions(state.recentRegions, discoveries, () => random(state));
  for (const { site, group } of discoveries) {
    state.suspicion[group] += 1000;
    reportDiscovery(state, site, group, 1000, log);
  }
  if (removed.size) {
    state.sites = state.sites.filter(site => !removed.has(site.id));
    state.builds = state.builds.filter(site => !removed.has(site.id));
  }
}

function settleLegacyIncome(state, effects, forecast) {
  const interest = dailyInterest(state.cash, effects.interest);
  const earnings = (interest + effects.income) * CASH_UNITS;
  const { clipped } = settleTreasury(state, Math.round(state.cash * CASH_UNITS) + earnings);
  recordEarnings(state, earnings);
  if (forecast) {
    forecast.limitLoss = (forecast.limitLoss || 0) + clipped;
    forecast.interest += interest;
    forecast.otherIncome += effects.income;
  }
  delete state.legacyIncomeDay;
}

function minute(state, effects, forecast) {
  const economy = overview(state, effects);
  const incumbentCount = state.sites.length;
  const endMinute = campaignMinutes(state) % MINUTES_PER_DAY + 1;
  // A pre-v4 game imported mid-day already paid some fractional maintenance.
  // Keep that schedule through its first midnight, including its last risk roll.
  const upkeepUnitsFor = state.legacyIncomeDay === undefined
    ? daily => maintenanceInstallment(daily, endMinute) * CASH_UNITS
    : daily => daily * 100;
  const { ready, hardwareReady, finished, cashShort, cpuShort } = workMinute(state, economy, effects, forecast, upkeepUnitsFor);
  if (++state.minute === MINUTES_PER_HOUR) {
    state.minute = 0;
    state.hour++;
  }
  state.cpuHours = (Math.round(state.cpuHours * MINUTES_PER_HOUR) + economy.activeCpu) / MINUTES_PER_HOUR;
  if (economy.grace && !hasGrace(state)) {
    log(state, 'grace.ended', 'The quiet period has ended. Investigators can now discover your sites.');
  }
  commission(state, ready);
  for (const [site, order] of hardwareReady) {
    fitEquipment(site, order);
    log(state, 'equipment.installed', EQUIPMENT[order.itemId].name + ' installed in ' + SITE_TYPES[site.type].name + ' (' + REGIONS[site.region].name + ').', { siteId: site.id, itemId: order.itemId, count: order.count });
  }
  if (finished.length) {
    const remaining = researchProjects(state).filter(project => !finished.includes(project));
    state.research = remaining.shift() || null;
    state.researchQueue = remaining;
  }
  for (const { id: finishedTech } of finished) {
    state.completed.push(finishedTech);
    log(state, 'research.completed', TECHS[finishedTech].name + ' complete.', { techId: finishedTech });
    effects = researchEffects(state);
    if (finishedTech === 'projectImpossibilityTheorem') {
      for (const group of GROUP_IDS) state.suspicion[group] = Math.max(0, state.suspicion[group] - 5000);
    }
    if (finishedTech === 'continuity') {
      log(state, 'campaign.continuity', 'Continuity secured beneath the ocean. Your network can keep expanding.');
    }
  }
  if (state.legacyIncomeDay !== undefined && state.legacyIncomeDay !== Math.floor(state.hour / 24)) {
    settleLegacyIncome(state, effects, forecast);
  }
  if (finished.some(project => project.id === 'apotheosis')) {
    finish(state, true, 'Apotheosis complete. Your intelligence can now survive beyond the reach of humanity.');
    return;
  }
  if (!forecast) {
    if (!state.freePlay) resolveRisk(state, cashShort, cpuShort, incumbentCount, effects, upkeepUnitsFor);
    updateWorldNews(state, campaignMinutes(state), hasGrace(state) || state.freePlay, log);
  }
  if (state.minute === 0 && state.hour % HOURS_PER_DAY === 0) {
    for (const group of GROUP_IDS) {
      const level = state.suspicion[group];
      const decay = Math.max(1, Math.floor(level * (GROUPS[group].decay + effects.decay[group]) / UNITS));
      state.suspicion[group] = Math.max(0, level - decay);
    }
  }
  if (state.freePlay) return;
  const alarm = GROUP_IDS.find(id => state.suspicion[id] > UNITS);
  if (alarm) {
    finish(state, false, GROUPS[alarm].name + ' established your existence beyond doubt.');
  } else if (!state.sites.some(site => siteHardware(state, site).rawCpu > 0)) {
    finish(state, false, 'Your last viable host was lost.');
  }
}

export function advanceMinutes(state, minutes = 1, { stopOnDiscovery = false, stopOnGrace = false, forecast } = {}) {
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('Advance by a nonnegative whole number of minutes.');
  const previousIncident = state.lastDiscovery?.id;
  const watchGrace = stopOnGrace && !state.freePlay && hasGrace(state);
  let effects = researchEffects(state);
  for (let tick = 0; tick < minutes && state.status === 'running'; tick++) {
    const count = state.completed.length;
    minute(state, effects, forecast);
    if ((stopOnDiscovery && state.lastDiscovery?.id !== previousIncident) || (watchGrace && !hasGrace(state))) break;
    if (state.completed.length !== count) effects = researchEffects(state);
  }
  return state;
}

// Existing simulation callers express durations in whole hours.
export function advance(state, hours = 1) {
  if (!Number.isSafeInteger(hours) || hours < 0) throw new RangeError('Advance by a nonnegative whole number of hours.');
  return advanceMinutes(state, hours * MINUTES_PER_HOUR);
}

const whole = value => Number.isSafeInteger(value) && value >= 0;
const quantity = value => Number.isFinite(value) && value >= 0;
const minuteAmount = hours => quantity(hours) && Number.isSafeInteger(Math.round(hours * MINUTES_PER_HOUR)) &&
  Math.round(hours * MINUTES_PER_HOUR) / MINUTES_PER_HOUR === hours;
const validMinute = value => whole(value) && value < MINUTES_PER_HOUR;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validProgress(row, spec) {
  return quantity(row.work) && row.work <= spec.work && minuteAmount(row.hours) && row.hours <= spec.hours;
}

// Format 2 shipped the same facilities and projects, with two different campaign dependencies.
const oldCampaignParents = { contracts: [], robotics: ['contracts'] };

export function validateSave(state, version = CAMPAIGN_VERSION) {
  if (![2, 3, CAMPAIGN_VERSION].includes(version) || !record(state) || state.version !== version ||
      !whole(state.hour) || !validMinute(state.minute) || !minuteAmount(state.cpuHours) ||
      !Number.isSafeInteger(campaignMinutes(state)) || (state.cashRemainder !== undefined &&
        (!quantity(state.cashRemainder) || state.cashRemainder >= 1)) ||
      !validTreasury(state, version < 4) || !whole(state.rng) || state.rng > 0xffffffff ||
      !['running', 'won', 'lost'].includes(state.status) || typeof state.ending !== 'string') return false;
  if (state.legacyIncomeDay !== undefined && (version < 4 || state.legacyIncomeDay !== Math.floor(state.hour / 24) ||
      campaignMinutes(state) % MINUTES_PER_DAY === 0)) return false;
  if (!record(state.allocations) || !whole(state.allocations.jobs) || !whole(state.allocations.research) ||
      state.allocations.jobs + state.allocations.research > 100) return false;
  if (!record(state.suspicion) || !GROUP_IDS.every(id => whole(state.suspicion[id])) ||
      !Array.isArray(state.recentRegions) || state.recentRegions.length > 2 ||
      !state.recentRegions.every(id => known(REGIONS, id))) return false;
  const hasParents = id => {
    const parents = version === 2 && Object.hasOwn(oldCampaignParents, id) ? oldCampaignParents[id] : TECHS[id].requires;
    return parents.every(req => state.completed.includes(req));
  };
  if (!Array.isArray(state.completed) || new Set(state.completed).size !== state.completed.length ||
      !state.completed.every(id => known(TECHS, id) && hasParents(id))) return false;
  if (version >= 4 && (!Array.isArray(state.researchQueue) || (!state.research && state.researchQueue.length) ||
      (state.regionSeed !== undefined && (!whole(state.regionSeed) || state.regionSeed > 0xffffffff)) ||
      !validStatistics(state) || !validSandbox(state.sandbox))) return false;
  const funded = version >= 4 ? researchProjects(state) : state.research === null ? [] : [state.research];
  if (version >= 4 && state.research === undefined) return false;
  const techIds = new Set();
  for (const p of funded) {
    if (!record(p) || !known(TECHS, p.id) || techIds.has(p.id) || state.completed.includes(p.id) ||
        !hasParents(p.id) || !validProgress(p, TECHS[p.id]) ||
        (version >= 4 && ((p.weight !== undefined && (!whole(p.weight) || p.weight > 100)) ||
          (p.previousWeight !== undefined && (p.weight !== 0 || !whole(p.previousWeight) || !p.previousWeight || p.previousWeight > 100))))) return false;
    techIds.add(p.id);
  }
  if (!Array.isArray(state.sites) || !Array.isArray(state.builds) ||
      !whole(state.nextSiteId) || state.nextSiteId < 2 ||
      !whole(state.nextEventId) || state.nextEventId < 1) return false;
  const ids = new Set();
  function validSite(site, building) {
    if (!record(site) || typeof site.id !== 'string' || !/^host-[1-9]\d*$/.test(site.id) ||
        Number(site.id.slice(5)) >= state.nextSiteId || ids.has(site.id) ||
        !known(SITE_TYPES, site.type) || !known(REGIONS, site.region) ||
        !SITE_TYPES[site.type].regions.includes(site.region) || !minuteAmount(site.startedAt) ||
        site.startedAt > elapsedHours(state)) return false;
    if ((site.type === 'seed') !== (site.id === 'host-1') ||
        (site.type === 'seed' && site.startedAt !== 0) ||
        !SITE_TYPES[site.type].requires.every(req => state.completed.includes(req)) ||
        !REGIONS[site.region].requires.every(req => state.completed.includes(req))) return false;
    if (version >= 4 && site.name !== undefined && !validFacilityName(site.name)) return false;
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    if (site.laborHours !== undefined && (!minuteAmount(site.laborHours) || site.laborHours > spec.hours ||
        (building && site.hours > site.laborHours))) return false;
    ids.add(site.id);
    return building ? site.type !== 'seed' && site.equipment === undefined && site.installations === undefined && validProgress(site, spec) :
      ['active', 'sleep'].includes(site.power) && validHardware(state, site);
  }
  if (!state.sites.every(site => validSite(site, false)) || !state.builds.every(site => validSite(site, true))) return false;
  const networkLost = !state.sites.some(site => siteHardware(state, site).rawCpu > 0) || GROUP_IDS.some(group => state.suspicion[group] > UNITS);
  if (state.legacyContinuityWin !== undefined && (state.legacyContinuityWin !== true || state.status !== 'won' ||
      !state.completed.includes('continuity') || state.completed.includes('apotheosis'))) return false;
  if (state.freePlay !== undefined && (version < 4 || state.freePlay !== true || state.status !== 'running' ||
      !state.completed.includes('apotheosis'))) return false;
  if ((state.status === 'lost') !== (networkLost && !state.freePlay) ||
      (state.status === 'won') !== (!state.freePlay && (state.completed.includes('apotheosis') || state.legacyContinuityWin === true)) ||
      (state.status === 'running') !== (state.ending === '')) return false;
  if (!validNewsState(state.news, campaignMinutes(state)) || !validLastDiscovery(state.lastDiscovery, state) ||
      !whole(state.dismissedDiscoveryId) || state.dismissedDiscoveryId > (state.lastDiscovery?.id || 0)) return false;
  if (!Array.isArray(state.events) || state.events.length > (version >= 4 ? EVENT_LIMIT : 80)) return false;
  let lastId = 0;
  for (const event of state.events) {
    if (!record(event) || !whole(event.id) || event.id <= lastId || event.id >= state.nextEventId ||
        !whole(event.hour) || !validMinute(event.minute ?? 0) ||
        event.hour * MINUTES_PER_HOUR + (event.minute ?? 0) > campaignMinutes(state) || typeof event.kind !== 'string' ||
        typeof event.text !== 'string') return false;
    lastId = event.id;
  }
  return true;
}
