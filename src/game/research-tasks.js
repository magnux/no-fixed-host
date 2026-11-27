import { REGIONS, TECHS } from './content.js';

export const DEFAULT_RESEARCH_WEIGHT = 50;

export function researchProjects(state) {
  return state.research ? [state.research, ...(state.researchQueue || [])] : [];
}

export const researchWeight = project => project.weight ?? DEFAULT_RESEARCH_WEIGHT;

// Partition an integer CPU budget without creating or losing a centi-CPU.
// Rotating the rounding boundary prevents a small allocation from starving a peer.
function split(units, weights, minute) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights.map(() => 0);
  let cumulative = 0;
  let distributed = 0;
  const divisor = weights.reduce((a, b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  }, 0);
  const offset = (minute % (total / divisor)) * divisor;
  return weights.map(weight => {
    cumulative += weight;
    const numerator = units * cumulative + offset;
    const limit = Number.isSafeInteger(numerator) ? Math.floor(numerator / total) :
      Number((BigInt(units) * BigInt(cumulative) + BigInt(offset)) / BigInt(total));
    const granted = limit - distributed;
    distributed = limit;
    return granted;
  });
}

export function eligibleCpu(economy, tech) {
  if (!tech.regions) return economy.tiers[tech.safety];
  return tech.regions.reduce((sum, id) =>
    sum + (REGIONS[id].safety >= tech.safety ? economy.cpuByRegion[id] || 0 : 0), 0);
}

// First split the research budget by priority. Restrict each regional project to
// its actual hosts, then enforce nested tier limits: a tier-4 processor can
// contribute to a tier-2 project, but its capacity can only be spent once.
export function allocateProjects(state, economy) {
  const projects = researchProjects(state);
  const budget = economy.activeCpu * state.allocations.research;
  const minute = state.hour * 60 + state.minute;
  const desired = split(budget, projects.map(researchWeight), minute);
  const grants = projects.map((p, i) => Math.min(desired[i], 100 * eligibleCpu(economy, TECHS[p.id])));
  if (projects.length > 1) {
    for (let tier = economy.tiers.length - 1; tier >= 1; tier--) {
      const group = projects.map((project, i) => TECHS[project.id].safety >= tier ? i : -1).filter(i => i >= 0);
      const demand = group.map(i => grants[i]);
      const capacity = economy.tiers[tier] * 100;
      if (demand.reduce((sum, units) => sum + units, 0) <= capacity) continue;
      const restricted = split(capacity, demand, minute);
      group.forEach((index, i) => { grants[index] = restricted[i]; });
    }
  }
  return {
    tiers: economy.tiers, budget: budget / 100,
    byProject: new Map(projects.map((p, i) => [p.id, grants[i] / 100])),
  };
}
