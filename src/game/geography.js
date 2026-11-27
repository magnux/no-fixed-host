import { REGIONS } from './content.js';

const factor = changes => Object.freeze({ cpu: 1, stealth: 1, thrift: 1, speed: 1, ...changes });
const standard = factor({});
const urbanProfiles = [
  factor({ cpu: 6 / 5, stealth: 5 / 6 }), factor({ stealth: 6 / 5, cpu: 5 / 6 }),
  factor({ thrift: 6 / 5, speed: 5 / 6 }), factor({ speed: 6 / 5, thrift: 5 / 6 }),
  factor({ cpu: 6 / 5, thrift: 5 / 6 }), standard,
];
const remote = {
  antarctic: factor({ stealth: 1.2, thrift: 5 / 6 }),
  atlantic: factor({ cpu: 1.2 }),
  moon: factor({ stealth: 1.5, thrift: 0.5, speed: 0.5 }),
  farReaches: factor({ stealth: 2, thrift: 0.1, speed: 0.1 }),
};
const legacy = Object.fromEntries(Object.entries(REGIONS).map(([id, region]) =>
  [id, region.stealth ? factor({ stealth: region.stealth }) : standard]));
const urbanIds = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
const assignments = new WeakMap();
const localSpecs = new WeakMap();

export function regionFactors(state, region) {
  if (state.regionSeed === undefined) return legacy[region] || standard;
  if (REGIONS[region]?.terrain !== 'urban') return remote[region] || standard;
  let assignment = assignments.get(state);
  if (assignment?.seed !== state.regionSeed) {
    // The geography draw has its own generator. Looking at a map never draws
    // from the campaign's discovery or world-news stream.
    let random = state.regionSeed >>> 0;
    const profiles = [...urbanProfiles];
    for (let i = profiles.length - 1; i > 0; i--) {
      random = (Math.imul(1664525, random) + 1013904223) >>> 0;
      const j = Math.floor(random / 0x100000000 * (i + 1));
      [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
    assignment = { seed: state.regionSeed, regions: Object.fromEntries(urbanIds.map((id, i) => [id, profiles[i]])) };
    assignments.set(state, assignment);
  }
  return assignment.regions[region];
}

// Upfront prices and work targets are integer dollars / CPU-hours. Fractional
// upkeep and whole-minute labor targets retain the engine's existing precision.
export function regionalSpec(state, region, spec) {
  const factors = regionFactors(state, region);
  if (factors.thrift === 1 && factors.speed === 1) return spec;
  let variants = localSpecs.get(spec);
  if (!variants) { variants = new Map(); localSpecs.set(spec, variants); }
  if (!variants.has(factors)) {
    const local = { ...spec, cost: Math.round(spec.cost / factors.thrift),
      work: Math.round(spec.work / factors.thrift), hours: Math.ceil(60 * spec.hours / factors.speed) / 60 };
    if ('upkeep' in spec) {
      local.upkeep = Math.round(spec.upkeep / factors.thrift);
      local.cpuUpkeep = Math.round(100 * spec.cpuUpkeep / factors.thrift) / 100;
    }
    variants.set(factors, local);
  }
  return variants.get(factors);
}
