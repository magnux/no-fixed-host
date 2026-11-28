// Endgame: Singularity v1.1 Normal. Discovery multipliers and evidence use
// basis points. The two grace budgets are measured in simulated days.
export const NORMAL = Object.freeze({
  startingCash: 1000,
  dailyInterest: 1,
  discoveryMultiplier: 10_000,
  evidencePerDiscovery: 1000,
  openingDays: 23,
  openingCpuDays: 5000,
  siteGraceMultiplier: 2,
});

export function hasGrace(state) {
  return state.completed.includes('apotheosis') ||
    (state.hour < NORMAL.openingDays * 24 && state.cpuHours <= NORMAL.openingCpuDays * 24);
}

export function dailyEvidenceDecay(evidence, decayRate) {
  return Math.max(1, Math.floor(evidence * Math.max(1, decayRate) / 10_000));
}

// Both stored times come from whole-minute ticks. Converting the start and
// duration separately preserves protection at its inclusive final minute.
export function siteHasGrace(nowMinute, startedAtHours, laborHours) {
  const age = nowMinute - Math.round(startedAtHours * 60);
  return age <= NORMAL.siteGraceMultiplier * Math.round(laborHours * 60);
}
