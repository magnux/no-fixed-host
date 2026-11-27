import { GROUPS, TECHS } from './content.js';
import { NORMAL } from './normal-difficulty.js';

const BASE = 10_000;
const effectCache = new WeakMap();
const groupValues = value => Object.fromEntries(Object.keys(GROUPS).map(group => [group, value]));

// Effects are derived from the completed projects. Reopening the same campaign
// never reapplies interest bonuses or one-time suspicion reductions.
export function researchEffects(state) {
  const key = state.completed.join('|');
  const previous = effectCache.get(state);
  if (previous?.key === key) return previous.effects;
  const effects = {
    discovery: groupValues(NORMAL.discoveryMultiplier), decay: groupValues(0),
    labor: BASE, jobBonus: BASE, interest: 0, income: 0, insight: 'none',
  };
  for (const id of state.completed) {
    const effect = TECHS[id]?.effect;
    if (!effect) continue;
    for (const [group, amount] of Object.entries(effect.discovery || {})) effects.discovery[group] -= amount;
    for (const [group, amount] of Object.entries(effect.decay || {})) effects.decay[group] += amount;
    effects.labor -= effect.laborReduction || 0;
    effects.jobBonus += effect.jobBonus || 0;
    effects.interest += effect.interest || 0;
    effects.income += effect.income || 0;
    if (effect.insight && effects.insight !== 'full') effects.insight = effect.insight;
  }
  const basePay = state.completed.includes('simulacra') ? 75 :
    state.completed.includes('voiceSynthesis') ? 50 :
    state.completed.includes('personalIdentification') ? 20 : 5;
  effects.jobName = ({ 5: 'Menial jobs', 20: 'Basic jobs', 50: 'Intermediate jobs', 75: 'Expert jobs' })[basePay];
  effects.jobsPerCpuDay = Math.floor(basePay * effects.jobBonus / BASE);
  effectCache.set(state, { key, effects });
  return effects;
}

// Construction settles on the first whole simulation minute meeting its labor target.
export function laborHours(state, spec, effects = researchEffects(state)) {
  return Math.ceil(spec.hours * 60 * effects.labor / BASE) / 60;
}
