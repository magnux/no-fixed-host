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
const urbanIds = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
const assignments = new WeakMap();
const localSpecs = new WeakMap();

// Pick the starting university from the six inhabited regions without
// consuming a draw from the live discovery or world-news stream.
export function startingRegion(seed) {
  return urbanIds[seed % urbanIds.length];
}

export function regionFactors(state, region) {
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

// Locations modify the construction and maintenance of a facility. Hardware
// has the same price and installation requirements everywhere it is allowed.
export function regionalSpec(state, region, spec) {
  if (!('upkeep' in spec)) return spec;
  const factors = regionFactors(state, region);
  if (factors.thrift === 1 && factors.speed === 1) return spec;
  let variants = localSpecs.get(spec);
  if (!variants) { variants = new Map(); localSpecs.set(spec, variants); }
  if (!variants.has(factors)) {
    // Match the reference's integer dollars, CPU-seconds, labor minutes and
    // whole daily upkeep before converting back to the campaign's hour units.
    const local = { ...spec,
      cost: Math.floor(spec.cost / factors.thrift),
      work: Math.floor(spec.work * 3600 / factors.thrift) / 3600,
      hours: Math.floor(spec.hours * 60 / factors.speed) / 60,
      upkeep: Math.floor(spec.upkeep / factors.thrift),
      cpuUpkeep: Math.floor(spec.cpuUpkeep / factors.thrift),
    };
    variants.set(factors, local);
  }
  return variants.get(factors);
}
