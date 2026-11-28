import { TECHS } from './content.js';
import { ordinaryResearchAllocation, assignmentLimit, eligibleCpu, researchProjects } from './research-tasks.js';
export { ordinaryResearchAllocation } from './research-tasks.js';
import { CASH_UNITS_PER_DOLLAR } from './report-accounting.js';
import { restoreTreasury, spendableDollars, spendTreasury } from './treasury.js';
import { WORK_UNITS } from './work-order.js';

const DAY = 1440;
const tiers = [[5, 80], [5, 80], [20, 125], [20, 200], [50, 300], [50, 500], [75, 750], [75, 1000]];
const wagePromotions = new Set(['personalIdentification', 'voiceSynthesis', 'simulacra']);
const minute = state => state.hour * 60 + state.minute;
const depths = new Map();
function depth(id) {
  if (!depths.has(id)) depths.set(id, 1 + Math.max(0, ...TECHS[id].requires.map(depth)));
  return depths.get(id);
}

const prices = Object.fromEntries(Object.keys(TECHS).map(id => {
  const [wage, percent] = tiers[Math.min(depth(id), tiers.length) - 1];
  return [id, { wage, percent: wagePromotions.has(id) ? Math.max(125, percent) : percent }];
}));

function marketReason(state, tech, id, economy) {
  if (state.status !== 'running') return 'The campaign has ended.';
  if (state.completed.includes(id)) return 'Research complete.';
  if (tech.safety >= 2 || id === 'continuity') return 'Field research only.';
  if (!tech.requires.every(parent => state.completed.includes(parent))) return 'Complete the prerequisites first.';
  if (tech.safety && !eligibleCpu(economy, tech)) return 'Bring an eligible research host online.';
  return '';
}

// Each rented centi-CPU-minute costs 1.5 times the daily job rate in treasury units.
// Round once at settlement, down to the nearest representable fraction of a dollar.
function charge(units, wage) {
  return Math.floor(units * wage * 1.5) / CASH_UNITS_PER_DOLLAR;
}
const reservation = (units, wage) => Math.ceil(units * wage * 1.5 / CASH_UNITS_PER_DOLLAR);
export const rentalRefund = lease => lease.deposit - charge(lease.deliveredUnits, lease.wage);

export function marketQuote(state, id, economy, allocation) {
  if (!Object.hasOwn(TECHS, id)) throw new Error('Unknown research.');
  const tech = TECHS[id];
  const project = researchProjects(state).find(p => p.id === id);
  const lease = project?.rental;
  const work = Math.round((tech.work - (project?.work || 0)) * WORK_UNITS);
  const hours = tech.hours - (project?.hours || 0);
  const cash = tech.cost - (project?.cashPaid || 0);
  const { wage, percent } = prices[id];
  const divisor = BigInt(WORK_UNITS * 24 * 100);
  const licenseFee = Number((BigInt(work) * BigInt(wage * percent) + divisor - 1n) / divisor);
  const price = cash + licenseFee;
  const owned = allocation.byProject.get(id) || 0;
  const native = ordinaryResearchAllocation(state, economy, allocation).byProject.get(id) || 0;
  const capacity = Math.round(100 * Math.min(owned, native));
  const limitUnits = Math.min(capacity * DAY, Math.floor(work / 2));
  const dailyRate = Math.max(wage, economy.jobsPerCpuDay);
  const deposit = reservation(limitUnits, dailyRate);
  const held = lease ? rentalRefund(lease) : 0;
  const sharedReason = marketReason(state, tech, id, economy);
  const funds = spendableDollars(state);
  const fundsAfterRelease = funds + Math.floor((state.cash % 1) + held + 1e-9);
  const workHours = work / WORK_UNITS;
  // For an unstaffed topic, compare a license with assigning all currently free eligible CPU.
  const comparisonCpu = owned || (!sharedReason && !project?.licensed ? assignmentLimit(state, id, economy, allocation) : 0);
  const licenseHoursSaved = comparisonCpu ? Math.max(0, workHours / comparisonCpu - hours) : null;
  const normalDuration = owned ? Math.max(hours, workHours / owned) : null;
  const extraCpu = capacity / 100;
  const pairedDuration = owned ? Math.max(hours, workHours / (owned + extraCpu)) : null;
  const usefulHours = owned ? Math.min(24, pairedDuration) : 0;
  const leasedDuration = owned ? Math.max(pairedDuration, hours, (workHours - usefulHours * extraCpu) / owned) : null;
  const leaseReason = sharedReason || (project?.licensed ? 'Technical work is already licensed.' :
    lease ? 'A rental is already active.' : !capacity ? 'Assign owned CPU to rent capacity.' :
    !limitUnits || leasedDuration >= normalDuration ? 'Extra CPU would save no time at this allocation.' :
    funds < deposit ? 'Insufficient funds.' : '');
  return { sharedReason, project, hours,
    license: { price, balance: fundsAfterRelease - price, hoursSaved: licenseHoursSaved, comparisonCpu,
      reason: sharedReason || (project?.licensed ? 'Technical work is already licensed.' : fundsAfterRelease < price ? 'Insufficient funds.' : '') },
    rental: { deposit, capacity, limitUnits, dailyRate, balance: funds - deposit,
      hoursSaved: normalDuration === null ? null : Math.max(0, normalDuration - leasedDuration), reason: leaseReason } };
}

export function startResearchRental(state, id, quote, log) {
  const { deposit, capacity, limitUnits, dailyRate, reason } = quote.rental;
  if (reason) throw new Error(reason);
  spendTreasury(state, deposit);
  quote.project.rental = { startedAt: minute(state), unitsPerMinute: capacity,
    limitUnits, deliveredUnits: 0, wage: dailyRate, deposit };
  log(state, 'research.rented', 'Reserved 24 hours of external compute for ' + TECHS[id].name + '.',
    { techId: id, cashCategory: 'rental', cashFlow: -deposit });
}

export function endResearchRental(state, project, log, forecast) {
  if (!project?.rental) throw new Error('No active rental.');
  const lease = project.rental;
  const refund = rentalRefund(lease);
  const clipped = restoreTreasury(state, refund);
  delete project.rental;
  log(state, 'research.rentalEnded', 'External compute released for ' + TECHS[project.id].name + '.',
    { techId: project.id, cashCategory: 'rental', cashFlow: refund - clipped });
  if (forecast) forecast.rentalRefund = (forecast.rentalRefund || 0) + refund - clipped;
}

export function rentedCapacity(project, native) {
  const r = project.rental;
  return r ? Math.min(native, r.unitsPerMinute, r.limitUnits - r.deliveredUnits) : 0;
}

export function validCommercialProject(project, state) {
  const { licensed, rental, id } = project;
  const tech = TECHS[id];
  if (licensed !== undefined && (licensed !== true || !tech.hours || id === 'continuity' || tech.safety >= 2 ||
      project.work !== tech.work || project.cashPaid !== tech.cost || project.cpu !== 0)) return false;
  if (rental === undefined) return true;
  if (!rental || typeof rental !== 'object' || licensed || tech.safety >= 2 || id === 'continuity') return false;
  const { startedAt, unitsPerMinute, limitUnits, deliveredUnits, wage, deposit } = rental;
  return [startedAt, unitsPerMinute, limitUnits, deliveredUnits, wage, deposit].every(n => Number.isSafeInteger(n) && n >= 0) &&
    startedAt <= minute(state) && minute(state) - startedAt < DAY &&
    unitsPerMinute > 0 && limitUnits > 0 && limitUnits <= unitsPerMinute * DAY && limitUnits <= tech.work * WORK_UNITS / 2 &&
    deliveredUnits <= limitUnits && deliveredUnits <= (minute(state) - startedAt) * unitsPerMinute &&
    deliveredUnits <= Math.round(project.work * WORK_UNITS) / 2 &&
    wage >= prices[id].wage && wage <= 200 && deposit === reservation(limitUnits, wage);
}
