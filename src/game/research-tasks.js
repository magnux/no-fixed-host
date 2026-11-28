import { REGIONS, TECHS } from './content.js';

export function researchProjects(state) {
  return state.research ? [state.research, ...(state.researchQueue || [])] : [];
}

const units = cpu => Math.round(cpu * 100);
const sum = values => values.reduce((a, b) => a + b, 0);
export const validCpu = cpu => Number.isFinite(cpu) && cpu >= 0 &&
  Number.isSafeInteger(units(cpu)) && cpu === units(cpu) / 100;

// The pool reservation guarantees capacity for upkeep and orders. Any
// unassigned cycles also flow there. A percentage job allocation follows
// host capacity, while an explicit job count stays fixed as new hosts arrive.
export function taskReservations(state, economy) {
  const capacity = units(economy.activeCpu);
  const pool = Math.min(capacity, units(state.allocations.poolCpu || 0));
  const saleable = units(economy.nativeCpu ?? economy.activeCpu);
  const requested = state.allocations.jobsCpu === undefined
    ? saleable * state.allocations.jobs / 100
    : units(state.allocations.jobsCpu);
  const jobs = Math.min(capacity - pool, saleable, requested);
  return { jobs: jobs / 100, pool: pool / 100, researchLimit: (capacity - jobs - pool) / 100 };
}

export function taskCpuLimit(state, task, economy, allocation) {
  const reservations = taskReservations(state, economy);
  const peer = task === 'jobs' ? reservations.pool : reservations.jobs;
  const available = Math.max(0, units(economy.activeCpu) - units(allocation.budget) - units(peer)) / 100;
  if (task !== 'jobs' || !economy.burstCpu) return available;
  const usage = [...allocation.byProject].map(([id, cpu]) => ({ id, units: units(cpu) }));
  const assignedBurst = units(economy.burstCpu) - remainingBurstUnits(economy, usage);
  const committedNative = units(allocation.budget) - assignedBurst;
  return Math.min(available, (units(economy.nativeCpu) - committedNative) / 100);
}

export function eligibleCpu(economy, tech) {
  if (!tech.regions) return economy.tiers[tech.safety];
  return tech.regions.reduce((total, id) =>
    total + (REGIONS[id].safety >= tech.safety ? economy.cpuByRegion[id] || 0 : 0), 0);
}

// Award leftover centi-CPUs to the largest remainders, with funding order
// breaking exact ties. The returned integers add up to the requested total.
function proportion(total, shares) {
  const denominator = sum(shares);
  if (!denominator || !total) return shares.map(() => 0);
  const remainders = [];
  const result = shares.map((share, index) => {
    const product = total * share;
    let whole, fraction;
    if (Number.isSafeInteger(product)) {
      whole = Math.floor(product / denominator);
      fraction = product % denominator;
    } else {
      const precise = BigInt(total) * BigInt(share);
      whole = Number(precise / BigInt(denominator));
      fraction = Number(precise % BigInt(denominator));
    }
    remainders.push({ index, fraction });
    return whole;
  });
  remainders.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remaining = total - sum(result);
  for (let i = 0; i < remaining; i++) result[remainders[i].index]++;
  return result;
}

function budgets(state, economy, projects) {
  const select = predicate => projects.map((p, i) => predicate(TECHS[p.id]) ? i : -1).filter(i => i >= 0);
  const constraints = [];
  // Continuity may draw from any equipped subsea lab. Its total reservation
  // is limited to those basins even when other tier-one hosts are online.
  for (const { id } of projects) {
    const restricted = TECHS[id];
    if (!restricted.regions) continue;
    const members = select(tech => tech.safety >= restricted.safety &&
      tech.regions?.every(region => restricted.regions.includes(region)));
    constraints.push({ members, cap: units(eligibleCpu(economy, restricted)) });
  }
  for (let level = economy.tiers.length - 1; level >= 1; level--) {
    const members = select(tech => tech.safety >= level);
    if (members.length) constraints.push({ members, cap: units(economy.tiers[level]) });
  }
  const reservations = taskReservations(state, economy);
  if (economy.burstCpu && reservations.jobs) {
    // Jobs need ordinary silicon. The native machines outside a restricted
    // group cover those jobs first. Only the excess reduces its research cap.
    const narrow = projects.map(p => TECHS[p.id]).find(tech => tech.regions);
    const regions = Object.keys(economy.cpuByRegion);
    const addSupply = (members, matches) => {
      if (!members.length) return;
      const available = regions.filter(matches);
      const effective = sum(available.map(r => economy.cpuByRegion[r]));
      const ordinary = sum(available.map(r => economy.nativeCpuByRegion[r] || 0));
      const reservedHere = Math.max(0, reservations.jobs - (economy.nativeCpu - ordinary));
      constraints.push({ members, cap: units(effective - reservedHere) });
    };
    if (narrow) addSupply(select(t => t.regions), r => narrow.regions.includes(r));
    for (let level = economy.tiers.length - 1; level >= 1; level--) {
      addSupply(select(t => t.safety >= level), r => REGIONS[r].safety >= level);
      if (narrow && level > narrow.safety) {
        addSupply(select(t => t.regions || t.safety >= level), r => narrow.regions.includes(r) || REGIONS[r].safety >= level);
      }
    }
  }
  constraints.push({ members: projects.map((_, i) => i), cap: units(reservations.researchLimit) });
  return constraints;
}

function clampGrants(grants, constraints, distribute = proportion) {
  for (const { members, cap } of constraints) {
    const used = members.map(i => grants[i]);
    if (sum(used) <= cap) continue;
    const limited = distribute(cap, used);
    members.forEach((index, i) => { grants[index] = limited[i]; });
  }
  return grants;
}

// Serve field and high-security work first. A less restricted topic may use
// any remaining eligible bank. The units of each bank retain their provenance.
function matchResearch(economy, usage) {
  const banks = Object.keys(economy.cpuByRegion).map(region => ({
    region, native: units(economy.nativeCpuByRegion[region] || 0), burst: units(economy.burstCpuByRegion[region] || 0),
  })).sort((a, b) => REGIONS[a.region].safety - REGIONS[b.region].safety);
  const specificity = id => TECHS[id].regions ? 10 : TECHS[id].safety;
  const matches = [...usage].sort((a, b) => specificity(b.id) - specificity(a.id)).map(row => {
    const tech = TECHS[row.id];
    const eligible = banks.filter(bank => REGIONS[bank.region].safety >= tech.safety && (!tech.regions || tech.regions.includes(bank.region)));
    // Each rented cycle must have an ordinary, locally eligible partner.
    const burst = consume(eligible, 'burst', row.units - (row.externalUsed || 0));
    const native = consume(eligible, 'native', row.units - burst);
    return { id: row.id, eligible, native, burst };
  });
  return { banks, matches };
}

function consume(banks, field, wanted) {
  let remaining = wanted;
  for (const bank of banks) {
    const given = Math.min(bank[field], remaining);
    bank[field] -= given;
    remaining -= given;
    if (!remaining) break;
  }
  return wanted - remaining;
}

export function remainingBurstUnits(economy, usage) {
  if (!economy.burstCpu) return 0;
  return sum(matchResearch(economy, usage).banks.map(bank => bank.burst));
}

export function ordinaryResearchAllocation(state, economy, allocation) {
  if (!economy.burstCpu) return allocation;
  const usage = [...allocation.byProject].map(([id, cpu]) => ({ id, units: units(cpu) }));
  const { banks, matches } = matchResearch(economy, usage);
  // Only genuinely available ordinary silicon can be paired with a rental.
  // In particular a burst on Earth cannot free the last lunar CPU for a job.
  let headroom = Math.max(0, sum(banks.map(bank => bank.native)) - units(taskReservations(state, economy).jobs));
  const leases = new Set(researchProjects(state).filter(p => p.rental).map(p => p.id));
  matches.sort((a, b) => Number(leases.has(b.id)) - Number(leases.has(a.id)));
  const byProject = new Map();
  for (const match of matches) {
    const extra = consume(match.eligible, 'native', Math.min(match.burst, headroom));
    headroom -= extra;
    byProject.set(match.id, (match.native + extra) / 100);
  }
  return { ...allocation, byProject };
}

export function allocateProjects(state, economy) {
  const projects = researchProjects(state);
  const requested = projects.map(p => units(p.cpu));
  const limits = projects.length ? budgets(state, economy, projects) : [];
  const grants = state.researchTarget === undefined ? clampGrants(requested, limits) :
    scaledGrants(units(state.researchTarget), requested, limits);
  return {
    tiers: economy.tiers, budget: sum(grants) / 100,
    byProject: new Map(projects.map((p, i) => [p.id, grants[i] / 100])),
  };
}

// Before local capacity restrictions, which assignment would a returning
// host be asked to serve? Direct edits preserve this intent for offline peers.
export function requestedAssignments(projects, target) {
  const counts = projects.map(p => units(p.cpu));
  const requested = target === undefined ? counts : proportion(units(target), counts);
  return requested.map(n => n / 100);
}

export function assignmentLimit(state, id, economy, allocation) {
  const peers = researchProjects(state).filter(project => project.id !== id);
  const projects = [...peers, { id }];
  const free = budgets(state, economy, projects)
    .filter(group => group.members.includes(peers.length))
    .map(group => group.cap - sum(group.members.map(i => units(allocation.byProject.get(peers[i]?.id) || 0))));
  return Math.max(0, Math.min(...free)) / 100;
}

export function portfolioLimit(state, economy) {
  const topics = researchProjects(state).filter(p => p.cpu > 0).map(p => TECHS[p.id]);
  const available = Object.entries(economy.cpuByRegion).reduce((total, [id, count]) => {
    const eligible = topics.some(t => REGIONS[id].safety >= t.safety && (!t.regions || t.regions.includes(id)));
    return total + (eligible ? count : 0);
  }, 0);
  return Math.min(available, taskReservations(state, economy).researchLimit);
}

// Fill the most restricted group first. If Ocean work hits its cap,
// distribute the remainder in proportion to the other running assignments.
function scaledGrants(target, shares, constraints) {
  const grants = shares.map(() => 0);
  let remaining = target;
  while (remaining > 0) {
    const room = constraints.map(c => ({ members: c.members, cap: c.cap - sum(c.members.map(i => grants[i])) }));
    const active = [...shares];
    for (const { members, cap } of room) {
      if (!cap) for (const i of members) active[i] = 0;
    }
    if (!active.some(Boolean)) break;
    let extra = proportion(remaining, active);
    let bottleneck = null;
    let minRatio = Infinity;
    for (const limit of room) {
      if (sum(limit.members.map(i => extra[i])) <= limit.cap) continue;
      const ratio = limit.cap / sum(limit.members.map(i => active[i]));
      if (ratio < minRatio) {
        bottleneck = limit;
        minRatio = ratio;
      }
    }
    if (bottleneck) {
      const subset = active.map((share, i) => bottleneck.members.includes(i) ? share : 0);
      extra = clampGrants(proportion(bottleneck.cap, subset), room);
    }
    const used = sum(extra);
    if (!used) break;
    extra.forEach((amount, i) => { grants[i] += amount; });
    remaining -= used;
  }
  return grants;
}

export function resizePortfolio(state, cpu, economy) {
  if (!researchProjects(state).some(p => p.cpu > 0)) return;
  // Keep the directly chosen CPU counts intact. Even a tiny master target
  // that rounds a line to zero can be scaled back to its original split.
  state.researchTarget = Math.min(cpu, portfolioLimit(state, economy));
}
