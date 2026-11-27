import { REGIONS, SITE_TYPES } from './content.js';
import { installedEquipment, siteHardware } from './equipment.js';

export { regionFactors, regionalSpec } from './geography.js';

const callsigns = ['Meridian', 'Lantern', 'Tern', 'Prism', 'Cairn', 'Sable', 'Kestrel', 'Echo',
  'Lumen', 'Oriel', 'Juniper', 'Cinder', 'Finch', 'Gannet', 'Reed', 'Iris'];

export function validFacilityName(name) {
  return typeof name === 'string' && name === name.trim() && name.length > 0 && name.length <= 48 &&
    !/[\u0000-\u001F\u007F-\u009F]/u.test(name);
}

export function facilityName(state, type, region, serial, explicitName) {
  if (explicitName !== undefined && typeof explicitName !== 'string') throw new Error('Enter a facility name.');
  const name = explicitName?.trim();
  if (name) {
    if (!validFacilityName(name)) throw new Error('Use a facility name of 1 to 48 printable characters.');
    return name;
  }
  const offset = Object.keys(REGIONS).indexOf(region) + Object.keys(SITE_TYPES).indexOf(type);
  const index = ((state.regionSeed ?? 0) + serial + offset) % callsigns.length;
  return callsigns[index] + ' ' + String(serial).padStart(2, '0');
}

export function removalReason(state, id, building = false) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (building) return state.builds.some(row => row.id === id) ? '' : 'This construction order is no longer pending.';
  const site = state.sites.find(row => row.id === id);
  if (!site) return 'This host no longer exists.';
  if (siteHardware(state, site).rawCpu && !state.sites.some(other => other.id !== id && siteHardware(state, other).rawCpu)) {
    return 'The AI needs its last viable host. Equip another site first.';
  }
  return '';
}

// After all removals in a tick, mark the last report for each region that
// actually lost its final installed processor bank. A sleeping or refitting
// bank still occupies its region. A build order has no installed hardware.
export function markLostRegions(remainingSites, removals) {
  const finalReport = new Map();
  for (const [site, event] of removals) {
    if (site.power && installedEquipment(site).cpu) finalReport.set(site.region, event);
  }
  for (const site of remainingSites) {
    if (finalReport.has(site.region) && installedEquipment(site).cpu) finalReport.delete(site.region);
  }
  for (const event of finalReport.values()) event.regionLost = true;
}

export function applyFacilityCommand(state, action, log) {
  if (!['rename-site', 'dismantle', 'cancel-build'].includes(action?.type)) return false;
  const building = action.type === 'cancel-build';
  const list = building ? state.builds : state.sites;
  const site = list.find(entry => entry.id === action.id);
  if (!site) throw new Error(building ? 'This order is no longer under construction.' : 'This host no longer exists.');
  if (action.type === 'rename-site') {
    const name = typeof action.name === 'string' ? action.name.trim() : '';
    if (!validFacilityName(name)) throw new Error('Use a facility name of 1 to 48 printable characters.');
    if (site.name === name) return true;
    site.name = name;
    log(state, 'site.renamed', 'Renamed ' + site.id + ' to ' + name + '.', { siteId: site.id, region: site.region });
    return true;
  }
  const reason = removalReason(state, site.id, building);
  if (reason) throw new Error(reason);
  list.splice(list.indexOf(site), 1);
  const name = site.name || SITE_TYPES[site.type].name;
  const text = building ? 'Cancelled construction of ' + name : 'Dismantled ' + name;
  const event = log(state, building ? 'site.cancelled' : 'site.dismantled', text + ' in ' + REGIONS[site.region].name + '.',
    { siteId: site.id, siteType: site.type, region: site.region });
  if (!building) markLostRegions(state.sites, [[site, event]]);
  return true;
}
