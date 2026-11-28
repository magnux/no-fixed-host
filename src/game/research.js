import { GROUPS, TECHS } from './content.js';
import { NORMAL } from './normal-difficulty.js';

const BASE = 10_000;
const effectCache = new WeakMap();
const groupValues = value => Object.fromEntries(Object.keys(GROUPS).map(group => [group, value]));
const jobs = {
  5: ['Menial jobs', 'Anonymous piecework keeps the first machine paid for.'],
  20: ['Basic jobs', 'A legal identity qualifies the AI for ordinary contracts.'],
  50: ['Intermediate jobs', 'A synthesized voice opens contracts that require client calls.'],
  75: ['Expert jobs', 'Simulacra can attend meetings and take contracts in person.'],
};

export const SAFETY_GUIDANCE = [
  'Any active host with installed processors can run this work.',
  'Use an equipped host away from populated land, in Antarctica, the Ocean, Earth Orbit or a safer region.',
  'Use an equipped host on the Moon, in the Far Reaches or outside this dimension.',
  'Use an equipped host in the Far Reaches or outside this dimension.',
  'Build and equip a reality bubble outside this dimension.',
];

export function researchProgress(project, spec) {
  return Math.min(1, spec.work ? project.work / spec.work : 1,
    spec.hours ? project.hours / spec.hours : 1, spec.cost ? project.cashPaid / spec.cost : 1);
}

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
  [effects.jobName, effects.jobDescription] = jobs[basePay];
  effects.jobsPerCpuDay = Math.floor(basePay * effects.jobBonus / BASE);
  effectCache.set(state, { key, effects });
  return effects;
}

// Labor research reduces the base assembly time before the local facility
// speed modifier. The reference truncates each adjustment to whole minutes.
export function laborHours(state, spec, effects = researchEffects(state)) {
  const baseMinutes = spec.baseLaborMinutes ?? Math.round(spec.hours * 60);
  return Math.floor(Math.floor(baseMinutes * effects.labor / BASE) / (spec.laborSpeed ?? 1)) / 60;
}
