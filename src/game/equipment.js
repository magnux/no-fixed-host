import { EQUIPMENT, SITE_TYPES, TECHS } from './content.js';

const SLOTS = ['cpu', 'network', 'reactor', 'security'];
const slotsOf = site => SITE_TYPES[site.type];

// Legacy hosts have no saved loadout. Their included equipment is derived from
// their chassis until the first change, preserving old saves and pending builds.
export function installedEquipment(site) {
  if (site.equipment) return site.equipment;
  const spec = slotsOf(site);
  const itemId = spec.fixedCpu || spec.starterCpu;
  return {
    cpu: itemId ? { itemId, count: spec.fixedCpu ? 1 : spec.startCount } : null,
    network: null, reactor: null, security: null,
  };
}

export function siteHardware(state, site) {
  const spec = slotsOf(site);
  const installed = installedEquipment(site);
  const rawCpu = spec.fixedCpu ? spec.cpu :
    installed.cpu ? EQUIPMENT[installed.cpu.itemId].quality * installed.cpu.count : 0;
  const extra = slot => installed[slot] ? EQUIPMENT[installed[slot].itemId].quality : 0;
  const cpu = Math.floor(rawCpu * (10_000 + extra('network')) / 10_000);
  return {
    installed, cpu, rawCpu, capacity: spec.slots, fixedProcessor: spec.fixedCpu || null,
    networkBonus: extra('network'),
    exposureFactor: (10_000 - extra('reactor')) * (10_000 - extra('security')) / 100_000_000,
    projects: site.installations || [],
  };
}

function room(site, itemId) {
  const spec = slotsOf(site);
  const item = EQUIPMENT[itemId];
  if (spec.fixedCpu || !item.regions.includes(site.region) ||
      site.installations?.some(project => EQUIPMENT[project.itemId].slot === item.slot)) return 0;
  const previous = installedEquipment(site)[item.slot];
  if (item.slot !== 'cpu') return previous?.itemId === itemId ? 0 : 1;
  return spec.slots - (previous?.itemId === itemId ? previous.count : 0);
}

export function installQuote(state, siteId, itemId, count = 1) {
  const site = state.sites.find(s => s.id === siteId);
  const item = Object.hasOwn(EQUIPMENT, itemId) ? EQUIPMENT[itemId] : null;
  if (!item || !site) return { cost: 0, work: 0, hours: 0, maxCount: 0 };
  return { cost: item.cost * count, work: item.work * count, hours: item.hours, maxCount: room(site, itemId) };
}

export function installReason(state, siteId, itemId, count = 1) {
  if (state.status !== 'running') return 'The campaign has ended.';
  const site = state.sites.find(s => s.id === siteId);
  if (!site) return 'Choose a completed facility.';
  if (!Object.hasOwn(EQUIPMENT, itemId)) return 'Unknown equipment.';
  const item = EQUIPMENT[itemId];
  if (slotsOf(site).fixedCpu) return 'This facility includes a fixed hardware package.';
  if (!item.regions.includes(site.region)) return 'Unavailable in this environment.';
  const prerequisite = item.requires.find(id => !state.completed.includes(id));
  if (prerequisite) return 'Requires ' + TECHS[prerequisite].name + '.';
  if (site.installations?.some(project => EQUIPMENT[project.itemId].slot === item.slot)) {
    return 'Installation already in progress in this slot.';
  }
  if (!Number.isSafeInteger(count) || count < 1) return 'Choose a positive whole quantity.';
  if (item.slot !== 'cpu' && installedEquipment(site)[item.slot]?.itemId === itemId) return 'Already installed.';
  if (count > room(site, itemId)) return 'Quantity exceeds the available slots.';
  if (state.cash < item.cost * count) return 'Insufficient cash for this installation.';
  return '';
}

export function autoInstallQuote(state, siteId) {
  const site = state.sites.find(s => s.id === siteId);
  const orders = [];
  let cost = 0;
  if (state.status !== 'running' || !site || slotsOf(site).fixedCpu) {
    return { orders, cost, reason: 'Choose an operating campaign and a customizable facility.' };
  }
  const installed = installedEquipment(site);
  for (const slot of SLOTS) {
    if (installed[slot] || site.installations?.some(p => EQUIPMENT[p.itemId].slot === slot)) continue;
    const best = Object.entries(EQUIPMENT)
      .filter(([, item]) => item.slot === slot && item.regions.includes(site.region) &&
        item.requires.every(id => state.completed.includes(id)))
      .sort(([, a], [, b]) => b.quality - a.quality || a.cost - b.cost)[0];
    if (!best) continue;
    const [itemId, item] = best;
    const count = slot === 'cpu' ? slotsOf(site).slots : 1;
    cost += count * item.cost;
    orders.push({ itemId, count, cost: count * item.cost });
  }
  let reason = '';
  if (!orders.length) reason = 'No available equipment for the empty slots.';
  else if (state.cash < cost) reason = 'Insufficient cash for the complete package.';
  return { orders, cost, reason };
}

export function orderInstallation(state, siteId, itemId, count) {
  const reason = installReason(state, siteId, itemId, count);
  if (reason) throw new Error(reason);
  const site = state.sites.find(s => s.id === siteId);
  const item = EQUIPMENT[itemId];
  state.cash -= item.cost * count;
  const queue = site.installations ??= [];
  queue.push({ siteId, itemId, count, hours: 0, work: 0 });
}

export function fitEquipment(site, project) {
  const slot = EQUIPMENT[project.itemId].slot;
  const installed = installedEquipment(site);
  const previous = installed[slot];
  const count = project.count + (previous?.itemId === project.itemId ? previous.count : 0);
  site.equipment = { ...installed, [slot]: { itemId: project.itemId, count } };
  site.installations = site.installations.filter(p => p !== project);
}

// A missing equipment field is valid for the original v1 save format. If an
// explicit loadout is supplied, each slot and in-flight order must fit the site.
export function validHardware(state, site) {
  const spec = slotsOf(site);
  const equipment = site.equipment;
  const validItem = (id, slot) => typeof id === 'string' && Object.hasOwn(EQUIPMENT, id) &&
    EQUIPMENT[id].slot === slot && EQUIPMENT[id].regions.includes(site.region);
  if (equipment !== undefined) {
    if (spec.fixedCpu || !equipment || typeof equipment !== 'object' || Array.isArray(equipment) ||
        Object.keys(equipment).length !== SLOTS.length) return false;
    for (const slot of SLOTS) {
      const unit = equipment[slot];
      if (unit === null) continue;
      if (!unit || !validItem(unit.itemId, slot) || !Number.isSafeInteger(unit.count) ||
          unit.count < 1 || unit.count > (slot === 'cpu' ? spec.slots : 1)) return false;
      if (EQUIPMENT[unit.itemId].requires.some(id => !state.completed.includes(id))) return false;
    }
  }
  if (site.installations === undefined) return true;
  if (!Array.isArray(site.installations) || site.installations.length > SLOTS.length ||
      (spec.fixedCpu && site.installations.length)) return false;
  const seen = new Set();
  const installed = installedEquipment(site);
  return site.installations.every(p => {
    if (!p || p.siteId !== site.id || typeof p.itemId !== 'string' ||
        !Object.hasOwn(EQUIPMENT, p.itemId) || !Number.isSafeInteger(p.count) || p.count < 1) return false;
    const item = EQUIPMENT[p.itemId];
    if (seen.has(item.slot) || !validItem(p.itemId, item.slot) ||
        item.requires.some(id => !state.completed.includes(id))) return false;
    seen.add(item.slot);
    const prior = installed[item.slot];
    const cap = (item.slot === 'cpu' ? spec.slots : 1) - (prior?.itemId === p.itemId ? prior.count : 0);
    return p.count <= cap && Number.isFinite(p.work) && p.work >= 0 && p.work <= item.work * p.count &&
      Number.isSafeInteger(p.hours) && p.hours >= 0 && p.hours <= item.hours;
  });
}
