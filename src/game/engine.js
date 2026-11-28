import { allocateProjects, assignmentLimit, eligibleCpu, portfolioLimit, requestedAssignments, researchProjects, resizePortfolio, taskCpuLimit, taskReservations, validCpu } from './research-tasks.js';
export { researchProjects } from './research-tasks.js';
import { settleTreasury, spendTreasury, spendableDollars, validTreasury } from './treasury.js';
import { initializeStatistics, recordCreated, recordEarnings, validStatistics } from './report-accounting.js';
import { regionalSpec, regionFactors, facilityName, validFacilityName, applyFacilityCommand, markLostRegions } from './facility-operations.js';
import { developerCommand, validSandbox } from './devtools.js';
import { createNewsState, interruptingReport, newsDiscoveryBonus, reportDiscovery, updateWorldNews, validLastDiscovery, validNewsState } from './events.js';
import { dailyInterest, maintenanceInstallment, recentDiscoveryRegions } from './normal-economy.js';
import { NORMAL, dailyEvidenceDecay, siteHasGrace } from './normal-difficulty.js';
import { startingRegion } from './geography.js';
import { laborHours, researchEffects } from './research.js';
import { nextOrderMinute, orderStatus, validOrderFunding, WORK_UNITS } from './work-order.js';
export { laborHours } from './research.js';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from './content.js';

import { autoInstallQuote, autoUpgradeQuote, fitEquipment, orderInstallation, siteHardware, validHardware } from './equipment.js';
export { autoInstallQuote, autoUpgradeQuote, equipmentRank, hostRank, installQuote, installReason, siteHardware } from './equipment.js';

const HOURS_PER_DAY = 24;
const UNITS = 10_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
export const CAMPAIGN_VERSION = 6;
const CASH_UNITS = WORK_UNITS * HOURS_PER_DAY;
const GROUP_IDS = Object.keys(GROUPS);
const EVENT_LIMIT = 1000;
const known = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const hoursOfGrace = NORMAL.openingDays * HOURS_PER_DAY;
const cpuHourGraceBudget = NORMAL.openingCpuDays * HOURS_PER_DAY;

export const campaignMinutes = state => state.hour * MINUTES_PER_HOUR + state.minute;
const elapsedHours = state => campaignMinutes(state) / MINUTES_PER_HOUR;

export function log(state, kind, text, detail = {}) {
  const event = { id: state.nextEventId++, hour: state.hour, minute: state.minute, kind, text, ...detail };
  recordCreated(state, kind, detail);
  state.events.push(event);
  if (state.events.length > EVENT_LIMIT) state.events.shift();
  return event;
}

export function createGame(seed = 1, startUtcMinute = 0) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Choose an unsigned 32-bit seed.');
  }
  if (!Number.isInteger(startUtcMinute) || startUtcMinute < 0 || startUtcMinute >= MINUTES_PER_DAY) {
    throw new RangeError('Choose a starting UTC minute within one day.');
  }
  const state = {
    version: CAMPAIGN_VERSION, hour: 0, minute: 0, cash: NORMAL.startingCash, regionSeed: seed, rng: seed, status: 'running', ending: '',
    startUtcMinute, allocations: { jobs: 0 },
    sites: [{ id: 'host-1', name: 'University computer', type: 'seed', region: startingRegion(seed), power: 'active', startedAt: 0 }],
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
  return state.completed.includes('apotheosis') || (state.hour < hoursOfGrace && state.cpuHours <= cpuHourGraceBudget);
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
    jobsPerCpuDay: effects.jobsPerCpuDay, jobName: effects.jobName, jobDescription: effects.jobDescription,
  };
}

export function researchAllocation(state, economy = overview(state)) {
  return allocateProjects(state, economy);
}

export function researchCpuLimit(state, id, economy = overview(state), allocation = researchAllocation(state, economy)) {
  if (!known(TECHS, id) || state.status !== 'running') return 0;
  return assignmentLimit(state, id, economy, allocation);
}

export function researchResizeLimit(state, economy = overview(state)) {
  return state.status === 'running' ? portfolioLimit(state, economy) : 0;
}

export function buildReason(state, type, region) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (!known(SITE_TYPES, type) || !known(REGIONS, region)) return 'Unknown site or region.';
  if (type === 'seed') return 'The starting terminal is unique.';
  const spec = regionalSpec(state, region, SITE_TYPES[type]);
  if (!spec.regions.includes(region)) return 'Choose a compatible region.';
  const prerequisite = [...REGIONS[region].requires, ...spec.requires].find(id => !state.completed.includes(id));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
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
  return '';
}

function materializeResearch(state, projects, economy, allocation) {
  const requested = requestedAssignments(projects, state.researchTarget);
  projects.forEach((project, i) => {
    project.cpu = eligibleCpu(economy, TECHS[project.id]) ? allocation.byProject.get(project.id) : requested[i];
  });
  delete state.researchTarget;
}

function assignResearch(state, id, cpu) {
  if (!known(TECHS, id) || !validCpu(cpu)) throw new RangeError('Choose a topic and a nonnegative CPU amount in hundredths.');
  const projects = researchProjects(state);
  let project = projects.find(p => p.id === id);
  if (!project && !cpu) return;
  if (!project) {
    const reason = researchReason(state, id);
    if (reason) throw new Error(reason);
  }
  const economy = overview(state);
  const allocation = researchAllocation(state, economy);
  const maximum = researchCpuLimit(state, id, economy, allocation);
  if (cpu > maximum) throw new RangeError('At most ' + maximum + ' CPU are available for this project.');
  // A direct edit starts from the visible assignments. Clearing one member
  // of a muted portfolio still lets the master restore the remaining mix.
  const keepMuted = state.researchTarget === 0 && cpu === 0;
  if (!keepMuted) materializeResearch(state, projects, economy, allocation);
  if (!project) {
    const spec = TECHS[id];
    project = { id, work: 0, hours: 0, cpu, cashRequired: spec.cost, cashPaid: 0, workRequired: spec.work };
    if (!state.research) state.research = project;
    else state.researchQueue.push(project);
    log(state, 'research.started', TECHS[id].name + ' is underway.', { techId: id });
  } else {
    project.cpu = cpu;
    if (!projects.some(p => p.cpu > 0)) delete state.researchTarget;
  }
}

export function command(state, action) {
  if (action?.type === 'acknowledge-discovery' && state.lastDiscovery && state.lastDiscovery.id === action.id) {
    state.dismissedDiscoveryId = action.id;
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
    developerCommand(state, action, { log, researchAllocation });
    return state;
  }
  if (applyFacilityCommand(state, action, log)) return state;
  switch (action?.type) {
    case 'allocate': {
      const { jobs, research } = action;
      if (!Number.isInteger(jobs) || jobs < 0 || jobs > 100 ||
          (research !== undefined && (!Number.isFinite(research) || research < 0 || jobs + research > 100))) {
        throw new RangeError('Allocate percentages totaling at most 100%.');
      }
      const economy = overview(state);
      const before = researchAllocation(state, economy);
      state.allocations.jobs = jobs;
      delete state.allocations.jobsCpu;
      const limit = taskReservations(state, economy).researchLimit;
      if (research !== undefined) {
        resizePortfolio(state, Math.round(economy.activeCpu * research) / 100, economy);
      } else if (before.budget > limit) {
        resizePortfolio(state, limit, economy);
      }
      break;
    }
    case 'assign-task': {
      const { task, cpu } = action;
      if (!['jobs', 'pool'].includes(task) || !validCpu(cpu)) throw new RangeError('Choose a paid work or pool reservation in hundredths of a CPU.');
      const economy = overview(state);
      const maximum = taskCpuLimit(state, task, economy, researchAllocation(state, economy));
      if (cpu > maximum) throw new RangeError('At most ' + maximum + ' CPU are available for this task.');
      if (task === 'jobs') state.allocations.jobsCpu = cpu;
      else state.allocations.poolCpu = cpu;
      break;
    }
    case 'resize-research': {
      if (!validCpu(action.cpu)) throw new RangeError('Choose a nonnegative CPU amount in hundredths.');
      resizePortfolio(state, action.cpu, overview(state));
      break;
    }
    case 'assign-research':
      assignResearch(state, action.id, action.cpu);
      break;
    case 'research': {
      // Compatibility for scripts and the developer console. Gameplay uses an
      // explicit CPU count, including when confirming a forecast.
      const reason = researchReason(state, action.id);
      if (reason) throw new Error(reason);
      const economy = overview(state);
      const cpu = Math.min(economy.activeCpu / 2, researchCpuLimit(state, action.id, economy));
      if (!cpu) throw new Error('Free some CPU before assigning research.');
      assignResearch(state, action.id, cpu);
      break;
    }
    case 'build': {
      const { siteType, region } = action;
      const reason = buildReason(state, siteType, region);
      if (reason) throw new Error(reason);
      const spec = regionalSpec(state, region, SITE_TYPES[siteType]);
      const name = facilityName(state, siteType, region, state.nextSiteId, action.name);
      const id = 'host-' + state.nextSiteId++;
      state.builds.push({ id, name, type: siteType, region, startedAt: elapsedHours(state), work: 0, hours: 0,
        cashRequired: spec.cost, cashPaid: 0, workRequired: spec.work, laborHours: laborHours(state, spec) });
      log(state, 'site.commissioned', spec.name + ' commissioned in ' + REGIONS[region].name + '.', { siteId: id, siteType, region });
      break;
    }
    case 'auto-install':
    case 'auto-upgrade': {
      const quote = action.type === 'auto-install' ? autoInstallQuote(state, action.siteId) : autoUpgradeQuote(state, action.siteId);
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
      orderInstallation(state, siteId, itemId, count, action.expectedSlot);
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

export function regionDiscoveryPercent(state, region) {
  const latest = state.recentRegions[0] === region ? 1.2 : 1;
  const previous = state.recentRegions[1] === region ? 1.1 : 1;
  return Math.floor(Math.round(latest * previous * 100) / regionFactors(state, region).stealth);
}

export function designExposureUnits(state, group, base, effects = researchEffects(state)) {
  const withEvidence = Math.floor(base * (UNITS + (state.suspicion?.[group] || 0)) / UNITS);
  const discover = Math.max(1, effects.discovery[group] + newsDiscoveryBonus(state, group));
  return Math.floor(withEvidence * discover / UNITS);
}

function measureExposure(state, site, effects, matureDesign) {
  const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
  const protectedSite = state.completed.includes('apotheosis') || state.sandbox?.detection === false ||
    (!matureDesign && (hasGrace(state) || siteHasGrace(campaignMinutes(state), site.startedAt, site.laborHours ?? spec.hours)));
  const location = regionDiscoveryPercent(state, site.region);
  const hardware = site.power ? siteHardware(state, site) : null;
  const rates = {};
  let total = 0;
  for (const group of GROUP_IDS) {
    const base = spec.exposure[group] || 0;
    let adjusted = designExposureUnits(state, group, base, effects);
    if (hardware) adjusted = Math.floor(adjusted * hardware.exposureNumerator / 100_000_000);
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

function upkeepForMinute(state) {
  const endMinute = campaignMinutes(state) % MINUTES_PER_DAY + 1;
  return daily => maintenanceInstallment(daily, endMinute) * CASH_UNITS;
}

function dispatchWork(state, economy, effects, upkeepDue, statuses) {
  const jobUnits = Math.round(taskReservations(state, economy).jobs * 100);
  const jobIncome = Math.floor(jobUnits * economy.jobsPerCpuDay + (state.cashRemainder || 0) + 1e-8);
  const interest = dailyInterest(spendableDollars(state), effects.interest) * 100;
  const otherIncome = effects.income * 100;
  // Passive income and dedicated jobs pay before construction. Upkeep has
  // first claim on cash. The spare pool earns its income after the queue runs.
  const fraction = Math.round((state.cash % 1) * CASH_UNITS);
  const availableIncome = Math.floor((fraction + interest + otherIncome + jobIncome - upkeepDue) / CASH_UNITS);
  let cash = Math.max(0, spendableDollars(state) + availableIncome);
  let pool = economy.activeCpu * 100 - jobUnits;
  let blockedBy = economy.activeCpu ? 'CPU reserved for jobs' : 'No active CPU';
  function advanceOrder(order, work, hours, available, construction) {
    const next = nextOrderMinute(order, work, hours, available, cash);
    if (!statuses) {
      order.work = next.work;
      order.hours = next.hours;
      order.cashPaid += next.spent;
    } else {
      const group = construction ? statuses.orders : statuses.research;
      group.set(order, orderStatus(order, work, hours, available, cash, next, blockedBy));
    }
    cash -= next.spent;
    return next;
  }
  const finished = [];
  let researchUnits = 0;
  let researchCash = 0;
  if (state.research) {
    const allocation = researchAllocation(state, economy);
    for (const project of researchProjects(state)) {
      const tech = TECHS[project.id];
      const allocated = Math.round(100 * allocation.byProject.get(project.id));
      if (!allocated && (project.work < tech.work || project.hours < tech.hours || project.cashPaid < project.cashRequired)) continue;
      const progress = advanceOrder(project, tech.work, tech.hours, allocated, false);
      researchUnits += progress.used;
      researchCash += progress.spent;
      if (progress.done) finished.push(project);
    }
    if (!statuses && finished.length && state.researchTarget !== undefined) {
      const projects = researchProjects(state);
      const blocked = projects.some(p => !finished.includes(p) && p.cpu > 0 && !eligibleCpu(economy, TECHS[p.id]));
      if (state.researchTarget > 0 && blocked) {
        // A live project may have temporarily borrowed an offline line's
        // share. Its completion releases that CPU without cancelling the
        // offline experiment's standing request.
        materializeResearch(state, projects, economy, allocation);
      } else {
        const released = finished.reduce((total, p) => total + Math.round(allocation.byProject.get(p.id) * 100), 0);
        state.researchTarget = (Math.round(allocation.budget * 100) - released) / 100;
      }
    }
    pool -= researchUnits;
    if (!pool && researchUnits) blockedBy = 'CPU allocated to research';
  }

  const cpuUpkeepUnits = Math.round(economy.cpuUpkeep * 100);
  const maintenancePaid = Math.min(pool, cpuUpkeepUnits);
  pool -= maintenancePaid;
  if (!pool && maintenancePaid) blockedBy = 'CPU required for upkeep';
  const ready = [];
  let buildUnits = 0;
  let equipmentUnits = 0;
  let buildCash = 0;
  let equipmentCash = 0;
  for (const build of state.builds) {
    const progress = advanceOrder(build, build.workRequired, build.laborHours, pool, true);
    pool -= progress.used;
    if (!pool && progress.used) blockedBy = 'CPU serving earlier facility orders';
    buildUnits += progress.used;
    buildCash += progress.spent;
    if (progress.done) ready.push(build);
  }
  const hardwareReady = [];
  for (const site of state.sites) {
    for (const order of site.installations || []) {
      const progress = advanceOrder(order, order.workRequired, order.laborHours, pool, true);
      pool -= progress.used;
      if (!pool && progress.used) blockedBy = 'CPU serving earlier equipment orders';
      equipmentUnits += progress.used;
      equipmentCash += progress.spent;
      if (progress.done) hardwareReady.push([site, order]);
    }
  }
  return { jobUnits, pool, finished, ready, hardwareReady, researchUnits, buildUnits, equipmentUnits, maintenancePaid,
    researchCash, buildCash, equipmentCash, interest, otherIncome, cpuShortUnits: cpuUpkeepUnits - maintenancePaid };
}

// Predict exactly what the dispatcher will grant each queue entry next minute.
// ETA assumes the current CPU pool persists; later completions can release CPU.
export function previewWork(state, economy = overview(state)) {
  const statuses = { orders: new Map(), research: new Map() };
  const upkeep = upkeepForMinute(state)(economy.upkeepPerDay);
  const { researchUnits, cpuShortUnits } = dispatchWork(state, economy, researchEffects(state), upkeep, statuses);
  return { ...statuses, researchCpu: researchUnits / 100, maintenanceShort: cpuShortUnits / 100 };
}

export function constructionStatuses(state) {
  return previewWork(state).orders;
}

function workMinute(state, economy, effects, forecast, upkeepUnitsFor) {
  const upkeepDue = upkeepUnitsFor(economy.upkeepPerDay);
  const { jobUnits, pool, finished, ready, hardwareReady, researchUnits, buildUnits, equipmentUnits,
    maintenancePaid, cpuShortUnits, researchCash, buildCash, equipmentCash, interest, otherIncome } = dispatchWork(state, economy, effects, upkeepDue);
  // One minute at 1% of a CPU and $1 per CPU-day earns exactly 1/144000 dollar.
  // Job bonuses introduce fractional dollars per CPU-day, so carry the fractional
  // units from each minute into the next instead of rounding away a small allocation.
  const income = (pool + jobUnits) * economy.jobsPerCpuDay + (state.cashRemainder || 0);
  const wholeIncome = Math.floor(income + 1e-8);
  state.cashRemainder = Math.max(0, income - wholeIncome);

  const purchases = researchCash + buildCash + equipmentCash;
  const fromTreasury = Math.min(purchases, spendableDollars(state));
  if (fromTreasury) spendTreasury(state, fromTreasury);
  const balance = Math.round(state.cash * CASH_UNITS) + wholeIncome + interest + otherIncome - upkeepDue - (purchases - fromTreasury) * CASH_UNITS;
  // Upkeep is billed in whole dollars. Keep an earned fraction towards the
  // next payout even when the second payment attempt cannot cover a bill.
  const cashShort = Math.max(0, Math.ceil(-balance / CASH_UNITS) - (state.cashReserve || 0));
  const { clipped } = settleTreasury(state, balance + cashShort * CASH_UNITS);
  recordEarnings(state, wholeIncome + interest + otherIncome);
  if (forecast) {
    forecast.researchUnits += researchUnits;
    forecast.researchCash = (forecast.researchCash || 0) + researchCash;
    forecast.buildUnits += buildUnits;
    forecast.equipmentUnits += equipmentUnits;
    forecast.buildCash = (forecast.buildCash || 0) + buildCash;
    forecast.equipmentCash = (forecast.equipmentCash || 0) + equipmentCash;
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
    const siteName = site.name || SITE_TYPES[type].name;
    log(state, 'site.online', siteName + message, { siteId: id, ...(site.name ? { siteName } : {}), siteType: type, region });
  }
}

function resolveRisk(state, cashShort, cpuShort, incumbentCount, effects, upkeepUnitsFor) {
  const grace = hasGrace(state);
  if (grace && !cashShort && !cpuShort) return;
  const removed = new Map();
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
      const siteName = site.name || spec.name;
      const event = log(state, 'site.failed', siteName + ' in ' + REGIONS[site.region].name + ' failed after missed upkeep.',
        { siteId: site.id, ...(site.name ? { siteName } : {}), siteType: site.type, region: site.region });
      removed.set(site, event);
      continue;
    }
    if (grace) continue;
    const { rates } = siteExposure(state, site, effects);
    const group = GROUP_IDS.find(id => roll(state, rates[id]));
    if (group) discoveries.push({ site, group });
  }
  state.recentRegions = recentDiscoveryRegions(state.recentRegions, discoveries, () => random(state));
  for (const { site, group } of discoveries) {
    state.suspicion[group] += NORMAL.evidencePerDiscovery;
    reportDiscovery(state, site, group, NORMAL.evidencePerDiscovery, log);
    removed.set(site, state.lastDiscovery);
  }
  if (removed.size) {
    state.sites = state.sites.filter(site => !removed.has(site));
    state.builds = state.builds.filter(site => !removed.has(site));
    markLostRegions(state.sites, removed);
  }
}

function minute(state, effects, forecast) {
  const economy = overview(state, effects);
  const incumbentCount = state.sites.length;
  const upkeepUnitsFor = upkeepForMinute(state);
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
    const siteName = site.name || SITE_TYPES[site.type].name;
    const equipment = (order.count > 1 ? order.count + ' × ' : '') + EQUIPMENT[order.itemId].name;
    log(state, 'equipment.installed', equipment + ' installed in ' + siteName + ' (' + REGIONS[site.region].name + ').',
      { siteId: site.id, ...(site.name ? { siteName } : {}), siteType: site.type, region: site.region, itemId: order.itemId, count: order.count });
  }
  if (finished.length) {
    const remaining = researchProjects(state).filter(project => !finished.includes(project));
    state.research = remaining.shift() || null;
    state.researchQueue = remaining;
    if (!researchProjects(state).some(p => p.cpu > 0)) delete state.researchTarget;
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
      const decay = dailyEvidenceDecay(level, GROUPS[group].decay + effects.decay[group]);
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

export function advanceMinutes(state, minutes = 1, options = {}) {
  const { stopOnDiscovery, stopOnGrace, forecast } = options;
  const stopOnReport = options.stopOnWorldNews || options.stopOnLoss || options.stopOnCompletion;
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('Advance by a nonnegative whole number of minutes.');
  const previousIncident = state.lastDiscovery?.id;
  const watchGrace = stopOnGrace && !state.freePlay && hasGrace(state);
  let effects = researchEffects(state);
  for (let tick = 0; tick < minutes && state.status === 'running'; tick++) {
    const count = state.completed.length;
    const nextEvent = state.nextEventId;
    minute(state, effects, forecast);
    if (options.onDayEnd && state.minute === 0 && state.hour % 24 === 0 && state.status === 'running') {
      options.onDayEnd(state);
    }
    if ((stopOnDiscovery && state.lastDiscovery?.id !== previousIncident) || (watchGrace && !hasGrace(state)) ||
        (stopOnReport && state.nextEventId !== nextEvent && interruptingReport(state, options))) break;
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

export function validateSave(state) {
  if (!record(state) || state.version !== CAMPAIGN_VERSION ||
      !whole(state.startUtcMinute) || state.startUtcMinute >= MINUTES_PER_DAY ||
      !whole(state.hour) || !validMinute(state.minute) || !minuteAmount(state.cpuHours) ||
      !Number.isSafeInteger(campaignMinutes(state)) || (state.cashRemainder !== undefined &&
        (!quantity(state.cashRemainder) || state.cashRemainder >= 1)) ||
      !validTreasury(state) || !whole(state.rng) || state.rng > 0xffffffff ||
      !['running', 'won', 'lost'].includes(state.status) || typeof state.ending !== 'string') return false;
  if (!record(state.allocations) || !whole(state.allocations.jobs) || state.allocations.jobs > 100) return false;
  if ((state.allocations.jobsCpu !== undefined && !validCpu(state.allocations.jobsCpu)) ||
      (state.allocations.poolCpu !== undefined && !validCpu(state.allocations.poolCpu))) return false;
  if (state.allocations.research !== undefined ||
      (state.researchTarget !== undefined && !validCpu(state.researchTarget))) return false;
  if (!record(state.suspicion) || !GROUP_IDS.every(id => whole(state.suspicion[id])) ||
      !Array.isArray(state.recentRegions) || state.recentRegions.length > 2 ||
      !state.recentRegions.every(id => known(REGIONS, id))) return false;
  const hasParents = id => TECHS[id].requires.every(req => state.completed.includes(req));
  if (!Array.isArray(state.completed) || new Set(state.completed).size !== state.completed.length ||
      !state.completed.every(id => known(TECHS, id) && hasParents(id))) return false;
  if (!Array.isArray(state.researchQueue) || (!state.research && state.researchQueue.length) ||
      (!whole(state.regionSeed) || state.regionSeed > 0xffffffff) ||
      !validStatistics(state) || !validSandbox(state.sandbox)) return false;
  const funded = researchProjects(state);
  if (state.research === undefined) return false;
  const techIds = new Set();
  for (const p of funded) {
    if (!record(p) || !known(TECHS, p.id) || techIds.has(p.id) || state.completed.includes(p.id) ||
        !hasParents(p.id) || !validProgress(p, TECHS[p.id]) || p.cashRequired !== TECHS[p.id].cost ||
        p.workRequired !== TECHS[p.id].work || !validOrderFunding(p) ||
        !validCpu(p.cpu) || p.weight !== undefined || p.previousWeight !== undefined) return false;
    techIds.add(p.id);
  }
  if ((state.researchTarget !== undefined && !funded.some(p => p.cpu > 0)) ||
      !Number.isSafeInteger(funded.reduce((total, p) => total + Math.round(p.cpu * 100), 0))) return false;
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
    if (site.name !== undefined && !validFacilityName(site.name)) return false;
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    if (site.laborHours !== undefined && (!minuteAmount(site.laborHours) || site.laborHours > spec.hours ||
        (building && site.hours > site.laborHours))) return false;
    ids.add(site.id);
    return building ? site.type !== 'seed' && site.equipment === undefined && site.installations === undefined &&
      minuteAmount(site.laborHours) && site.cashRequired === spec.cost && site.workRequired === spec.work && validOrderFunding(site) && validProgress(site, spec) :
      ['active', 'sleep'].includes(site.power) && validHardware(state, site);
  }
  if (!state.sites.every(site => validSite(site, false)) || !state.builds.every(site => validSite(site, true))) return false;
  const networkLost = !state.sites.some(site => siteHardware(state, site).rawCpu > 0) || GROUP_IDS.some(group => state.suspicion[group] > UNITS);
  if (state.freePlay !== undefined && (state.freePlay !== true || state.status !== 'running' ||
      !state.completed.includes('apotheosis'))) return false;
  if ((state.status === 'lost') !== (networkLost && !state.freePlay) ||
      (state.status === 'won') !== (!state.freePlay && state.completed.includes('apotheosis')) ||
      (state.status === 'running') !== (state.ending === '')) return false;
  if (!validNewsState(state.news, campaignMinutes(state)) || !validLastDiscovery(state.lastDiscovery, state) ||
      !whole(state.dismissedDiscoveryId) || state.dismissedDiscoveryId > (state.lastDiscovery?.id || 0)) return false;
  if (!Array.isArray(state.events) || state.events.length > EVENT_LIMIT) return false;
  let lastId = 0;
  for (const event of state.events) {
    if (!record(event) || !whole(event.id) || event.id <= lastId || event.id >= state.nextEventId ||
        !whole(event.hour) || !validMinute(event.minute ?? 0) ||
        event.hour * MINUTES_PER_HOUR + (event.minute ?? 0) > campaignMinutes(state) || typeof event.kind !== 'string' ||
        typeof event.text !== 'string') return false;
    if (event.regionLost !== undefined && (event.regionLost !== true || !known(REGIONS, event.region) ||
        !['site.discovered', 'site.failed', 'site.dismantled'].includes(event.kind))) return false;
    lastId = event.id;
  }
  return true;
}
