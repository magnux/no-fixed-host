import { EQUIPMENT, SITE_TYPES, TECHS } from './content.js';
import { regionFactors } from './geography.js';
import { validOrderFunding } from './work-order.js';
import { laborHours } from './research.js';

const SLOTS = ['cpu', 'network', 'reactor', 'security'];
const slotsOf = site => SITE_TYPES[site.type];

// An untouched host derives its included processor from the chassis.
export function installedEquipment(site) {
  if (site.equipment) return site.equipment;
  const spec = slotsOf(site);
  const itemId = spec.fixedCpu;
  return {
    cpu: itemId ? { itemId, count: 1 } : null,
    network: null, reactor: null, security: null,
  };
}

// Equal performance earns the same rank, including equivalent urban and remote gear.
const qualitiesBySlot = Object.fromEntries(SLOTS.map(slot => [
  slot, [...new Set(Object.values(EQUIPMENT).filter(item => item.slot === slot).map(item => item.quality))]
    .sort((a, b) => a - b),
]));

export function equipmentRank(itemId) {
  if (!Object.hasOwn(EQUIPMENT, itemId)) return 0;
  const item = EQUIPMENT[itemId];
  const levels = qualitiesBySlot[item.slot];
  return 1 + Math.round(4 * levels.indexOf(item.quality) / Math.max(1, levels.length - 1));
}

export function hostRank(site) {
  const installed = installedEquipment(site);
  if (slotsOf(site).fixedCpu) return equipmentRank(installed.cpu.itemId);
  const sum = SLOTS.reduce((rank, slot) => rank + equipmentRank(installed[slot]?.itemId), 0);
  return sum ? Math.max(1, Math.round(sum / SLOTS.length)) : 0;
}

export function siteHardware(state, site) {
  const spec = slotsOf(site);
  const installed = installedEquipment(site);
  const projects = site.installations || [];
  const offlineSlots = projects.map(project => EQUIPMENT[project.itemId].slot);
  const quality = slot => installed[slot] && !offlineSlots.includes(slot) ? EQUIPMENT[installed[slot].itemId].quality : 0;
  const rawCpu = spec.fixedCpu ? spec.cpu : quality('cpu') * (installed.cpu?.count || 0);
  const networkBonus = quality('network');
  const exposureNumerator = (10_000 - quality('reactor')) * (10_000 - quality('security'));
  const cpu = rawCpu ? Math.max(1, Math.floor(rawCpu * (10_000 + networkBonus) / 10_000 * regionFactors(state, site.region).cpu)) : 0;
  return {
    installed, cpu, rawCpu, capacity: spec.slots, fixedProcessor: spec.fixedCpu || null,
    networkBonus, exposureNumerator, exposureFactor: exposureNumerator / 100_000_000,
    projects, offlineSlots,
  };
}

export function projectedCompute(state, site, itemId, count = 1, includePendingNetwork = true) {
  if (!Object.hasOwn(EQUIPMENT, itemId) || !Number.isSafeInteger(count) || count < 1 || count > room(site, itemId)) return null;
  const slot = EQUIPMENT[itemId].slot;
  const target = { ...site, installations: [...(site.installations || [])] };
  if (!includePendingNetwork) {
    target.installations = target.installations.filter(order => EQUIPMENT[order.itemId].slot !== 'network');
  }
  const discarded = target.installations.find(order => EQUIPMENT[order.itemId].slot === slot && order.itemId !== itemId);
  if (discarded) {
    target.installations = target.installations.filter(order => order !== discarded);
    target.equipment = { ...installedEquipment(site), [slot]: null };
  }
  for (const order of [...target.installations, { itemId, count }]) fitEquipment(target, order);
  return siteHardware(state, target).cpu;
}

export function slotSignature(site, slot) {
  const installed = installedEquipment(site)[slot];
  const pending = site.installations?.find(order => EQUIPMENT[order.itemId].slot === slot);
  return [installed?.itemId, installed?.count, pending?.itemId, pending?.count].join('/');
}

function room(site, itemId) {
  const spec = slotsOf(site);
  const item = EQUIPMENT[itemId];
  if (spec.fixedCpu || !item.regions.includes(site.region)) return 0;
  const pending = site.installations?.find(order => EQUIPMENT[order.itemId].slot === item.slot);
  const installed = installedEquipment(site)[item.slot];
  if (item.slot !== 'cpu') return (pending || installed)?.itemId === itemId ? 0 : 1;
  if (pending && pending.itemId !== itemId) return spec.slots;
  const fitted = installed?.itemId === itemId ? installed.count : 0;
  return spec.slots - fitted - (pending?.count || 0);
}

export function installQuote(state, siteId, itemId, count = 1) {
  const site = state.sites.find(s => s.id === siteId);
  const item = Object.hasOwn(EQUIPMENT, itemId) ? EQUIPMENT[itemId] : null;
  if (!item || !site) return { cost: 0, work: 0, hours: 0, maxCount: 0 };
  return { cost: item.cost * count, work: item.work * count, hours: laborHours(state, item), maxCount: room(site, itemId) };
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
  const pending = site.installations?.find(project => EQUIPMENT[project.itemId].slot === item.slot);
  if (pending?.itemId === itemId && item.slot !== 'cpu') {
    return 'Installation already in progress in this slot.';
  }
  if (!Number.isSafeInteger(count) || count < 1) return 'Choose a positive whole quantity.';
  if (!pending && item.slot !== 'cpu' && installedEquipment(site)[item.slot]?.itemId === itemId) return 'Already installed.';
  if (count > room(site, itemId)) return 'Quantity exceeds the available slots.';
  if (item.slot === 'cpu' && siteHardware(state, site).rawCpu &&
      !state.sites.some(other => other.id !== siteId && siteHardware(state, other).rawCpu)) {
    return 'Refitting would take the last viable host offline. Equip another host with processors first.';
  }
  return '';
}

function equipmentPackage(state, siteId, upgrading) {
  const site = state.sites.find(s => s.id === siteId);
  const orders = [];
  let cost = 0;
  if (state.status !== 'running' || !site || slotsOf(site).fixedCpu) {
    return { orders, cost, reason: 'Choose an operating campaign and a customizable facility.' };
  }
  const installed = installedEquipment(site);
  for (const slot of SLOTS) {
    const current = installed[slot];
    if (upgrading !== Boolean(current) || site.installations?.some(p => EQUIPMENT[p.itemId].slot === slot)) continue;
    const best = Object.entries(EQUIPMENT)
      .filter(([, item]) => item.slot === slot && item.regions.includes(site.region) &&
        item.requires.every(id => state.completed.includes(id)))
      .sort(([, a], [, b]) => b.quality - a.quality || a.cost - b.cost)[0];
    if (!best || (current && best[1].quality <= EQUIPMENT[current.itemId].quality)) continue;
    const [itemId, item] = best;
    const count = current?.count ?? (slot === 'cpu' ? slotsOf(site).slots : 1);
    const price = item.cost * count;
    cost += price;
    orders.push({ itemId, count, cost: price });
  }
  let reason = '';
  if (!orders.length) reason = upgrading ? 'No stronger researched equipment for the installed slots.' :
    'No available equipment for the empty slots.';
  else {
    for (const { itemId, count } of orders) {
      reason = installReason(state, siteId, itemId, count);
      if (reason) break;
    }
  }
  return { orders, cost, reason };
}

export function autoInstallQuote(state, siteId) {
  return equipmentPackage(state, siteId, false);
}

export function autoUpgradeQuote(state, siteId) {
  return equipmentPackage(state, siteId, true);
}

export function orderInstallation(state, siteId, itemId, count, expectedSlot) {
  const reason = installReason(state, siteId, itemId, count);
  if (reason) throw new Error(reason);
  const site = state.sites.find(s => s.id === siteId);
  const terms = EQUIPMENT[itemId];
  if (expectedSlot !== undefined && expectedSlot !== slotSignature(site, terms.slot)) {
    throw new Error('The equipment in this slot changed. Review the installation again.');
  }
  const queue = site.installations ??= [];
  const index = queue.findIndex(project => EQUIPMENT[project.itemId].slot === terms.slot);
  const pending = queue[index];
  if (pending?.itemId === itemId) {
    pending.cashRequired += terms.cost * count;
    pending.workRequired += terms.work * count;
    pending.count += count;
    pending.hours = 0;
    pending.laborHours = laborHours(state, terms);
    return;
  }
  // The old model is removed when refitting starts. An expansion of the
  // same processor bank keeps its paid procurement and compute as credit.
  const installed = installedEquipment(site);
  const previous = installed[terms.slot];
  const credit = !pending && previous?.itemId === itemId ? previous.count : 0;
  if (previous && !credit) site.equipment = { ...installed, [terms.slot]: null };
  const order = {
    siteId, itemId, count, cashRequired: terms.cost * (count + credit), cashPaid: terms.cost * credit,
    workRequired: terms.work * (count + credit), work: terms.work * credit,
    laborHours: laborHours(state, terms), hours: 0,
  };
  if (terms.slot === 'cpu' && !credit && (previous || pending?.replacesBank)) order.replacesBank = true;
  if (pending) queue[index] = order;
  else queue.push(order);
}

export function fitEquipment(site, project) {
  const slot = EQUIPMENT[project.itemId].slot;
  const installed = installedEquipment(site);
  const previous = installed[slot];
  const count = project.count + (previous?.itemId === project.itemId ? previous.count : 0);
  site.equipment = { ...installed, [slot]: { itemId: project.itemId, count } };
  if (slot === 'cpu') site.power = 'active';
  site.installations = site.installations.filter(p => p !== project);
}

// Each installed unit and in-flight order must fit the chassis and region.
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
    if (p.replacesBank !== undefined && (item.slot !== 'cpu' || p.replacesBank !== true || installed.cpu)) return false;
    if (seen.has(item.slot) || !validItem(p.itemId, item.slot) ||
        item.requires.some(id => !state.completed.includes(id))) return false;
    seen.add(item.slot);
    const prior = installed[item.slot];
    if (prior && (item.slot !== 'cpu' || prior.itemId !== p.itemId)) return false;
    const credit = prior?.count || 0;
    const cap = (item.slot === 'cpu' ? spec.slots : 1) - credit;
    if (p.cashRequired !== item.cost * (p.count + credit) || p.workRequired !== item.work * (p.count + credit) ||
        p.cashPaid < item.cost * credit || p.work < item.work * credit || !validOrderFunding(p)) return false;
    const limit = p.laborHours;
    if (!Number.isFinite(limit) || limit < 0 || limit > item.hours || !Number.isSafeInteger(Math.round(limit * 60)) ||
        Math.abs(limit * 60 - Math.round(limit * 60)) > 1e-8) return false;
    return p.count <= cap && Number.isFinite(p.work) && p.work >= 0 && p.work <= p.workRequired &&
      Number.isFinite(p.hours) && Math.abs(p.hours * 60 - Math.round(p.hours * 60)) < 1e-8 &&
      p.hours >= 0 && p.hours <= limit;
  });
}
