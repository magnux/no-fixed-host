import { NORMAL } from './normal-difficulty.js';

// Normal starts at one basis point of daily interest. The reference rounds
// the day's rate to whole dollars before prorating it over elapsed time.
export function dailyInterest(balance, bonusBasisPoints = 0) {
  return Math.floor(balance * (NORMAL.dailyInterest + bonusBasisPoints) / 10_000);
}

// Whole-dollar charges follow the day clock. At midnight endMinute is 1440,
// so every installment for the elapsed day is collected exactly once.
export function maintenanceInstallment(dailyRate, endMinute) {
  return Math.floor(dailyRate * endMinute / 1440) - Math.floor(dailyRate * (endMinute - 1) / 1440);
}

// Only two reports can shape regional attention. For simultaneous finds,
// sample two distinct reports; both can legitimately name the same region.
export function recentDiscoveryRegions(previous, discoveries, random) {
  if (discoveries.length === 0) return previous;
  const region = index => discoveries[index].site.region;
  if (discoveries.length === 1) return [region(0), ...previous.slice(0, 1)];

  const first = Math.floor(random() * discoveries.length);
  if (discoveries.length === 2) return [region(first), region(1 - first)];
  const second = Math.floor(random() * (discoveries.length - 1));
  return [region(first), region(second < first ? second : second + 1)];
}
