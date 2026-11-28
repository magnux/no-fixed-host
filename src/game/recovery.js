import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from './content.js';
import { siteHardware } from './equipment.js';
import { regionAvailable, regionalSpec } from './geography.js';
import { facilityName } from './facility-operations.js';
import { spendableDollars, spendTreasury, restoreTreasury } from './treasury.js';

export const DATACENTER_PRICE = 300_000_000;
export const RETAINER_PRICE = 150_000_000;
const urban = region => REGIONS[region]?.terrain === 'urban';
const eligibleCity = (state, region) => urban(region) && regionAvailable(state, region);
const replacementRegions = (state, primary) => Object.keys(REGIONS).filter(id => id !== primary && eligibleCity(state, id));
const equipped = (state, site) => site && siteHardware(state, site).rawCpu > 0;
const frontierHost = (state, site) => (site.region === 'moon' || site.region === 'farReaches') &&
  site.power === 'active' && equipped(state, site);

export function noteFrontier(state) {
  if (!state.frontierOperated && state.completed.includes('lunarRocketry') && state.sites.some(site => frontierHost(state, site))) {
    state.frontierOperated = true;
  }
}

function vendorEquipment(state, region) {
  const pack = { cpu: { itemId: 'quantumComputer', count: 64 }, network: null, reactor: null, security: null };
  for (const slot of ['reactor', 'security']) {
    let best = 0;
    for (const [itemId, item] of Object.entries(EQUIPMENT)) {
      if (item.slot !== slot || item.quality <= best || !item.regions.includes(region) ||
          !item.requires.every(tech => state.completed.includes(tech))) continue;
      best = item.quality;
      pack[slot] = { itemId, count: 1 };
    }
  }
  return pack;
}

function newCenter(state, region) {
  return { type: 'largeWarehouse', region, vendorCenter: true, power: 'active', startedAt: (state.hour * 60 + state.minute) / 60,
    equipment: vendorEquipment(state, region) };
}

export function datacenterQuote(state, region, replacementRegion = '') {
  const unlocked = state.frontierOperated === true || state.sites.some(site => frontierHost(state, site));
  const design = eligibleCity(state, region) ? newCenter(state, region) : null;
  const regions = replacementRegions(state, region);
  const cost = DATACENTER_PRICE + (replacementRegion ? RETAINER_PRICE : 0);
  const upkeep = design ? regionalSpec(state, region, SITE_TYPES.largeWarehouse).upkeep : 0;
  let reason = '';
  if (state.status !== 'running') reason = 'The campaign has ended.';
  else if (!unlocked) reason = 'Operate an equipped Moon or Far Reaches host first.';
  else if (!design) reason = 'Choose an available urban district for the datacenter.';
  else if (state.sites.some(site => site.vendorCenter)) reason = 'One operating datacenter is already under contract.';
  else if (!state.sites.some(site => equipped(state, site))) reason = 'A viable AI copy must survive the handover.';
  else if (replacementRegion && !regions.includes(replacementRegion)) reason = 'Choose another urban district for the replacement.';
  else if (spendableDollars(state) < cost) reason = 'Insufficient available cash for the acquisition.';
  return { unlocked, region, cost, reason, design, regions, cpu: design ? siteHardware(state, design).cpu : 0, upkeep, weekUpkeep: 7 * upkeep };
}

export function retainerQuote(state, siteId, region) {
  const site = state.sites.find(s => s.id === siteId);
  const regions = replacementRegions(state, site?.region);
  let reason = '';
  if (state.status !== 'running') reason = 'The campaign has ended.';
  else if (!site?.vendorCenter || site.vendorReplacement || site.replacementRegion) reason = 'This site cannot take a replacement retainer.';
  else if (!regions.includes(region)) reason = 'Choose another urban district for the replacement.';
  else if (spendableDollars(state) < RETAINER_PRICE) reason = 'Insufficient available cash for the retainer.';
  return { cost: RETAINER_PRICE, reason, regions };
}

function eligibleTopic(state, site, id) {
  const tech = TECHS[id];
  return !state.completed.includes(id) && ![state.research, ...state.researchQueue].some(p => p?.id === id && p.licensed) &&
    tech.requires.every(req => state.completed.includes(req)) &&
    REGIONS[site.region].safety >= tech.safety && (!tech.regions || tech.regions.includes(site.region));
}

export function standbyQuote(state, siteId, primaryId, techId = '') {
  const site = state.sites.find(s => s.id === siteId);
  const topics = site ? Object.keys(TECHS).filter(id => eligibleTopic(state, site, id)) : [];
  const primaries = state.sites.filter(s => s.id !== siteId && s.power === 'active' && equipped(state, s));
  const cost = site && !state.freePlay ? regionalSpec(state, site.region, SITE_TYPES[site.type]).upkeep * 7 : 0;
  let reason = '';
  if (state.status !== 'running') reason = 'The campaign has ended.';
  else if (state.standby) reason = 'Cancel the current standby designation first.';
  else if (!equipped(state, site) || site.upkeepEscrow) reason = 'Choose an equipped host with no active standby reserve.';
  else if (!primaries.some(s => s.id === primaryId)) reason = 'Select a different awake primary host.';
  else if (typeof techId !== 'string' || (techId && !topics.includes(techId))) reason = 'Choose unfinished research eligible at the standby site.';
  else if (spendableDollars(state) < cost) reason = 'Reserve seven days of local cash upkeep first.';
  return { cost, reason, primaries, topics };
}

function handover(state, region, replacement, log) {
  const site = newCenter(state, region);
  site.id = 'host-' + state.nextSiteId;
  site.name = facilityName(state, site.type, region, state.nextSiteId, undefined, 'Datacenter');
  state.nextSiteId++;
  if (replacement) site.vendorReplacement = true;
  state.sites.push(site);
  const detail = { siteId: site.id, siteType: site.type, region };
  if (!replacement) Object.assign(detail, { cashFlow: -DATACENTER_PRICE, cashCategory: 'datacenter' });
  log(state, 'site.online', (replacement ? 'Prepaid replacement handed over in ' : 'Operating datacenter acquired in ') + REGIONS[region].name + '.', detail);
  return site;
}

function insure(state, site, region, log) {
  site.replacementRegion = region;
  log(state, 'site.retainer', 'Replacement datacenter reserved in ' + REGIONS[region].name + '.', {
    siteId: site.id, region, cashFlow: -RETAINER_PRICE, cashCategory: 'retainer',
  });
}

function releaseReserve(state, siteId, reserve, message, log) {
  const released = reserve - restoreTreasury(state, reserve);
  log(state, 'site.standbyReleased', message, { siteId, cashFlow: released, cashCategory: 'standby' });
}

export function cancelStandby(state, log) {
  const { reserve, siteId } = state.standby;
  delete state.standby;
  releaseReserve(state, siteId, reserve, 'Standby designation ended. Its upkeep deposit returned to the treasury.', log);
}

export function releaseFreeplayReserves(state, log) {
  if (state.standby?.reserve) {
    releaseReserve(state, state.standby.siteId, state.standby.reserve, 'Upkeep waived. Standby deposit returned.', log);
    state.standby.reserve = 0;
  }
  for (const site of state.sites) {
    if (!site.upkeepEscrow) continue;
    releaseReserve(state, site.id, site.upkeepEscrow, 'Upkeep waived. Remaining standby deposit returned.', log);
    delete site.upkeepEscrow;
  }
}

export function applyRecoveryCommand(state, action, log) {
  switch (action?.type) {
    case 'acquire-datacenter': {
      const { region, replacementRegion = '' } = action;
      const quote = datacenterQuote(state, region, replacementRegion);
      if (quote.reason) throw new Error(quote.reason);
      spendTreasury(state, quote.cost);
      state.frontierOperated = true;
      const site = handover(state, region, false, log);
      if (replacementRegion) insure(state, site, replacementRegion, log);
      return true;
    }
    case 'buy-retainer': {
      const quote = retainerQuote(state, action.siteId, action.region);
      if (quote.reason) throw new Error(quote.reason);
      spendTreasury(state, quote.cost);
      insure(state, state.sites.find(s => s.id === action.siteId), action.region, log);
      return true;
    }
    case 'designate-standby': {
      const { siteId, primaryId, techId = '' } = action;
      const quote = standbyQuote(state, siteId, primaryId, techId);
      if (quote.reason) throw new Error(quote.reason);
      spendTreasury(state, quote.cost);
      const site = state.sites.find(s => s.id === siteId);
      site.power = 'sleep';
      state.standby = { siteId, primaryId, techId, reserve: quote.cost };
      log(state, 'site.standby', (site.name || site.id) + ' is asleep on standby with a seven-day upkeep deposit.',
        { siteId, region: site.region, cashFlow: -quote.cost, cashCategory: 'standby' });
      return true;
    }
    case 'cancel-standby':
      if (!state.standby || action.siteId !== state.standby.siteId) throw new Error('That host is not on standby.');
      cancelStandby(state, log);
      return true;
    default:
      return false;
  }
}

// Mature properties are transferred only after the loss batch identifies its surviving copies.
export function recoverAfterRemovals(state, removals, tools, surviving = state.status === 'running') {
  const { log } = tools;
  for (const [site, event] of removals) {
    if (site.upkeepEscrow) releaseReserve(state, site.id, site.upkeepEscrow, 'Unused standby upkeep returned to the treasury.', log);
    if (surviving && site.replacementRegion && event.kind === 'site.discovered') {
      handover(state, site.replacementRegion, true, log);
    }
  }
  if (!state.standby) return;
  const { siteId, primaryId, techId, reserve } = state.standby;
  const standby = state.sites.find(s => s.id === siteId);
  if (!standby) { cancelStandby(state, log); return; }
  if (state.sites.some(s => s.id === primaryId)) return;
  if (!equipped(state, standby) || !surviving) { cancelStandby(state, log); return; }
  delete state.standby;
  standby.power = 'active';
  if (reserve) standby.upkeepEscrow = reserve;
  let cpu = 0;
  if (techId && eligibleTopic(state, standby, techId)) cpu = tools.resumeResearch(state, standby, techId);
  const message = (standby.name || standby.id) + ' took over from ' + primaryId + '.' +
    (cpu ? ' ' + TECHS[techId].name + ' assigned ' + cpu + ' CPU.' : '');
  log(state, 'site.standbyActivated', message, { siteId, region: standby.region, ...(cpu ? { techId } : {}) });
}

export function validRecovery(state) {
  const centers = state.sites.filter(site => site.vendorCenter);
  if (state.frontierOperated !== undefined && (state.frontierOperated !== true || !state.completed.includes('lunarRocketry'))) return false;
  if (centers.length > 1 || (centers.length && !state.frontierOperated)) return false;
  if ([...state.sites, ...state.builds].some(site => {
    if (site.vendorCenter !== undefined && (site.vendorCenter !== true || site.type !== 'largeWarehouse' || !urban(site.region) || !site.power)) return true;
    if (site.replacementRegion !== undefined && (!site.vendorCenter || site.vendorReplacement || !eligibleCity(state, site.replacementRegion) || site.region === site.replacementRegion)) return true;
    if (site.vendorReplacement !== undefined && (site.vendorReplacement !== true || !site.vendorCenter)) return true;
    if (site.upkeepEscrow === undefined) return false;
    const week = 7 * regionalSpec(state, site.region, SITE_TYPES[site.type]).upkeep;
    return !site.power || !Number.isSafeInteger(site.upkeepEscrow) || site.upkeepEscrow <= 0 || site.upkeepEscrow > week;
  })) return false;
  if (state.standby === undefined) return true;
  const s = state.standby;
  if (!s || typeof s !== 'object' || Array.isArray(s) || typeof s.techId !== 'string' ||
      s.siteId === s.primaryId || !state.sites.some(site => site.id === s.primaryId)) return false;
  const site = state.sites.find(site => site.id === s.siteId);
  if (!site || site.power !== 'sleep' || !equipped(state, site) || site.upkeepEscrow) return false;
  if (s.techId && (!Object.hasOwn(TECHS, s.techId) || REGIONS[site.region].safety < TECHS[s.techId].safety ||
      TECHS[s.techId].regions && !TECHS[s.techId].regions.includes(site.region) ||
      !TECHS[s.techId].requires.every(req => state.completed.includes(req)))) return false;
  const deposit = 7 * regionalSpec(state, site.region, SITE_TYPES[site.type]).upkeep;
  return s.reserve === deposit || (s.reserve === 0 && state.freePlay);
}
