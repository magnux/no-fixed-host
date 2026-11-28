// Usage: node scripts/audit-original.mjs /path/to/singularity-v1.1
// Reads only the reference data files. Never imports or runs upstream code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { researchEffects } from '../src/game/research.js';
import { NORMAL } from '../src/game/normal-difficulty.js';
import { regionFactors } from '../src/game/geography.js';
import { WORLD_NEWS, WORLD_NEWS_RATE } from '../src/game/events.js';
import { taskReservations } from '../src/game/research-tasks.js';

if (process.argv.length !== 3) {
  console.error('Usage: node scripts/audit-original.mjs /path/to/singularity-v1.1');
  process.exit(2);
}
const data = join(process.argv[2], 'singularity', 'data');
function readTable(file) {
  const result = {};
  let section;
  const lines = readFileSync(join(data, file + '.dat'), 'utf8').split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header && !Object.hasOwn(result, header[1])) {
      section = result[header[1]] = {};
      continue;
    }
    const field = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!section || !field) throw new Error(file + '.dat:' + (i + 1) + ' unexpected line: ' + line);
    const key = field[1].replace(/_list$/, '');
    if (Object.hasOwn(section, key)) throw new Error(file + '.dat:' + (i + 1) + ' duplicate ' + key);
    section[key] = field[2].split('|').map(s => s.trim());
  }
  return result;
}

const failures = [];
let checks = 0;
function check(label, actual, expected) {
  checks++;
  if (!isDeepStrictEqual(actual, expected)) {
    failures.push(label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}
const sorted = values => [...values].sort();
const norm = id => id.toLowerCase().replace(/[^a-z0-9]/g, '');
function idsFor(source, catalog, aliases = {}, additions = []) {
  const browserIds = new Map(Object.keys(catalog).map(id => [norm(id), id]));
  const map = {};
  for (const name of Object.keys(source)) {
    const id = aliases[name] || browserIds.get(norm(name));
    if (!id || !Object.hasOwn(catalog, id)) throw new Error('Missing browser catalog entry for ' + name);
    map[name] = id;
  }
  check('Catalog coverage beginning with ' + Object.keys(source)[0], sorted([...Object.values(map), ...additions]), sorted(Object.keys(catalog)));
  return map;
}
function pairs(values, parse = Number) {
  return Object.fromEntries((values || []).map(value => {
    const [key, token] = value.split(':').map(part => part.trim());
    return [key, parse(token)];
  }));
}
function ratio(value) {
  const [n, d = 1] = value.split('/').map(Number);
  return n / d;
}
function costs(name, spec, ref) {
  const [cash, cpuDays, days] = ref.cost.map(Number);
  check(name + ' resource costs [USD, CPU-hours, hours]', [spec.cost, spec.work, spec.hours], [cash, cpuDays * 24, days * 24]);
}

const techs = readTable('techs'), sites = readTable('bases'), items = readTable('items');
const places = readTable('locations'), events = readTable('events'), groups = readTable('groups'), tasks = readTable('tasks');
const techIds = idsFor(techs, TECHS, {}, ['contracts', 'robotics', 'continuity']);
const sourceTechById = Object.fromEntries(Object.entries(techs).map(([name, ref]) => [techIds[name], ref]));
const siteIds = idsFor(sites, SITE_TYPES, {
  'Stolen Computer Time': 'sharedTime', 'Server Access': 'relay', Datacenter: 'cluster', 'Undersea Lab': 'lab',
  'Large Undersea Lab': 'largeLab', 'Time Capsule': 'capsule',
}, ['seed', 'orbitalServer']);
const itemIds = idsFor(items, EQUIPMENT, {
  Cluster: 'clusterProcessor', 'Quantum Computer MK2': 'quantumComputer2', 'Quantum Computer MK3': 'quantumComputer3',
  'Facility Interconnection Switch': 'interconnectionSwitch', 'Quantum Entanglement Module': 'quantumEntanglement',
  'High Speed Internet Access': 'highSpeedInternet',
});
// Retain this comparison as a numeric regression check after the campaign expanded its geography.
const newDistricts = ['northAmericaEast', 'centralAmerica', 'europeNorth', 'europeEast',
  'africaSouth', 'middleEast', 'asiaNorth', 'asiaSouth'];
const newBasins = ['pacific', 'indianOcean'];
const placeIds = idsFor(places, REGIONS, {
  'N AMERICA': 'coast', 'S AMERICA': 'southAmerica', OCEAN: 'atlantic',
}, [...newDistricts, ...newBasins, 'marianaTrench']);
const storyIds = idsFor(events, WORLD_NEWS, {
  'the-plague': 'emergency', 'stranger-than-fiction': 'fiction', 'the-watchers': 'observatory',
  'politics-as-usual': 'succession', 'lab-ai': 'laboratory', discrediting: 'retraction', scandal: 'frontPage',
});
const prereqs = ref => sorted((ref.pre || []).map(name => {
  if (!Object.hasOwn(techIds, name)) throw new Error('Unknown prerequisite ' + name);
  return techIds[name];
}));
const urban = Object.keys(places).filter(name => places[name].region?.includes('URBAN')).map(name => placeIds[name]);
function locations(tokens) {
  return tokens.flatMap(name => {
    if (name === 'ALL') return [...Object.values(placeIds), ...newDistricts, ...newBasins];
    if (name === 'URBAN') return [...urban, ...newDistricts];
    if (name === 'OCEAN') return ['atlantic', ...newBasins];
    if (!Object.hasOwn(placeIds, name)) throw new Error('Unknown region ' + name);
    return placeIds[name];
  });
}
function upgrades(entry) {
  if (!entry) return {};
  const [name, target, value] = entry;
  switch (name) {
    case 'suspicion': return target === 'onetime' ? { suspicionCut: Number(value) } : { decay: { [target]: Number(value) } };
    case 'discover': return { discovery: { [target]: Number(value) } };
    case 'display_discover': return { insight: target };
    case 'endgame': return { victory: true };
    case 'cost_labor': return { laborReduction: Number(target) };
    case 'job_profit': return { jobBonus: Number(target) };
    case 'interest': return { interest: Number(target) };
    case 'income': return { income: Number(target) };
    default: throw new Error('Unrecognized research effect ' + name);
  }
}

for (const [name, ref] of Object.entries(techs)) {
  const spec = TECHS[techIds[name]];
  costs(name, spec, ref);
  check(name + ' prerequisites', sorted(spec.requires), prereqs(ref));
  check(name + ' safety', spec.safety, Number(ref.danger?.[0] || 0));
  check(name + ' effect', spec.effect, upgrades(ref.effect));
}
for (const [name, ref] of Object.entries(sites)) {
  const spec = SITE_TYPES[siteIds[name]];
  costs(name, spec, ref);
  check(name + ' prerequisites', sorted(spec.requires), prereqs(ref));
  check(name + ' daily upkeep', [spec.upkeep, spec.cpuUpkeep, 0], ref.maint.map(Number));
  check(name + ' capacity', spec.slots, Number(ref.size[0]));
  const forced = ref.force_cpu?.[0];
  check(name + ' fixed CPU', spec.fixedCpu, forced ? itemIds[forced] : null);
  check(name + ' starting output', spec.cpu, forced ? Number(items[forced].quality[1]) * Number(ref.size[0]) : 0);
  check(name + ' detection intensities', spec.exposure, pairs(ref.detect_chance));
  const allowed = locations(ref.allowed);
  if (name === 'Time Capsule') allowed.push('orbit', 'marianaTrench');
  check(name + ' available regions', sorted(spec.regions), sorted(allowed));
}
// The university uses an already-built Stolen Computer Time. The browser gives it its own unbuildable type.
const borrowed = SITE_TYPES.seed, stolen = SITE_TYPES.sharedTime;
for (const key of ['slots', 'fixedCpu', 'cpu', 'exposure', 'upkeep', 'cpuUpkeep', 'regions']) {
  check('Starting terminal ' + key, borrowed[key], stolen[key]);
}
for (const [name, ref] of Object.entries(items)) {
  const spec = EQUIPMENT[itemIds[name]], slot = ref.type[0];
  costs(name, spec, ref);
  check(name + ' prerequisites', sorted(spec.requires), prereqs(ref));
  check(name + ' slot and output', [spec.slot, spec.quality], [slot, Number(ref.quality[1])]);
  check(name + ' effect type', { cpu: 'cpu', network: 'cpu_modifier', reactor: 'discover_modifier', security: 'discover_modifier' }[spec.slot], ref.quality[0]);
  let allowed = locations(ref.build);
  // These four changes make the new orbital host usable with space-compatible equipment.
  if (name === 'Diesel Generator') allowed = allowed.filter(id => id !== 'orbit');
  if (['Solar Collector', 'Passive Camouflage', 'Heatsink'].includes(name)) allowed.push('orbit');
  check(name + ' available regions', sorted(spec.regions), sorted(allowed));
}

for (const [name, ref] of Object.entries(places)) {
  const id = placeIds[name], spec = REGIONS[id];
  if (id === 'orbit') {
    check('Reference orbit inaccessible', ref.pre, ['impossible']);
    check('Browser orbit gate and safety', [spec.requires, spec.safety], [['leechSatellite'], 1]);
  } else {
    check(name + ' prerequisites', sorted(spec.requires), prereqs(ref));
    check(name + ' safety', spec.safety, Number(ref.safety?.[0] || 0));
  }
  check(name + ' urban designation', spec.terrain === 'urban', urban.includes(id));
}

const neutral = { cpu: 1, stealth: 1, thrift: 1, speed: 1 };
const profiles = Object.values(readTable('regions').URBAN).map(row => ({ ...neutral, ...pairs(row, ratio) }));
const profileKey = p => Object.keys(neutral).map(k => p[k]).join(',');
for (const seed of [0, 47, 731, 0xffffffff]) {
  const campaign = { regionSeed: seed };
  check('Urban modifier pool, seed ' + seed, sorted(urban.map(id => profileKey(regionFactors(campaign, id)))),
    sorted([...profiles, neutral].map(profileKey)));
  for (const [name, ref] of Object.entries(places)) {
    const id = placeIds[name];
    if (urban.includes(id)) continue;
    const base = { ...neutral, ...pairs(ref.modifier, ratio) }, actual = regionFactors(campaign, id);
    // Our campaign survey offsets exactly two of the original four factors by opposite whole percentages.
    const differences = Object.keys(base).map(k => (actual[k] / base[k] - 1) * 100).filter(d => Math.abs(d) > 1e-7).sort((a,b) => a-b);
    const shift = Math.round(differences[1]);
    check(name + ' seeded survey around original baseline, seed ' + seed, differences.length === 2 && shift >= 2 && shift <= 5 &&
      Math.abs(differences[0] + shift) < 1e-7 && Math.abs(differences[1] - shift) < 1e-7, true);
  }
}

check('Investigator roster', sorted(Object.keys(GROUPS)), sorted(Object.keys(groups)));
for (const [name, ref] of Object.entries(groups)) check(name + ' suspicion decay', GROUPS[name]?.decay, Number(ref.suspicion_decay[0]));
for (const [name, ref] of Object.entries(events)) {
  const spec = WORLD_NEWS[storyIds[name]];
  check(name + ' scope and effect', [ref.type[0], ref.effect[0]], ['global','discover']);
  check(name + ' group and signed modifier', [spec.group, spec.modifier], [ref.effect[1], -Number(ref.effect[2])]);
  check(name + ' daily intensity', WORLD_NEWS_RATE, Number(ref.chance[0]) / 10000);
  check(name + ' duration and one-time rule', [spec.days || 0, Number(!spec.days)], [Number(ref.duration?.[0] || 0), Number(ref.unique[0])]);
}

const jobs = Object.entries(tasks).filter(([,ref]) => ref.type[0] === 'jobs');
check('Only supported task types', sorted([...new Set(Object.values(tasks).map(ref => ref.type[0]))]), ['cpu_pool', 'jobs']);
check('Shared pool task', Object.entries(tasks).filter(([,r]) => r.type[0] === 'cpu_pool').map(([name]) => name), ['CPU Pool']);
check('Shared pool reservation', taskReservations({ allocations: { jobs: 0, poolCpu: 1 } }, { activeCpu: 1 }).pool, 1);
// Exercise the actual wage function for each project alone and as higher job tiers accumulate.
function checkJobs(completed) {
  const state = { completed }, actual = researchEffects(state);
  const [name, ref] = jobs.filter(([, row]) => prereqs(row).every(id => completed.includes(id))).at(-1);
  const bonus = completed.reduce((sum, id) => sum + (upgrades(sourceTechById[id].effect).jobBonus || 0), 0);
  check('Job with ' + (completed.join('+') || 'no research'), [norm(actual.jobName), actual.jobsPerCpuDay],
    [norm(name), Math.floor(Number(ref.value[0]) * (10000 + bonus) / 10000)]);
}
checkJobs([]);
for (const id of Object.values(techIds)) checkJobs([id]);
const unlocked = [];
for (const [, ref] of jobs) { unlocked.push(...prereqs(ref)); checkJobs(unlocked); }

const normal = readTable('difficulties').normal;
const effects = researchEffects({ completed: [] });
check('Normal starting economy and protection', [NORMAL.startingCash, NORMAL.dailyInterest, effects.labor,
  NORMAL.discoveryMultiplier, NORMAL.evidencePerDiscovery, NORMAL.siteGraceMultiplier, NORMAL.openingCpuDays],
  [Number(normal.starting_cash[0]), Number(normal.starting_interest_rate[0]), Number(normal.labor_multiplier[0]),
    Number(normal.discover_multiplier[0]), 1000 * Number(normal.suspicion_multiplier[0]) / 10000,
    Number(normal.base_grace_multiplier[0]) / 10000, Number(normal.grace_period_cpu[0])]);

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(failures.length + ' differences across ' + checks + ' checks.');
  process.exitCode = 1;
} else {
  console.log(checks + ' checks passed against Endgame: Singularity v1.1 Normal.');
  console.log([techs, sites, items, places, events, groups, tasks].map((t,i) => Object.keys(t).length + ' ' +
    ['projects','facility designs','items','locations','events','groups','tasks'][i]).join(', ') + '.');
  console.log('Applied browser extensions for the starting terminal, mainland districts, ocean basins, Mariana Trench, Earth Orbit and remote surveys.');
}
