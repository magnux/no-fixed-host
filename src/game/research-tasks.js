import { REGIONS, TECHS } from './content.js';

export function researchProjects(state) {
  return state.research ? [state.research, ...(state.researchQueue || [])] : [];
}

const units = cpu => Math.round(cpu * 100);
const sum = values => values.reduce((a, b) => a + b, 0);
export const validCpu = cpu => Number.isFinite(cpu) && cpu >= 0 &&
  Number.isSafeInteger(units(cpu)) && cpu === units(cpu) / 100;

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
  // Continuity is restricted to Ocean CPUs, a subset of tier 1. Other
  // projects use any host at or above their tier.
  const restricted = new Set(projects.flatMap(project => TECHS[project.id].regions || []));
  for (const id of restricted) {
    const members = select(tech => tech.regions?.length === 1 && tech.regions[0] === id);
    if (members.length) constraints.push({ members, cap: units(economy.cpuByRegion[id] || 0) });
  }
  for (let level = economy.tiers.length - 1; level >= 1; level--) {
    const members = select(tech => tech.safety >= level);
    if (members.length) constraints.push({ members, cap: units(economy.tiers[level]) });
  }
  constraints.push({ members: projects.map((_, i) => i), cap: economy.activeCpu * (100 - state.allocations.jobs) });
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
  return Math.min(units(available), economy.activeCpu * (100 - state.allocations.jobs)) / 100;
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

// Older saves used a percentage budget and a per-topic weight. Translate
// their funded tasks into concrete CPU counts once, keeping work and charges.
export function migrateResearchAssignments(state, economy) {
  const projects = researchProjects(state);
  const minute = state.hour * 60 + state.minute;
  // Versions 1–4 rotated indivisible shares every minute. Reconstruct the
  // actual saved minute rather than letting a fresh rounding rule move CPU.
  function oldSplit(budget, shares) {
    const total = sum(shares);
    if (!total) return shares.map(() => 0);
    const gcd = shares.reduce((a, b) => {
      while (b) [a, b] = [b, a % b];
      return a;
    }, 0);
    const offset = BigInt((minute % (total / gcd)) * gcd);
    let cumulative = 0, assigned = 0;
    return shares.map(share => {
      cumulative += share;
      const boundary = Number((BigInt(budget) * BigInt(cumulative) + offset) / BigInt(total));
      const amount = boundary - assigned;
      assigned = boundary;
      return amount;
    });
  }
  const oldPercent = state.allocations.research;
  const referenceCpu = economy.activeCpu || economy.sleepingCpu;
  const requested = oldSplit(referenceCpu * (oldPercent || 100), projects.map(p => p.weight ?? 50));
  const actual = requested.map((n, i) => Math.min(n, units(eligibleCpu(economy, TECHS[projects[i].id]))));
  clampGrants(actual, budgets(state, economy, projects), oldSplit);
  projects.forEach((p, i) => {
    p.cpu = (oldPercent && eligibleCpu(economy, TECHS[p.id]) ? actual[i] : requested[i]) / 100;
    delete p.weight;
    delete p.previousWeight;
  });
  if (!oldPercent && projects.some(p => p.cpu > 0)) state.researchTarget = 0;
  delete state.allocations.research;
}
