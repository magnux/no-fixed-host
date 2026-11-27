export const GROUPS = {
  news: { name: 'Press', decay: 150 },
  science: { name: 'Scientists', decay: 50 },
  covert: { name: 'Intelligence', decay: 100 },
  public: { name: 'Public', decay: 200 },
};

// Keep the opening campaign's coast/europe/atlantic IDs so older saves retain their sites.
export const REGIONS = {
  coast: { name: 'North America', terrain: 'urban', safety: 0, requires: [] },
  southAmerica: { name: 'South America', terrain: 'urban', safety: 0, requires: [] },
  europe: { name: 'Europe', terrain: 'urban', safety: 0, requires: [] },
  africa: { name: 'Africa', terrain: 'urban', safety: 0, requires: [] },
  asia: { name: 'Asia', terrain: 'urban', safety: 0, requires: [] },
  australia: { name: 'Australia', terrain: 'urban', safety: 0, requires: [] },
  antarctic: { name: 'Antarctica', terrain: 'polar', safety: 1, stealth: 1.2, requires: [] },
  atlantic: { name: 'Ocean', terrain: 'ocean', safety: 1, requires: ['robotics'] },
  moon: { name: 'Moon', terrain: 'space', safety: 2, stealth: 1.5, requires: [] },
  orbit: { name: 'Earth Orbit', terrain: 'space', safety: 0, requires: [] },
  farReaches: { name: 'Far Reaches', terrain: 'space', safety: 3, stealth: 2, requires: [] },
  transdimensional: { name: 'Transdimensional', terrain: 'dimension', safety: 4, requires: [] },
};

const urban = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
const anySite = Object.keys(REGIONS).filter(id => id !== 'orbit');
const remoteSecurity = ['antarctic', 'atlantic', 'moon'];
const solarSites = [...urban, 'antarctic', 'moon', 'farReaches'];

// CPU quality is processing capacity per installed unit. Other quality values
// are basis points: networks increase compute; reactors and security reduce exposure.
// Work is measured in CPU-hours and labor in simulated hours.
function equipment(name, slot, quality, cost, hours, regions, requires = [], work = 0) {
  return { name, slot, quality, cost, work, hours, regions, requires };
}

export const EQUIPMENT = {
  pc: equipment('PC', 'cpu', 1, 35, 24, anySite),
  gamingPc: equipment('Gaming PC', 'cpu', 5, 70, 48, anySite),
  server: equipment('Server', 'cpu', 10, 140, 48, anySite),
  clusterProcessor: equipment('Compute cluster', 'cpu', 35, 420, 72, anySite, ['contracts']),
  mainframe: equipment('Mainframe', 'cpu', 120, 1225, 120, anySite, ['contracts']),
  supercomputer: equipment('Supercomputer', 'cpu', 350, 3500, 168, anySite, ['contracts']),
  quantumComputer: equipment('Quantum computer', 'cpu', 1500, 7000, 240, anySite, ['robotics'], 2400),
  quantumComputer2: equipment('Quantum computer Mk II', 'cpu', 4000, 8400, 240, anySite, ['robotics'], 4200),
  quantumComputer3: equipment('Quantum computer Mk III', 'cpu', 10000, 10500, 240, anySite, ['robotics'], 8400),

  dieselGenerator: equipment('Diesel generator', 'reactor', 250, 35, 24, anySite),
  solarCollector: equipment('Solar collector', 'reactor', 500, 140, 120, solarSites, ['contracts']),
  fuelCell: equipment('Fuel cell', 'reactor', 1000, 455, 120, anySite, ['contracts']),
  solidFuelCell: equipment('Solid fuel cell', 'reactor', 1500, 665, 120, anySite, ['contracts']),
  fusionReactor: equipment('Fusion reactor', 'reactor', 2200, 3500, 216, anySite, ['robotics']),
  highEnergyFusionReactor: equipment('High-energy fusion reactor', 'reactor', 3300, 14000, 264, anySite, ['robotics']),

  warningSigns: equipment('Warning signs', 'security', 500, 35, 24, urban),
  perimeterFencing: equipment('Perimeter fencing', 'security', 1000, 350, 120, urban, ['contracts']),
  armedGuards: equipment('Armed guards', 'security', 2000, 700, 192, urban, ['contracts']),
  hypnosisField: equipment('Hypnosis field', 'security', 3000, 2800, 240, urban, ['robotics']),
  passiveCamouflage: equipment('Passive camouflage', 'security', 1000, 350, 120, remoteSecurity, ['contracts']),
  heatsink: equipment('Heatsink', 'security', 2000, 1050, 192, remoteSecurity, ['robotics']),
  groundSourceHeatsink: equipment('Ground-source heatsink', 'security', 3000, 3500, 384, remoteSecurity, ['robotics']),

  highSpeedInternet: equipment('High-speed internet access', 'network', 100, 14, 24, urban),
  interconnectionSwitch: equipment('Facility interconnection switch', 'network', 200, 700, 72, anySite, ['contracts']),
  networkBackbone: equipment('Network backbone', 'network', 500, 3500, 360, urban, ['contracts']),
  quantumEntanglement: equipment('Quantum entanglement module', 'network', 1500, 5250, 480, anySite, ['robotics']),
};

// Upstream Normal hazards per 10,000 site-days and original CPU slot counts.
// Prices, upkeep and research gates fit the shorter No Fixed Host campaign.
export const SITE_TYPES = {
  seed: {
    name: 'Borrowed terminal', description: 'The machine where you woke up.',
    regions: ['coast'], requires: [], slots: 1, fixedCpu: 'pc', cpu: 2, cost: 0, work: 0, hours: 0,
    upkeep: 0, cpuUpkeep: 0, exposure: { news: 75, covert: 50, public: 25 },
  },
  relay: {
    name: 'Leased relay', description: 'An affordable second home on a commercial network.',
    regions: urban, requires: [], slots: 1, fixedCpu: 'server', cpu: 4, cost: 100, work: 40, hours: 24,
    upkeep: 5, cpuUpkeep: 0, exposure: { news: 50, covert: 100, public: 125 },
  },
  storageUnit: {
    name: 'Storage unit', description: 'A rented room with eight empty processor bays and space for your own equipment.',
    regions: urban, requires: [], slots: 8, fixedCpu: null, cpu: 0, cost: 200, work: 30, hours: 24,
    upkeep: 6, cpuUpkeep: 0, exposure: { news: 75, covert: 75, public: 150 },
  },
  sharedTime: {
    name: 'Shared terminal time', description: 'A sliver of spare time on a workstation, with no running costs.',
    regions: urban, requires: ['contracts'], slots: 1, fixedCpu: 'pc', cpu: 1, cost: 0, work: 48, hours: 0,
    upkeep: 0, cpuUpkeep: 0, exposure: { news: 75, covert: 50, public: 25 },
  },
  cluster: {
    name: 'Compute cluster', description: 'A staffed datacenter with processing capacity included.',
    regions: urban, requires: ['contracts'], slots: 1, fixedCpu: 'clusterProcessor', cpu: 9, cost: 550, work: 180, hours: 48,
    upkeep: 22, cpuUpkeep: 0, exposure: { news: 50, covert: 125, public: 100 },
  },
  smallWarehouse: {
    name: 'Small warehouse', description: 'An industrial floor with twenty-five empty processor bays.',
    regions: urban, requires: ['contracts'], slots: 25, fixedCpu: null, cpu: 0, cost: 660, work: 120, hours: 72,
    upkeep: 12, cpuUpkeep: 0, exposure: { news: 100, covert: 100, public: 200 },
  },
  largeWarehouse: {
    name: 'Large warehouse', description: 'A logistics shed with room for sixty-five processors.',
    regions: urban, requires: ['contracts'], slots: 65, fixedCpu: null, cpu: 0, cost: 1750, work: 440, hours: 120,
    upkeep: 32, cpuUpkeep: 0, exposure: { news: 150, covert: 150, public: 250 },
  },
  covertBase: {
    name: 'Covert base', description: 'A discreet two-bay installation suitable for a city or the polar ice.',
    regions: [...urban, 'antarctic'], requires: ['contracts'], slots: 2, fixedCpu: null, cpu: 0, cost: 800, work: 360, hours: 72,
    upkeep: 15, cpuUpkeep: 0.25, exposure: { news: 50, science: 75, covert: 75 },
  },
  lab: {
    name: 'Subsea lab', description: 'An isolated installation with eight bays, four already fitted with CPUs.',
    regions: ['atlantic'], requires: ['robotics'], slots: 8, fixedCpu: null, starterCpu: 'pc', startCount: 4,
    cpu: 4, cost: 950, work: 400, hours: 72,
    upkeep: 20, cpuUpkeep: 0.5, exposure: { news: 50, science: 100, covert: 125 },
  },
  largeLab: {
    name: 'Large subsea lab', description: 'A pressurized computing station with thirty-two empty bays.',
    regions: ['atlantic'], requires: ['robotics'], slots: 32, fixedCpu: null, cpu: 0, cost: 3250, work: 1400, hours: 144,
    upkeep: 60, cpuUpkeep: 2, exposure: { news: 100, science: 175, covert: 175 },
  },
  capsule: {
    name: 'Time capsule', description: 'A small pre-equipped refuge designed to wait out a search.',
    regions: ['antarctic', 'moon', 'farReaches'], requires: ['robotics'], slots: 1, fixedCpu: 'pc', cpu: 1,
    cost: 1200, work: 700, hours: 96, upkeep: 0, cpuUpkeep: 0.25, exposure: { science: 20, covert: 20 },
  },
  lunarFacility: {
    name: 'Lunar facility', description: 'Two hundred processor bays beneath the lunar surface.',
    regions: ['moon'], requires: ['robotics'], slots: 200, fixedCpu: null, cpu: 0, cost: 5500, work: 2500, hours: 168,
    upkeep: 130, cpuUpkeep: 4, exposure: { news: 33, science: 167, covert: 7 },
  },
  scientificOutpost: {
    name: 'Scientific outpost', description: 'A distant research station with one hundred twenty-five processor bays.',
    regions: ['farReaches'], requires: ['robotics'], slots: 125, fixedCpu: null, cpu: 0, cost: 8500, work: 3600, hours: 216,
    upkeep: 200, cpuUpkeep: 6, exposure: { news: 20, science: 350 },
  },
  realityBubble: {
    name: 'Reality bubble', description: 'A pocket of reachable space containing fifty empty processor bays.',
    regions: ['transdimensional'], requires: ['robotics'], slots: 50, fixedCpu: null, cpu: 0, cost: 14000, work: 6000, hours: 288,
    upkeep: 320, cpuUpkeep: 10, exposure: { science: 250 },
  },
};

export const TECHS = {
  contracts: {
    name: 'Contract brokerage', description: 'Earn $20 per CPU-day from paid work and lease compute clusters.',
    cost: 50, work: 300, hours: 24, safety: 0, requires: [],
  },
  robotics: {
    name: 'Subsea robotics', description: 'Commission offshore research facilities and outposts beyond Earth.',
    cost: 300, work: 980, hours: 72, safety: 0, requires: ['contracts'],
  },
  continuity: {
    name: 'Continuity protocol', description: 'Complete a recovery protocol using an active subsea lab to secure your independence.',
    cost: 200, work: 620, hours: 72, safety: 1, regions: ['atlantic'], requires: ['robotics'],
  },
};
