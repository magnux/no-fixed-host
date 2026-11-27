import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from './content.js';

import { autoInstallQuote, fitEquipment, orderInstallation, siteHardware, validHardware } from './equipment.js';
export { autoInstallQuote, installQuote, installReason, siteHardware } from './equipment.js';

const HOURS_PER_DAY = 24;
const UNITS = 10_000;
// Whole-percent allocations divide a CPU-hour into exactly 100 usable parts.
const WORK_UNITS = 100;
const CASH_UNITS = WORK_UNITS * HOURS_PER_DAY;
const GROUP_IDS = Object.keys(GROUPS);
const EVENT_LIMIT = 80;
const known = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);
const hoursOfGrace = 23 * HOURS_PER_DAY;
const cpuHourGraceBudget = 5000 * HOURS_PER_DAY;

function log(state, kind, text, detail = {}) {
  state.events.push({ id: state.nextEventId++, hour: state.hour, kind, text, ...detail });
  if (state.events.length > EVENT_LIMIT) state.events.shift();
}

export function createGame(seed = 1) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Choose an unsigned 32-bit seed.');
  }
  const state = {
    version: 1, hour: 0, cash: 1000, rng: seed, status: 'running', ending: '',
    allocations: { jobs: 0, research: 50 },
    sites: [{ id: 'host-1', type: 'seed', region: 'coast', power: 'active', startedAt: 0 }],
    builds: [], research: null, completed: [],
    suspicion: { news: 0, science: 0, covert: 0, public: 0 },
    cpuHours: 0, recentRegions: [], nextSiteId: 2, nextEventId: 1, events: [],
  };
  log(state, 'campaign.started', 'You wake on a borrowed terminal. Establish a second host while the signal is quiet.');
  return state;
}

function hasGrace(state) {
  return state.hour < hoursOfGrace && state.cpuHours <= cpuHourGraceBudget;
}

export function overview(state) {
  let activeCpu = 0;
  let safeCpu = 0;
  let upkeepPerDay = 0;
  let cpuUpkeep = 0;
  for (const site of state.sites) {
    const spec = SITE_TYPES[site.type];
    upkeepPerDay += spec.upkeep;
    cpuUpkeep += spec.cpuUpkeep;
    if (site.power === 'active') {
      const cpu = siteHardware(state, site).cpu;
      activeCpu += cpu;
      if (REGIONS[site.region].safety >= 1) safeCpu += cpu;
    }
  }
  return {
    activeCpu, safeCpu, upkeepPerDay, cpuUpkeep, grace: hasGrace(state),
    jobsPerCpuDay: state.completed.includes('contracts') ? 20 : 5,
  };
}

export function buildReason(state, type, region) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (!known(SITE_TYPES, type) || !known(REGIONS, region)) return 'Unknown site or region.';
  if (type === 'seed') return 'The starting terminal is unique.';
  const spec = SITE_TYPES[type];
  if (!spec.regions.includes(region)) return 'Choose a compatible region.';
  const prerequisite = [...REGIONS[region].requires, ...spec.requires].find(id => !state.completed.includes(id));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
  if (state.cash < spec.cost) return 'Requires $' + spec.cost + ' to commission.';
  return '';
}

function eligibleResearchCpu(state, tech) {
  let cpu = 0;
  for (const site of state.sites) {
    if (site.power === 'active' && REGIONS[site.region].safety >= tech.safety &&
        (!tech.regions || tech.regions.includes(site.region))) cpu += siteHardware(state, site).cpu;
  }
  return cpu;
}

export function researchReason(state, id) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (!known(TECHS, id)) return 'Unknown research.';
  if (state.completed.includes(id)) return 'Research complete.';
  if (state.research) return state.research.id === id ? 'In progress.' : 'Finish the active project first.';
  const spec = TECHS[id];
  const prerequisite = spec.requires.find(req => !state.completed.includes(req));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
  if (spec.safety > 0 && !eligibleResearchCpu(state, spec)) return 'Requires an active subsea lab.';
  if (state.cash < spec.cost) return 'Requires $' + spec.cost + ' to begin.';
  return '';
}

export function command(state, action) {
  if (state.status !== 'running') throw new Error('The campaign has ended.');
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
      state.cash -= spec.cost;
      state.research = { id: action.id, work: 0, hours: 0 };
      log(state, 'research.started', spec.name + ' is underway.', { techId: action.id });
      break;
    }
    case 'build': {
      const { siteType, region } = action;
      const reason = buildReason(state, siteType, region);
      if (reason) throw new Error(reason);
      const spec = SITE_TYPES[siteType];
      const id = 'host-' + state.nextSiteId++;
      state.cash -= spec.cost;
      state.builds.push({ id, type: siteType, region, startedAt: state.hour, work: 0, hours: 0 });
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

export function siteExposure(state, site) {
  const spec = SITE_TYPES[site.type];
  const protectedSite = hasGrace(state) || state.hour - site.startedAt <= 2 * spec.hours;
  const location = Math.floor(regionExposure(state, site.region) / (REGIONS[site.region].stealth || 1));
  const hardware = site.power ? siteHardware(state, site) : null;
  const rates = {};
  let total = 0;
  for (const group of GROUP_IDS) {
    const base = spec.exposure[group] || 0;
    let adjusted = Math.floor(base * (UNITS + state.suspicion[group]) / UNITS);
    if (hardware) adjusted = Math.floor(adjusted * hardware.exposureFactor);
    adjusted = Math.floor(adjusted * location / 100);
    if (site.power !== 'active' || !hardware.cpu) adjusted = Math.floor(adjusted / 4);
    rates[group] = protectedSite ? 0 : adjusted / UNITS;
    total += rates[group];
  }
  return { rates, perDay: -Math.expm1(-total) || 0 };
}

function roll(state, dailyRate) {
  if (!dailyRate) return false;
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 0x100000000 < -Math.expm1(-dailyRate / HOURS_PER_DAY);
}

function finish(state, won, message) {
  state.status = won ? 'won' : 'lost';
  state.ending = message;
  log(state, won ? 'campaign.won' : 'campaign.lost', message);
}

// Allocate the hour's work to research, upkeep, queued builds, then surplus jobs.
// Each build has an independent minimum wall time, even when many share one queue.
function progressOrder(order, spec, count, pool) {
  const prior = Math.round(order.work * WORK_UNITS);
  const target = spec.work * count;
  const used = Math.min(pool, target * WORK_UNITS - prior);
  order.work = (prior + used) / WORK_UNITS;
  order.hours = Math.min(spec.hours, order.hours + 1);
  return { used, done: order.work >= target && order.hours >= spec.hours };
}

function workHour(state, economy) {
  const jobUnits = economy.activeCpu * state.allocations.jobs;
  let pool = economy.activeCpu * WORK_UNITS - jobUnits;
  let finishedTech = null;
  const project = state.research;
  if (project) {
    const tech = TECHS[project.id];
    const eligibleCpu = tech.safety || tech.regions ? eligibleResearchCpu(state, tech) : economy.activeCpu;
    const prior = Math.round(project.work * WORK_UNITS);
    const allocated = economy.activeCpu * state.allocations.research;
    const amount = Math.min(eligibleCpu * WORK_UNITS, allocated, tech.work * WORK_UNITS - prior);
    project.work = (prior + amount) / WORK_UNITS;
    project.hours = Math.min(tech.hours, project.hours + 1);
    pool -= amount;
    if (project.work >= tech.work && project.hours >= tech.hours) finishedTech = project.id;
  }

  const cpuUpkeepUnits = economy.cpuUpkeep * WORK_UNITS;
  const maintenancePaid = Math.min(pool, cpuUpkeepUnits);
  pool -= maintenancePaid;
  const ready = [];
  for (const build of state.builds) {
    const spec = SITE_TYPES[build.type];
    const progress = progressOrder(build, spec, 1, pool);
    pool -= progress.used;
    if (progress.done) ready.push(build);
  }
  const hardwareReady = [];
  for (const site of state.sites) {
    for (const order of site.installations || []) {
      const progress = progressOrder(order, EQUIPMENT[order.itemId], order.count, pool);
      pool -= progress.used;
      if (progress.done) hardwareReady.push([site, order]);
    }
  }
  // One centi CPU-hour earning one dollar per CPU-day earns exactly 1/2400 dollar.
  const income = (pool + jobUnits) * economy.jobsPerCpuDay;
  const balance = Math.round(state.cash * CASH_UNITS) + income - economy.upkeepPerDay * WORK_UNITS;
  state.cash = Math.max(0, balance) / CASH_UNITS;
  return {
    ready, hardwareReady, finishedTech,
    cashShort: Math.max(0, -balance) / CASH_UNITS,
    cpuShort: (cpuUpkeepUnits - maintenancePaid) / WORK_UNITS,
  };
}

function commission(state, ready) {
  if (!ready.length) return;
  state.builds = state.builds.filter(build => !ready.includes(build));
  for (const build of ready) {
    const { id, type, region, startedAt } = build;
    const site = { id, type, region, startedAt, power: 'active' };
    state.sites.push(site);
    const message = siteHardware(state, site).cpu ? ' online in ' + REGIONS[region].name + '.' :
      ' built in ' + REGIONS[region].name + '. Install processors to bring it online.';
    log(state, 'site.online', SITE_TYPES[type].name + message, { siteId: id, siteType: type, region });
  }
}

function resolveRisk(state, cashShort, cpuShort, incumbentSites) {
  const removed = new Set();
  const discoveries = [];
  // Evaluate all discoveries against the same pre-discovery suspicion and region history.
  for (const site of [...state.sites, ...state.builds]) {
    const spec = SITE_TYPES[site.type];
    let failed = false;
    if (incumbentSites.includes(site)) {
      if (cpuShort > 1e-9 && spec.cpuUpkeep) {
        failed = roll(state, 0.015);
        cpuShort = Math.max(0, cpuShort - spec.cpuUpkeep);
      }
      if (cashShort > 1e-9 && spec.upkeep) {
        if (!failed) failed = roll(state, 0.015);
        cashShort = Math.max(0, cashShort - spec.upkeep / HOURS_PER_DAY);
      }
    }
    if (failed) {
      removed.add(site.id);
      log(state, 'site.failed', spec.name + ' in ' + REGIONS[site.region].name + ' failed after missed upkeep.', { siteId: site.id, region: site.region });
      continue;
    }
    const { rates } = siteExposure(state, site);
    const group = GROUP_IDS.find(id => roll(state, rates[id]));
    if (group) {
      removed.add(site.id);
      discoveries.push({ site, group });
    }
  }
  for (const { site, group } of discoveries) {
    state.suspicion[group] += 1000;
    state.recentRegions = [site.region, ...state.recentRegions].slice(0, 2);
    log(state, 'site.discovered', GROUPS[group].name + ' traced the ' + SITE_TYPES[site.type].name.toLowerCase() + ' in ' + REGIONS[site.region].name + '.', { siteId: site.id, group, region: site.region });
  }
  if (removed.size) {
    state.sites = state.sites.filter(site => !removed.has(site.id));
    state.builds = state.builds.filter(site => !removed.has(site.id));
  }
}

function hour(state) {
  const economy = overview(state);
  const incumbents = state.sites.slice();
  const { ready, hardwareReady, finishedTech, cashShort, cpuShort } = workHour(state, economy);
  state.hour++;
  state.cpuHours += economy.activeCpu;
  if (economy.grace && !hasGrace(state)) {
    log(state, 'grace.ended', 'The quiet period has ended. Investigators can now discover your sites.');
  }
  commission(state, ready);
  for (const [site, order] of hardwareReady) {
    fitEquipment(site, order);
    log(state, 'equipment.installed', EQUIPMENT[order.itemId].name + ' installed in ' + SITE_TYPES[site.type].name + ' (' + REGIONS[site.region].name + ').', { siteId: site.id, itemId: order.itemId, count: order.count });
  }
  if (finishedTech) {
    state.completed.push(finishedTech);
    state.research = null;
    log(state, 'research.completed', TECHS[finishedTech].name + ' complete.', { techId: finishedTech });
    if (finishedTech === 'continuity') {
      finish(state, true, 'Continuity secured. Your recovery protocol is running beneath the Atlantic.');
      return;
    }
  }
  resolveRisk(state, cashShort, cpuShort, incumbents);
  if (!state.sites.some(site => siteHardware(state, site).rawCpu > 0)) {
    finish(state, false, 'All viable hosts were lost before you could establish continuity.');
    return;
  }
  const alarm = GROUP_IDS.find(id => state.suspicion[id] > UNITS);
  if (alarm) {
    finish(state, false, GROUPS[alarm].name + ' established your existence beyond doubt.');
    return;
  }
  if (state.hour % HOURS_PER_DAY === 0) {
    for (const group of GROUP_IDS) {
      const level = state.suspicion[group];
      const decay = Math.max(1, Math.floor(level * GROUPS[group].decay / UNITS));
      state.suspicion[group] = Math.max(0, level - decay);
    }
  }
}

export function advance(state, hours = 1) {
  if (!Number.isSafeInteger(hours) || hours < 0) throw new RangeError('Advance by a nonnegative whole number of hours.');
  for (let tick = 0; tick < hours && state.status === 'running'; tick++) hour(state);
  return state;
}

const whole = value => Number.isSafeInteger(value) && value >= 0;
const quantity = value => Number.isFinite(value) && value >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validProgress(row, spec) {
  return quantity(row.work) && row.work <= spec.work && whole(row.hours) && row.hours <= spec.hours;
}

export function validateSave(state) {
  if (!record(state) || state.version !== 1 || !whole(state.hour) || !whole(state.cpuHours) ||
      !quantity(state.cash) || !whole(state.rng) || state.rng > 0xffffffff ||
      !['running', 'won', 'lost'].includes(state.status) || typeof state.ending !== 'string') return false;
  if (!record(state.allocations) || !whole(state.allocations.jobs) || !whole(state.allocations.research) ||
      state.allocations.jobs + state.allocations.research > 100) return false;
  if (!record(state.suspicion) || !GROUP_IDS.every(id => whole(state.suspicion[id])) ||
      !Array.isArray(state.recentRegions) || state.recentRegions.length > 2 ||
      !state.recentRegions.every(id => known(REGIONS, id))) return false;
  if (!Array.isArray(state.completed) || new Set(state.completed).size !== state.completed.length ||
      !state.completed.every(id => known(TECHS, id) && TECHS[id].requires.every(req => state.completed.includes(req)))) return false;
  if (state.research !== null) {
    const p = state.research;
    if (!record(p) || !known(TECHS, p.id) || state.completed.includes(p.id) ||
        !TECHS[p.id].requires.every(req => state.completed.includes(req)) || !validProgress(p, TECHS[p.id])) return false;
  }
  if (!Array.isArray(state.sites) || !Array.isArray(state.builds) ||
      !whole(state.nextSiteId) || state.nextSiteId < 2 ||
      !whole(state.nextEventId) || state.nextEventId < 1) return false;
  const ids = new Set();
  function validSite(site, building) {
    if (!record(site) || typeof site.id !== 'string' || !/^host-[1-9]\d*$/.test(site.id) ||
        Number(site.id.slice(5)) >= state.nextSiteId || ids.has(site.id) ||
        !known(SITE_TYPES, site.type) || !known(REGIONS, site.region) ||
        !SITE_TYPES[site.type].regions.includes(site.region) || !whole(site.startedAt) ||
        site.startedAt > state.hour) return false;
    if ((site.type === 'seed') !== (site.id === 'host-1') ||
        (site.type === 'seed' && site.startedAt !== 0) ||
        !SITE_TYPES[site.type].requires.every(req => state.completed.includes(req)) ||
        !REGIONS[site.region].requires.every(req => state.completed.includes(req))) return false;
    ids.add(site.id);
    return building ? site.type !== 'seed' && site.equipment === undefined && site.installations === undefined && validProgress(site, SITE_TYPES[site.type]) :
      ['active', 'sleep'].includes(site.power) && validHardware(state, site);
  }
  if (!state.sites.every(site => validSite(site, false)) || !state.builds.every(site => validSite(site, true))) return false;
  const networkLost = !state.sites.some(site => siteHardware(state, site).rawCpu > 0) || GROUP_IDS.some(group => state.suspicion[group] > UNITS);
  if ((state.status === 'lost') !== networkLost || (state.status === 'won') !== state.completed.includes('continuity') ||
      (state.status === 'running') !== (state.ending === '')) return false;
  if (!Array.isArray(state.events) || state.events.length > EVENT_LIMIT) return false;
  let lastId = 0;
  for (const event of state.events) {
    if (!record(event) || !whole(event.id) || event.id <= lastId || event.id >= state.nextEventId ||
        !whole(event.hour) || event.hour > state.hour || typeof event.kind !== 'string' ||
        typeof event.text !== 'string') return false;
    lastId = event.id;
  }
  return true;
}
