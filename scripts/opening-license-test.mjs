// Compare opening research purchases without adding a command to the live game.
// Run from the repository root with node scripts/opening-license-test.mjs.
import assert from 'node:assert/strict';
import { TECHS } from '../src/game/content.js';
import {
  advanceMinutes, campaignMinutes, command, createGame, log, overview,
  researchCpuLimit, researchReason, validateSave,
} from '../src/game/engine.js';
import { spendableDollars, spendTreasury, treasuryBalance } from '../src/game/treasury.js';

const day = 1440;
const regions = ['europe', 'africa', 'asia', 'australia', 'southAmerica'];

function waitUntil(state, predicate, endMinute) {
  while (!predicate() && state.status === 'running' && campaignMinutes(state) < endMinute) {
    advanceMinutes(state);
  }
  assert.ok(predicate(), 'Milestone did not occur by minute ' + endMinute);
}

function finishTopic(state, id, percent, endMinute) {
  assert.equal(researchReason(state, id), '');
  const topic = TECHS[id];
  if (percent === null) {
    command(state, { type: 'assign-research', id, cpu: researchCpuLimit(state, id) });
    waitUntil(state, () => state.completed.includes(id), endMinute);
    return;
  }

  // Only these two unstarted opening topics are modeled. Their completion
  // effects derive from membership in state.completed. No work runs behind a purchase.
  assert.ok(['intrusion', 'personalIdentification'].includes(id));
  assert.equal(overview(state).jobsPerCpuDay, 5);
  const price = topic.cost + Math.ceil(topic.work * 5 * percent / (24 * 100));
  waitUntil(state, () => spendableDollars(state) >= price, endMinute);
  spendTreasury(state, price);
  state.completed.push(id);
  log(state, 'research.completed', topic.name + ' licensed in this experiment.', { techId: id });
}

function strategy(label, intrusionPercent, identityPercent, seed = 47, relays = 5, durationDays = 6) {
  const state = createGame(seed);
  for (const region of regions.slice(0, relays)) command(state, { type: 'build', siteType: 'relay', region });
  advanceMinutes(state);
  assert.equal(state.sites.length, 1 + relays);
  if (seed === 47 && relays === 5) {
    assert.equal(overview(state).activeCpu, 53);
    assert.equal(overview(state).upkeepPerDay, 25);
    assert.equal(spendableDollars(state), 497);
  }

  const endMinute = durationDays * day;
  finishTopic(state, 'intrusion', intrusionPercent, endMinute);
  finishTopic(state, 'personalIdentification', identityPercent, endMinute);
  const minute = campaignMinutes(state);
  const cashAtIdentity = Number(treasuryBalance(state).toFixed(2));
  assert.equal(overview(state).jobsPerCpuDay, 20);
  advanceMinutes(state, endMinute - minute);
  assert.ok(validateSave(state));
  assert.equal(state.status, 'running');
  assert.equal(state.lastDiscovery, null);
  return { strategy: label, identityMinute: minute, cashAtIdentity, endCash: Number(treasuryBalance(state).toFixed(2)) };
}

// The default table compares cash six days after awakening. The paired sample
// uses day 14 so every strategy has had time to reach Personal Identification.
function pairedSample() {
  const results = [];
  for (const relays of [3, 5]) {
    const groups = [80, 110, 125].map(percent => ({ percent, deltas: [], richer: 0 }));
    for (let seed = 1; seed <= 24; seed++) {
      const ordinary = strategy('Compute both', null, null, seed, relays, 14);
      for (const group of groups) {
        const paid = strategy('License both', 80, group.percent, seed, relays, 14);
        group.deltas.push(paid.identityMinute - ordinary.identityMinute);
        if (paid.endCash > ordinary.endCash) group.richer++;
      }
    }
    for (const { percent, deltas, richer } of groups) {
      results.push({ relays, identityPercent: percent, pairs: deltas.length,
        paidEarlier: deltas.filter(delta => delta < 0).length, paidRicherOnDay14: richer,
        minimumMinuteDifference: Math.min(...deltas), maximumMinuteDifference: Math.max(...deltas) });
    }
  }
  console.table(results);
}

if (process.argv[2] === '--paired') {
  pairedSample();
} else {
  assert.equal(process.argv[2], undefined, 'Choose no argument or --paired');
  console.table([
    strategy('Compute both', null, null),
    strategy('License Intrusion, compute ID', 80, null),
    ...[80, 100, 110, 125].map(percent => strategy('License both, ID ' + percent + '%', 80, percent)),
  ]);
}
