// A boost lasts one week and the host can next buy one two weeks after activation.
import { REGIONS, SITE_TYPES } from './content.js';
import { installedEquipment, siteHardware } from './equipment.js';
import { overview, previewWork } from './engine.js';
import { regionalSpec } from './geography.js';
import { siteHasGrace } from './normal-difficulty.js';
import { laborHours } from './research.js';
import { taskReservations } from './research-tasks.js';
import { spendableDollars, spendTreasury } from './treasury.js';

export const WEEK = 7 * 1440;
const minute = state => state.hour * 60 + state.minute;
const hazard = {
  pc: 2, gamingPc: 2, server: 2, clusterProcessor: 1.7, mainframe: 1.7,
  supercomputer: 1.45, quantumComputer: 1.25, quantumComputer2: 1.15, quantumComputer3: 1.10,
};
const onLand = region => ['urban', 'polar'].includes(REGIONS[region]?.terrain);

export function boostActive(state, site) {
  return site.boost !== undefined && !site.boost.stopped && minute(state) < site.boost.start + WEEK;
}

export function hostBoostQuote(state, site) {
  const active = boostActive(state, site);
  const nextMinute = site.boost ? site.boost.start + 2 * WEEK : 0;
  const endMinute = site.boost ? site.boost.start + WEEK : 0;
  const cpu = siteHardware(state, site).nativeCpu;
  const daily = regionalSpec(state, site.region, SITE_TYPES[site.type]).upkeep;
  const fee = 14 * (daily || 5);
  const reason = state.status !== 'running' ? 'The campaign has ended.' :
    !active && minute(state) < nextMinute ? 'Host boost is cooling down.' :
    !active && (!cpu || site.power !== 'active') ? 'Wake a host with an online processor bank.' :
    !active && spendableDollars(state) < fee ? 'Insufficient funds for the boost.' : '';
  return { active, nextMinute, endMinute, cpu, boostedCpu: 2 * cpu, fee, reason,
    hazardMultiplier: hazard[installedEquipment(site).cpu?.itemId] ?? 1 };
}

export function hostHazardMultiplier(state, site, hardware) {
  const boosted = hardware?.burstCpu ? hazard[hardware.installed.cpu.itemId] : 1;
  const crew = site.crew || site.crewTrailEnd === null || site.crewTrailEnd > minute(state);
  return boosted * (crew ? 1.2 : 1);
}

export function startCrewTrails(state, duringGrace) {
  if (duringGrace) return;
  const now = minute(state);
  for (const site of state.sites) {
    if (site.crewTrailEnd === null && !siteHasGrace(now, site.startedAt, site.laborHours)) site.crewTrailEnd = now + WEEK;
  }
}

function crewTerms(state, type, region, build) {
  const spec = regionalSpec(state, region, SITE_TYPES[type]);
  const remainingHours = Math.max(0, (build?.laborHours ?? laborHours(state, spec)) - (build?.hours || 0));
  const remainingCash = spec.cost - (build?.cashPaid || 0);
  const surcharge = Math.ceil(remainingCash / 4);
  return { remainingHours, surcharge, remainingCash, spec,
    reason: state.status !== 'running' ? 'The campaign has ended.' :
      !onLand(region) ? 'Contractors require a ground site.' :
      build?.crew ? 'Contractors are already assigned.' :
      !remainingHours ? 'This facility has no remaining assembly.' : '' };
}

export function contractorQuote(state, type, region, build) {
  const { spec, remainingHours, surcharge, remainingCash, reason } = crewTerms(state, type, region, build);
  const contractHours = Math.ceil(remainingHours * 60 / 2 - 1e-8) / 60;
  const quote = { reason, surcharge, totalPrice: spec.cost + surcharge, remainingHours, contractHours,
    etaHours: null, contractEtaHours: null, hazardMultiplier: 1.2 };
  if (reason) return quote;
  const economy = overview(state);
  const work = previewWork(state, economy);
  let pool = economy.activeCpu - taskReservations(state, economy).jobs - work.researchCpu - economy.cpuUpkeep;
  for (const queued of state.builds) {
    if (queued.id === build?.id) break;
    pool -= work.orders.get(queued)?.cpu || 0;
  }
  const hoursOfWork = Math.max(0, spec.work - (build?.work || 0));
  const cpuHours = hoursOfWork ? pool > 0 ? hoursOfWork / pool : Infinity : 0;
  const cash = spendableDollars(state);
  const eta = (duration, price) => cash >= price && Number.isFinite(cpuHours)
    ? Math.max(1, Math.ceil(60 * Math.max(duration, cpuHours) - 1e-8)) / 60 : null;
  quote.etaHours = eta(remainingHours, remainingCash);
  quote.contractEtaHours = eta(contractHours, remainingCash + surcharge);
  return quote;
}

export function hireCrew(state, build, log) {
  const quote = crewTerms(state, build.type, build.region, build);
  if (quote.reason) throw new Error(quote.reason);
  build.crew = { paid: build.cashPaid, work: build.work, hours: build.hours, surcharge: quote.surcharge };
  build.cashRequired += quote.surcharge;
  if (log) log(state, 'site.contractors', 'Ground contractors hired for ' + build.name + '.',
    { siteId: build.id, region: build.region, surcharge: quote.surcharge });
}

export function hostServiceCommand(state, action, log) {
  if (action?.type === 'hire-contractors') {
    const build = state.builds.find(row => row.id === action.id);
    if (!build) throw new Error('Choose a pending facility order.');
    hireCrew(state, build, log);
    return true;
  }
  if (action?.type !== 'boost-site') return false;
  const site = state.sites.find(row => row.id === action.id);
  if (!site || typeof action.active !== 'boolean') throw new Error('Choose a completed host and boost state.');
  const quote = hostBoostQuote(state, site);
  if (action.active === quote.active) throw new Error('The host boost state has changed.');
  const detail = { siteId: site.id, region: site.region };
  if (action.active) {
    if (quote.reason) throw new Error(quote.reason);
    spendTreasury(state, quote.fee);
    site.boost = { start: minute(state), stopped: false };
    log(state, 'site.boosted', 'Processor boost activated on ' + site.name + '.', { ...detail, cashFlow: -quote.fee, cashCategory: 'boost' });
  } else {
    site.boost.stopped = true;
    log(state, 'site.boost-stopped', 'Processor boost stopped on ' + site.name + '.', detail);
  }
  return true;
}

export function validHostServices(state, site, building, spec) {
  if (site.boost !== undefined && (building || !site.boost || !Number.isSafeInteger(site.boost.start) ||
      site.boost.start < Math.round(site.startedAt * 60) || site.boost.start > minute(state) || typeof site.boost.stopped !== 'boolean')) return false;
  if (site.crewTrailEnd !== undefined && (building || !onLand(site.region) || !site.laborHours ||
      (site.crewTrailEnd !== null && (!Number.isSafeInteger(site.crewTrailEnd) || site.crewTrailEnd < WEEK || site.crewTrailEnd > minute(state) + WEEK)))) return false;
  if (site.crew === undefined) return true;
  const c = site.crew;
  return building && onLand(site.region) && c !== null && Number.isSafeInteger(c.paid) && c.paid >= 0 && c.paid <= Math.min(site.cashPaid, spec.cost) &&
    Number.isFinite(c.work) && c.work >= 0 && c.work <= site.work && Math.round(c.work * 6000) / 6000 === c.work &&
    Number.isFinite(c.hours) && c.hours >= 0 && c.hours < site.laborHours && c.hours <= site.hours && Math.round(c.hours * 60) / 60 === c.hours &&
    c.surcharge === Math.ceil((spec.cost - c.paid) / 4);
}
