// Money is settled in 1/144000 dollars by the campaign clock. Keeping the
// sub-dollar remainder separate preserves small jobs over long campaigns.
export const CASH_UNITS_PER_DOLLAR = 144_000;

export function initializeStatistics(state) {
  state.statistics = {
    earnedDollars: state.cash,
    earnedRemainder: 0,
    projectsCompleted: 0,
    facilitiesBuilt: 0,
    itemsInstalled: 0,
    installationsCompleted: 0,
  };
}

export function validStatistics(state) {
  const stats = state.statistics;
  const whole = n => Number.isSafeInteger(n) && n >= 0;
  return Boolean(stats &&
    Number.isFinite(stats.earnedDollars) && Number.isInteger(stats.earnedDollars) && stats.earnedDollars >= 0 &&
    whole(stats.earnedRemainder) && stats.earnedRemainder < CASH_UNITS_PER_DOLLAR &&
    whole(stats.projectsCompleted) && whole(stats.facilitiesBuilt) && whole(stats.itemsInstalled) &&
    whole(stats.installationsCompleted) && stats.installationsCompleted <= stats.itemsInstalled);
}

export function recordEarnings(state, cashUnits) {
  const stats = state.statistics;
  const total = stats.earnedRemainder + cashUnits;
  stats.earnedDollars += Math.floor(total / CASH_UNITS_PER_DOLLAR);
  stats.earnedRemainder = total % CASH_UNITS_PER_DOLLAR;
}

export function recordCreated(state, kind, detail) {
  if (kind === 'research.completed') state.statistics.projectsCompleted++;
  if (kind === 'site.online') state.statistics.facilitiesBuilt++;
  if (kind === 'equipment.installed') {
    state.statistics.itemsInstalled += detail.count;
    state.statistics.installationsCompleted++;
  }
}
