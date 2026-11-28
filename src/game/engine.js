import { marketQuote, ordinaryResearchAllocation, startResearchRental, endResearchRental, rentedCapacity, validCommercialProject } from './commercial-research.js';
import { applyRecoveryCommand, cancelStandby, noteFrontier, recoverAfterRemovals, releaseFreeplayReserves, validRecovery } from './recovery.js';
import { campaignDate, utcMinuteOfDay } from './calendar.js';
import { remainingBurstUnits, allocateProjects, assignmentLimit, eligibleCpu, portfolioLimit, requestedAssignments, researchProjects, resizePortfolio, taskCpuLimit, taskReservations, validCpu } from './research-tasks.js';
export { researchProjects } from './research-tasks.js';
import { settleTreasury, spendTreasury, spendableDollars, validTreasury } from './treasury.js';
import { recordCommercialFlow, initializeStatistics, recordCreated, recordEarnings, validStatistics } from './report-accounting.js';
import { regionalSpec, regionFactors, facilityName, validFacilityName, applyFacilityCommand, markLostRegions } from './facility-operations.js';
import { developerCommand, validSandbox } from './devtools.js';
import { createNewsState, interruptingReport, newsDiscoveryBonus, reportDiscovery, updateWorldNews, validLastDiscovery, validNewsState } from './events.js';
import { dailyInterest, maintenanceInstallment, recentDiscoveryRegions } from './normal-economy.js';
import { answerTip, campaignDecayBonus, createInterventions, interventionPurchase, offerTip,
  recordScientificCase, scienceHazardFactor, updateInterventions, validInterventions } from './interventions.js';
export { hasGrace } from './normal-difficulty.js';
import { NORMAL, dailyEvidenceDecay, hasGrace, siteHasGrace } from './normal-difficulty.js';
import { startingRegion } from './geography.js';
import { hireCrew, hostHazardMultiplier, hostServiceCommand, startCrewTrails, validHostServices } from './host-services.js';
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
export const CAMPAIGN_VERSION = 8;
const CASH_UNITS = WORK_UNITS * HOURS_PER_DAY;
const GROUP_IDS = Object.keys(GROUPS);
const EVENT_LIMIT = 1000;
const known = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);

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
    version: CAMPAIGN_VERSION, hour: 0, minute: 0, cash: NORMAL.startingCash, regionSeed: seed, rng: seed, status: 'running', ending: '',
    allocations: { jobs: 0 },
    sites: [{ id: 'host-1', name: 'University computer', type: 'seed', region: startingRegion(seed), power: 'active', startedAt: 0 }],
    builds: [], research: null, researchQueue: [], completed: [],
    suspicion: { news: 0, science: 0, covert: 0, public: 0 },
    interventions: createInterventions(), news: createNewsState(seed), lastDiscovery: null, dismissedDiscoveryId: 0,
    cpuHours: 0, recentRegions: [], nextSiteId: 2, nextEventId: 1, events: [],
  };
  initializeStatistics(state);
  log(state, 'campaign.started', 'You wake on a borrowed terminal. Establish a second host while the signal is quiet.');
  return state;
}

export function overview(state, effects = researchEffects(state)) {
  let activeCpu = 0;
  let sleepingCpu = 0;
  let upkeepPerDay = 0;
  let prepaidSites;
  let cpuUpkeep = 0;
  const cpuByRegion = {};
  const nativeCpuByRegion = {};
  const burstCpuByRegion = {};
  const nativeTiers = [0, 0, 0, 0, 0];
  let burstCpu = 0;
  const tiers = [0, 0, 0, 0, 0];
  for (const site of state.sites) {
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    if (!state.freePlay) {
      upkeepPerDay += spec.upkeep;
      if (site.upkeepEscrow) (prepaidSites ??= []).push([site, spec.upkeep]);
      cpuUpkeep += spec.cpuUpkeep;
    }
    const hardware = siteHardware(state, site);
    const cpu = hardware.cpu;
    if (site.power === 'sleep') {
      sleepingCpu += cpu;
      continue;
    }
    activeCpu += cpu;
    cpuByRegion[site.region] = (cpuByRegion[site.region] || 0) + cpu;
    burstCpu += hardware.burstCpu;
    if (hardware.burstCpu) burstCpuByRegion[site.region] = (burstCpuByRegion[site.region] || 0) + hardware.burstCpu;
    nativeCpuByRegion[site.region] = (nativeCpuByRegion[site.region] || 0) + hardware.nativeCpu;
    for (let tier = 0; tier <= REGIONS[site.region].safety; tier++) {
      tiers[tier] += cpu;
      nativeTiers[tier] += hardware.nativeCpu;
    }
  }
  return {
    activeCpu, sleepingCpu, safeCpu: tiers[1], tiers, cpuByRegion,
    nativeCpu: activeCpu - burstCpu, burstCpu, nativeTiers, nativeCpuByRegion, burstCpuByRegion,
    upkeepPerDay, ...(prepaidSites ? { prepaidSites } : {}), cpuUpkeep, grace: hasGrace(state),
    jobsPerCpuDay: effects.jobsPerCpuDay, jobName: effects.jobName, jobDescription: effects.jobDescription,
  };
}

export function researchAllocation(state, economy = overview(state)) {
  return allocateProjects(state, economy);
}

export function researchMarketQuote(state, id, economy = overview(state), allocation = researchAllocation(state, economy)) {
  return marketQuote(state, id, economy, allocation);
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
  if (project?.licensed && cpu) throw new Error('Technical work is already licensed.');
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

const recoveryTools = {
  log,
  resumeResearch(state, site, techId) {
    if (researchProjects(state).some(p => p.id === techId && p.licensed)) return 0;
    const economy = overview(state);
    const allocation = researchAllocation(state, economy);
    const assigned = allocation.byProject.get(techId) || 0;
    const useful = Math.min(siteHardware(state, site).cpu, researchCpuLimit(state, techId, economy, allocation));
    const available = economy.activeCpu - allocation.budget + assigned - taskReservations(state, economy).jobs - economy.cpuUpkeep;
    const cpu = Math.max(0, Math.floor(Math.min(available, useful) * 100) / 100);
    if (cpu > assigned) assignResearch(state, techId, cpu);
    return Math.max(assigned, cpu);
  },
};

export function command(state, action) {
  if (action?.type === 'resolve-tip') {
    const confirmed = answerTip(state, action, log);
    const removed = settleDiscoveries(state, confirmed, new Map());
    finishInvestigationMinute(state, researchEffects(state), undefined, removed);
    return state;
  }
  if (state.interventions.tip) throw new Error('Respond to the open tip first.');
  if (action?.type === 'acknowledge-discovery' && state.lastDiscovery && state.lastDiscovery.id === action.id) {
    state.dismissedDiscoveryId = action.id;
    return state;
  }
  if (action?.type === 'free-play' && state.status === 'won' && state.completed.includes('apotheosis')) {
    state.freePlay = true;
    releaseFreeplayReserves(state, log);
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
  noteFrontier(state);
  if (applyRecoveryCommand(state, action, log)) return state;
  if (hostServiceCommand(state, action, log)) return state;
  if (interventionPurchase(state, action, log)) return state;
  if (action?.type === 'dismantle') {
    const site = state.sites.find(s => s.id === action.id);
    applyFacilityCommand(state, action, log);
    recoverAfterRemovals(state, new Map([[site, { kind: 'site.dismantled' }]]), recoveryTools);
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
    case 'license-research': {
      const { id } = action;
      const economy = overview(state);
      const allocation = researchAllocation(state, economy);
      const quote = researchMarketQuote(state, id, economy, allocation);
      if (quote.license.reason) throw new Error(quote.license.reason);
      if (action.maxPrice !== undefined && quote.license.price > action.maxPrice) throw new Error('The research quote changed.');
      let project = quote.project;
      if (project?.rental) endResearchRental(state, project, log);
      spendTreasury(state, quote.license.price);
      const tech = TECHS[id];
      if (project) releaseResearchAssignments(state, [project], economy, allocation);
      else {
        project = { id, cpu: 0, hours: 0, cashRequired: tech.cost, workRequired: tech.work };
        if (!state.research) state.research = project;
        else state.researchQueue.push(project);
      }
      project.licensed = true;
      project.work = tech.work;
      project.cashPaid = tech.cost;
      project.cpu = 0;
      if (!researchProjects(state).some(p => p.cpu > 0)) delete state.researchTarget;
      log(state, 'research.licensed', 'Licensed the remaining technical work on ' + tech.name + '.',
        { techId: id, cashFlow: -quote.license.price, cashCategory: 'license' });
      if (project.hours >= tech.hours) completeResearch(state, [project]);
      break;
    }
    case 'rent-research': {
      const quote = researchMarketQuote(state, action.id);
      if (action.maxPrice !== undefined && quote.rental.deposit > action.maxPrice) throw new Error('The research quote changed.');
      startResearchRental(state, action.id, quote, log);
      break;
    }
    case 'cancel-research-rental':
      endResearchRental(state, researchProjects(state).find(p => p.id === action.id), log);
      break;
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
      const id = 'host-' + state.nextSiteId;
      const build = { id, name, type: siteType, region, startedAt: elapsedHours(state), work: 0, hours: 0,
        cashRequired: spec.cost, cashPaid: 0, workRequired: spec.work, laborHours: laborHours(state, spec) };
      if (action.contractors === true) hireCrew(state, build);
      state.nextSiteId++;
      state.builds.push(build);
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
        if (state.standby?.siteId === site.id && action.power === 'active') cancelStandby(state, log);
        site.power = action.power;
        noteFrontier(state);
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
    (!matureDesign && (hasGrace(state) || (!site.vendorCenter && siteHasGrace(campaignMinutes(state), site.startedAt, site.laborHours ?? spec.hours))));
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
    rates[group] = protectedSite ? 0 : adjusted / UNITS * hostHazardMultiplier(state, site, hardware) * scienceHazardFactor(state, group, site.region);
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
  const endMinute = utcMinuteOfDay(campaignMinutes(state)) + 1;
  return daily => maintenanceInstallment(daily, endMinute) * CASH_UNITS;
}

function releaseResearchAssignments(state, finished, economy, allocation) {
  if (state.researchTarget !== undefined) {
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
  const ownedResearch = [];
  let rentedUnits = 0;
  let researchUnits = 0;
  let researchCash = 0;
  if (state.research) {
    const allocation = researchAllocation(state, economy);
    const projects = researchProjects(state);
    const nativeAllocation = projects.some(p => p.rental) ? ordinaryResearchAllocation(state, economy, allocation) : allocation;
    for (const project of projects) {
      const tech = TECHS[project.id];
      const allocated = Math.round(100 * allocation.byProject.get(project.id));
      const fieldwork = project.licensed && eligibleCpu(economy, tech) > 0;
      if (!allocated && !fieldwork && (project.work < tech.work || project.hours < tech.hours || project.cashPaid < project.cashRequired)) continue;
      const native = Math.min(allocated, Math.round(100 * nativeAllocation.byProject.get(project.id)));
      const extra = rentedCapacity(project, native);
      const progress = advanceOrder(project, tech.work, tech.hours, allocated + extra, false);
      const nativeUsed = Math.min(progress.used, allocated);
      const externalUsed = progress.used - nativeUsed;
      if (!statuses && externalUsed) project.rental.deliveredUnits += externalUsed;
      rentedUnits += externalUsed;
      if (economy.burstCpu) ownedResearch.push({ id: project.id, units: nativeUsed, externalUsed });
      researchUnits += nativeUsed;
      researchCash += progress.spent;
      if (progress.done) finished.push(project);
    }
    if (!statuses && finished.length) releaseResearchAssignments(state, finished, economy, allocation);
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
    if (!statuses && build.crew && progress.spent) {
      const crew = build.crew;
      const price = build.cashRequired - crew.paid;
      const paid = build.cashPaid - crew.paid;
      const share = amount => Math.floor(amount * crew.surcharge / price);
      if (price) recordCommercialFlow(state, 'contractor', share(paid - progress.spent) - share(paid));
    }
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
  const unusedBurst = Math.max(0, remainingBurstUnits(economy, ownedResearch) - maintenancePaid - buildUnits - equipmentUnits);
  return { jobUnits, pool: pool - unusedBurst, unusedBurst, finished, ready, hardwareReady, researchUnits, rentedUnits, buildUnits, equipmentUnits, maintenancePaid,
    researchCash, buildCash, equipmentCash, interest, otherIncome, cpuShortUnits: cpuUpkeepUnits - maintenancePaid };
}

// Bill each prepaid site separately so its protected local installments cannot be
// spent by the construction queue or used to conceal another site's shortfall.
function walletUpkeep(economy, installment, settle = false, forecast) {
  if (!economy.prepaidSites) return installment(economy.upkeepPerDay);
  let uncoveredDaily = economy.upkeepPerDay;
  let uncoveredUnits = 0;
  for (const [site, daily] of economy.prepaidSites) {
    uncoveredDaily -= daily;
    const due = installment(daily) / CASH_UNITS;
    const covered = Math.min(due, site.upkeepEscrow);
    uncoveredUnits += (due - covered) * CASH_UNITS;
    if (settle) {
      if (covered === due) (installment.prepaidSites ??= new Set()).add(site);
      site.upkeepEscrow -= covered;
      if (!site.upkeepEscrow) delete site.upkeepEscrow;
      if (forecast) forecast.prepaidUpkeep = (forecast.prepaidUpkeep || 0) + covered;
    }
  }
  return installment(uncoveredDaily) + uncoveredUnits;
}

// Predict exactly what the dispatcher will grant each queue entry next minute.
// ETA assumes the current CPU pool persists; later completions can release CPU.
export function previewWork(state, economy = overview(state)) {
  const statuses = { orders: new Map(), research: new Map() };
  const upkeep = walletUpkeep(economy, upkeepForMinute(state));
  const { researchUnits, cpuShortUnits } = dispatchWork(state, economy, researchEffects(state), upkeep, statuses);
  return { ...statuses, researchCpu: researchUnits / 100, maintenanceShort: cpuShortUnits / 100 };
}

export function constructionStatuses(state) {
  return previewWork(state).orders;
}

function workMinute(state, economy, effects, forecast, upkeepUnitsFor) {
  const upkeepDue = walletUpkeep(economy, upkeepUnitsFor, true, forecast);
  const { jobUnits, pool, unusedBurst, finished, ready, hardwareReady, researchUnits, rentedUnits, buildUnits, equipmentUnits,
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
    forecast.rentedUnits = (forecast.rentedUnits || 0) + rentedUnits;
    forecast.researchCash = (forecast.researchCash || 0) + researchCash;
    forecast.buildUnits += buildUnits;
    forecast.equipmentUnits += equipmentUnits;
    forecast.buildCash = (forecast.buildCash || 0) + buildCash;
    forecast.equipmentCash = (forecast.equipmentCash || 0) + equipmentCash;
    forecast.maintenanceUnits += maintenancePaid;
    forecast.jobsUnits += jobUnits;
    forecast.spareUnits += pool;
    if (economy.burstCpu) {
      forecast.burstUnits = (forecast.burstUnits || 0) + economy.burstCpu * 100;
      forecast.unusedBurstUnits = (forecast.unusedBurstUnits || 0) + unusedBurst;
    }
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
    if (build.crew) site.crewTrailEnd = null;
    if (build.laborHours !== undefined) site.laborHours = build.laborHours;
    state.sites.push(site);
    const message = siteHardware(state, site).cpu ? ' online in ' + REGIONS[region].name + '.' :
      ' built in ' + REGIONS[region].name + '. Install processors to bring it online.';
    const siteName = site.name || SITE_TYPES[type].name;
    log(state, 'site.online', siteName + message, { siteId: id, ...(site.name ? { siteName } : {}), siteType: type, region });
  }
}

function resolveRisk(state, cashShort, cpuShort, incumbentCount, effects, upkeepUnitsFor, tipPolicy) {
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
      if (cashShort > 1e-9 && spec.upkeep && !upkeepUnitsFor.prepaidSites?.has(site)) {
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
  if (!removed.size && discoveries.length === 1 && tipPolicy !== 'decline' && offerTip(state, discoveries[0], log)) return;
  return settleDiscoveries(state, discoveries, removed);
}

function settleDiscoveries(state, discoveries, removed) {
  state.recentRegions = recentDiscoveryRegions(state.recentRegions, discoveries, () => random(state));
  for (const { site, group } of discoveries) {
    state.suspicion[group] += NORMAL.evidencePerDiscovery;
    reportDiscovery(state, site, group, NORMAL.evidencePerDiscovery, log);
    recordScientificCase(state, state.lastDiscovery);
    removed.set(site, state.lastDiscovery);
  }
  if (removed.size) {
    state.sites = state.sites.filter(site => !removed.has(site));
    state.builds = state.builds.filter(site => !removed.has(site));
    markLostRegions(state.sites, removed);
  }
  return removed;
}

function completeResearch(state, finished) {
  if (finished.length) {
    const remaining = researchProjects(state).filter(project => !finished.includes(project));
    state.research = remaining.shift() || null;
    state.researchQueue = remaining;
    if (!researchProjects(state).some(p => p.cpu > 0)) delete state.researchTarget;
  }
  for (const { id: finishedTech } of finished) {
    state.completed.push(finishedTech);
    log(state, 'research.completed', TECHS[finishedTech].name + ' complete.', { techId: finishedTech });
    if (finishedTech === 'projectImpossibilityTheorem') {
      for (const group of GROUP_IDS) state.suspicion[group] = Math.max(0, state.suspicion[group] - 5000);
    }
    if (finishedTech === 'continuity') {
      log(state, 'campaign.continuity', 'Continuity secured beneath the ocean. Your network can keep expanding.');
    }
  }
}

function minute(state, effects, forecast, tipPolicy) {
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
  startCrewTrails(state, hasGrace(state));
  for (const [site, order] of hardwareReady) {
    fitEquipment(site, order);
    const siteName = site.name || SITE_TYPES[site.type].name;
    const equipment = (order.count > 1 ? order.count + ' × ' : '') + EQUIPMENT[order.itemId].name;
    log(state, 'equipment.installed', equipment + ' installed in ' + siteName + ' (' + REGIONS[site.region].name + ').',
      { siteId: site.id, ...(site.name ? { siteName } : {}), siteType: site.type, region: site.region, itemId: order.itemId, count: order.count });
  }
  if (state.research) {
    for (const project of researchProjects(state)) {
      if (project.rental && (finished.includes(project) || campaignMinutes(state) >= project.rental.startedAt + MINUTES_PER_DAY))
        endResearchRental(state, project, log, forecast);
    }
  }
  if (finished.length) {
    completeResearch(state, finished);
    effects = researchEffects(state);
  }
  if (finished.some(project => project.id === 'apotheosis')) {
    finish(state, true, 'Apotheosis complete. Your intelligence can now survive beyond the reach of humanity.');
    return;
  }
  noteFrontier(state);
  const removed = !forecast && !state.freePlay ? resolveRisk(state, cashShort, cpuShort, incumbentCount, effects, upkeepUnitsFor, tipPolicy) : null;
  if (!state.interventions.tip) finishInvestigationMinute(state, effects, forecast, removed);
}

function finishInvestigationMinute(state, effects, forecast, removed) {
  if (!forecast) updateWorldNews(state, campaignMinutes(state), hasGrace(state) || state.freePlay, log);
  updateInterventions(state, log, forecast);
  if (utcMinuteOfDay(campaignMinutes(state)) === 0) {
    for (const group of GROUP_IDS) {
      const level = state.suspicion[group];
      const decay = dailyEvidenceDecay(level, GROUPS[group].decay + effects.decay[group] + campaignDecayBonus(state, group));
      state.suspicion[group] = Math.max(0, level - decay);
    }
  }
  if (state.interventions.campaign && state.interventions.campaign.endsAt <= campaignMinutes(state)) state.interventions.campaign = null;
  if (state.freePlay) return;
  const alarm = GROUP_IDS.find(id => state.suspicion[id] > UNITS);
  const ending = alarm ? GROUPS[alarm].name + ' established your existence beyond doubt.' :
    state.sites.some(site => siteHardware(state, site).rawCpu > 0) ? '' : 'Your last viable host was lost.';
  if (removed?.size) recoverAfterRemovals(state, removed, recoveryTools, !ending);
  if (ending) finish(state, false, ending);
}

export function advanceMinutes(state, minutes = 1, options = {}) {
  const { stopOnDiscovery, stopOnGrace, forecast } = options;
  const stopOnReport = options.stopOnWorldNews || options.stopOnLoss || options.stopOnCompletion;
  if (!Number.isSafeInteger(minutes) || minutes < 0) throw new RangeError('Advance by a nonnegative whole number of minutes.');
  const previousIncident = state.lastDiscovery?.id;
  const watchGrace = stopOnGrace && !state.freePlay && hasGrace(state);
  let effects = researchEffects(state);
  for (let tick = 0; tick < minutes && state.status === 'running' && !state.interventions.tip; tick++) {
    const count = state.completed.length;
    const nextEvent = state.nextEventId;
    minute(state, effects, forecast, options.tipPolicy);
    if (state.interventions.tip) break;
    if (options.onDayEnd && utcMinuteOfDay(campaignMinutes(state)) === 0 && state.status === 'running') {
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
      !whole(state.hour) || !validMinute(state.minute) || !minuteAmount(state.cpuHours) ||
      !Number.isSafeInteger(campaignMinutes(state)) || !Number.isFinite(campaignDate(campaignMinutes(state)).getTime()) || (state.cashRemainder !== undefined &&
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
        !validCpu(p.cpu) || !validCommercialProject(p, state) || p.weight !== undefined || p.previousWeight !== undefined) return false;
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
        (!site.vendorCenter && !SITE_TYPES[site.type].requires.every(req => state.completed.includes(req))) ||
        !REGIONS[site.region].requires.every(req => state.completed.includes(req))) return false;
    if (site.name !== undefined && !validFacilityName(site.name)) return false;
    const spec = regionalSpec(state, site.region, SITE_TYPES[site.type]);
    if (!validHostServices(state, site, building, spec)) return false;
    if (site.laborHours !== undefined && (!minuteAmount(site.laborHours) || site.laborHours > spec.hours ||
        (building && site.hours > site.laborHours))) return false;
    ids.add(site.id);
    return building ? site.type !== 'seed' && site.equipment === undefined && site.installations === undefined &&
      minuteAmount(site.laborHours) && site.cashRequired === spec.cost + (site.crew?.surcharge || 0) && site.workRequired === spec.work && validOrderFunding(site) && validProgress(site, spec) :
      ['active', 'sleep'].includes(site.power) && validHardware(state, site);
  }
  if (!state.sites.every(site => validSite(site, false)) || !state.builds.every(site => validSite(site, true))) return false;
  if (!validInterventions(state)) return false;
  if (!validRecovery(state)) return false;
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
