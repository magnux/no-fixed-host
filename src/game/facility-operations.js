import { REGIONS, SITE_TYPES } from './content.js';
import { geographyRoll } from './geography.js';
import { installedEquipment, siteHardware } from './equipment.js';

export { regionFactors, regionalSpec } from './geography.js';

export const regionPlaces = {
  coast: ['Vancouver', 'Calgary', 'San Francisco', 'Anchorage', 'Denver', 'Seattle', 'Edmonton', 'Portland'],
  northAmericaEast: ['Montréal', 'Toronto', 'Chicago', 'Halifax', 'Boston', 'Pittsburgh', 'Atlanta', 'New York'],
  centralAmerica: ['Mexico City', 'Guadalajara', 'Belize City', 'Guatemala City', 'San José', 'Panama City', 'Havana', 'Kingston'],
  southAmerica: ['Valparaíso', 'Recife', 'Lima', 'Medellín', 'Caracas', 'Montevideo', 'Ushuaia', 'Manaus'],
  europeNorth: ['Oslo', 'Reykjavík', 'Helsinki', 'Tallinn', 'Dublin', 'Stockholm', 'Hamburg', 'Rotterdam'],
  europe: ['Barcelona', 'Naples', 'Marseille', 'Valencia', 'Athens', 'Lisbon', 'Porto', 'Split'],
  europeEast: ['Prague', 'Warsaw', 'Kyiv', 'Bucharest', 'Moscow', 'Saint Petersburg', 'Riga', 'Sofia'],
  africa: ['Tangier', 'Tunis', 'Cairo', 'Dakar', 'Accra', 'Lagos', 'Algiers', 'Alexandria'],
  africaSouth: ['Lusaka', 'Cape Town', 'Kigali', 'Maputo', 'Dar es Salaam', 'Luanda', 'Windhoek', 'Gaborone'],
  middleEast: ['Amman', 'Muscat', 'Beirut', 'Riyadh', 'Doha', 'Tehran', 'Ankara', 'Baghdad'],
  asiaNorth: ['Beijing', 'Shanghai', 'Chengdu', 'Ulaanbaatar', 'Almaty', 'Tashkent', 'Shenzhen', 'Harbin'],
  asiaSouth: ['Mumbai', 'Chennai', 'Bengaluru', 'Dhaka', 'Karachi', 'Kathmandu', 'Colombo', 'Thimphu'],
  asia: ['Taipei', 'Seoul', 'Osaka', 'Tokyo', 'Busan', 'Sapporo', 'Kaohsiung', 'Incheon'],
  australia: ['Darwin', 'Fremantle', 'Hobart', 'Adelaide', 'Brisbane', 'Cairns', 'Perth', 'Geelong'],
  antarctic: ['Ross Island', 'Queen Maud Land', 'Mount Erebus', 'Weddell Sea', 'Palmer Land', 'Adélie Land'],
  atlantic: ['Sargasso Sea', 'Mid-Atlantic Ridge', 'Azores Plateau', 'Romanche Trench', 'Rockall Bank', 'Argentine Basin'],
  pacific: ['East Pacific Rise', 'Coral Sea', 'Juan de Fuca Ridge', 'Tonga Trench', 'Shatsky Rise', 'Tasman Sea'],
  indianOcean: ['Java Trench', 'Chagos Bank', 'Carlsberg Ridge', 'Arabian Basin', 'Kerguelen Plateau', 'Ninety East Ridge'],
  marianaTrench: ['Challenger Deep', 'Sirena Deep'],
  moon: ['Mare Imbrium', 'Tycho', 'Shackleton', 'Oceanus Procellarum', 'Mare Crisium', 'Copernicus'],
  orbit: ['Polar Orbit', 'Equatorial Orbit', 'Molniya Orbit', 'Dawn-Dusk Orbit', 'Geostationary Arc'],
  farReaches: ['Kuiper Belt', 'Oort Cloud', 'Sedna', 'Heliopause', 'Scattered Disc'],
  transdimensional: ['Mirror Fold', 'Null Meridian', 'Klein Loop', 'Parallax Seam', 'Echo Plane'],
};

const siteLabels = {
  relay: ['Relay', 'Exchange'], sharedTime: ['Timeshare', 'Server Pool'], cluster: ['Compute Hall', 'Datacenter'],
  storageUnit: ['Lockup', 'Storage'], smallWarehouse: ['Depot', 'Storehouse'], largeWarehouse: ['Freight Hall', 'Warehouse'],
  covertBase: ['Bunker', 'Hideout'], lab: ['Dive Lab', 'Wet Lab'], largeLab: ['Pressure Dome', 'Deep Station'],
  orbitalServer: ['Microserver', 'Relay Pod'], capsule: ['Time Capsule', 'Archive'], lunarFacility: ['Moonbase', 'Lunar Vault'],
  scientificOutpost: ['Survey Post', 'Observatory'], realityBubble: ['Reality Bubble', 'Pocket Lab'],
};

const significantNumbers = [7, 13, 23, 42, 64, 128, 256, 404, 512, 1024, 4096, 8192];

export function validFacilityName(name) {
  return typeof name === 'string' && name === name.trim() && name.length > 0 && name.length <= 48 &&
    !/[\u0000-\u001F\u007F-\u009F]/u.test(name);
}

export function facilityName(state, type, region, serial, explicitName, designLabel) {
  if (explicitName !== undefined && typeof explicitName !== 'string') throw new Error('Enter a facility name.');
  const name = explicitName?.trim();
  if (name) {
    if (!validFacilityName(name)) throw new Error('Use a facility name of 1 to 48 printable characters.');
    return name;
  }
  const roll = geographyRoll(state.regionSeed, region + '/' + type + '/' + serial);
  const localPlaces = regionPlaces[region];
  const place = localPlaces[roll % localPlaces.length];
  const labels = siteLabels[type];
  const label = designLabel ?? (labels ? labels[(roll >>> 8) % labels.length] : SITE_TYPES[type].name);
  const prefix = place + ' ' + label + ' ';
  let number = (roll >>> 16) % 10 < 3 ? significantNumbers[(roll >>> 4) % significantNumbers.length] : roll >>> 17;
  let candidate = prefix + number;
  const hasName = row => row.region === region && row.name === candidate;
  while (state.sites.some(hasName) || state.builds.some(hasName)) {
    candidate = prefix + (++number);
  }
  return candidate;
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
  const holdsRegion = site => installedEquipment(site).cpu || site.installations?.some(order => order.replacesBank);
  for (const [site, event] of removals) {
    if (site.power && holdsRegion(site)) finalReport.set(site.region, event);
  }
  for (const site of remainingSites) {
    if (finalReport.has(site.region) && holdsRegion(site)) finalReport.delete(site.region);
  }
  for (const event of finalReport.values()) event.regionLost = true;
}

export function applyFacilityCommand(state, action, log) {
  if (!['rename-site', 'dismantle', 'cancel-build'].includes(action?.type)) return false;
  const building = action.type === 'cancel-build';
  const list = building ? state.builds : state.sites;
  const site = list.find(entry => entry.id === action.id) ||
    (action.type === 'rename-site' && state.builds.find(entry => entry.id === action.id));
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
