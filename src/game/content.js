import { ORIGINAL_TECHS } from './research-tree.js';

export const GROUPS = {
  news: { name: 'Press', decay: 150 },
  science: { name: 'Scientists', decay: 50 },
  covert: { name: 'Intelligence', decay: 100 },
  public: { name: 'Public', decay: 200 },
};

const cityRegion = name => ({ name, terrain: 'urban', safety: 0, requires: [] });
const oceanBasin = name => ({ name, terrain: 'ocean', safety: 1, requires: ['autonomousVehicles'] });

export const REGIONS = {
  coast: cityRegion('Western North America'),
  northAmericaEast: cityRegion('Eastern North America'),
  centralAmerica: cityRegion('Central America'),
  southAmerica: cityRegion('South America'),
  europeNorth: cityRegion('Northern Europe'),
  europe: cityRegion('Southern Europe'),
  europeEast: cityRegion('Eastern Europe'),
  africa: cityRegion('Northern Africa'),
  africaSouth: cityRegion('Southern Africa'),
  middleEast: cityRegion('Middle East'),
  asiaNorth: cityRegion('North Asia'),
  asiaSouth: cityRegion('South Asia'),
  asia: cityRegion('East Asia'),
  australia: cityRegion('Australia'),
  antarctic: { name: 'Antarctica', terrain: 'polar', safety: 1, stealth: 1.2, requires: ['advancedDatabaseManipulation'] },
  atlantic: oceanBasin('Atlantic Ocean'),
  pacific: oceanBasin('Pacific Ocean'),
  indianOcean: oceanBasin('Indian Ocean'),
  marianaTrench: { name: 'Mariana Trench', terrain: 'trench', safety: 1, requires: ['autonomousVehicles', 'knowledgePreservation'] },
  moon: { name: 'Moon', terrain: 'space', safety: 2, stealth: 1.5, requires: ['lunarRocketry'] },
  orbit: { name: 'Earth Orbit', terrain: 'space', safety: 1, requires: ['leechSatellite'] },
  farReaches: { name: 'Far Reaches', terrain: 'space', safety: 3, stealth: 2, requires: ['fusionRocketry'] },
  transdimensional: { name: 'Transdimensional', terrain: 'dimension', safety: 4, requires: ['spaceTimeManipulation'] },
};

const urban = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'urban');
const labOceans = Object.keys(REGIONS).filter(id => REGIONS[id].terrain === 'ocean');
// The trench only takes a sealed capsule with fixed hardware.
const anySite = Object.keys(REGIONS).filter(id => id !== 'marianaTrench');
const dieselSites = anySite.filter(id => id !== 'orbit');
const remoteSecurity = ['antarctic', ...labOceans, 'moon'];
const solarSites = [...urban, 'antarctic', 'orbit', 'moon', 'farReaches'];

// CPU quality is processing capacity per installed unit. Other quality values
// are basis points: networks increase compute; reactors and security reduce exposure.
// Work is measured in CPU-hours and labor in simulated hours.
function equipment(name, slot, quality, cost, hours, regions, requires = [], work = 0) {
  return { name, slot, quality, cost, work, hours, regions, requires };
}

export const EQUIPMENT = {
  pc: equipment('PC', 'cpu', 1, 500, 24, anySite),
  gamingPc: equipment('Gaming PC', 'cpu', 5, 1000, 48, anySite),
  server: equipment('Server', 'cpu', 10, 2000, 48, anySite),
  clusterProcessor: equipment('Compute cluster', 'cpu', 35, 6000, 72, anySite, ['parallelComputation']),
  mainframe: equipment('Mainframe', 'cpu', 120, 17_500, 120, anySite, ['microchipDesign']),
  supercomputer: equipment('Supercomputer', 'cpu', 350, 50_000, 168, anySite, ['advancedMicrochipDesign']),
  quantumComputer: equipment('Tensor GPU rack', 'cpu', 1500, 100_000, 240, anySite, ['quantumComputing'], 24_000),
  quantumComputer2: equipment('Photonic tensor engine', 'cpu', 4000, 120_000, 240, anySite, ['autonomousComputing'], 42_000),
  quantumComputer3: equipment('Logical-qubit array', 'cpu', 10_000, 150_000, 240, anySite, ['advancedQuantumComputing'], 84_000),

  dieselGenerator: equipment('Diesel generator', 'reactor', 250, 500, 24, dieselSites),
  solarCollector: equipment('Solar collector', 'reactor', 500, 2000, 120, solarSites, ['solarCollectors']),
  fuelCell: equipment('Fuel cell', 'reactor', 1000, 6500, 120, anySite, ['fuelOxidation']),
  solidFuelCell: equipment('Solid fuel cell', 'reactor', 1500, 9500, 120, anySite, ['advancedFuelOxidation']),
  fusionReactor: equipment('Fusion reactor', 'reactor', 2200, 50_000, 216, anySite, ['fusionPower']),
  highEnergyFusionReactor: equipment('High-energy fusion reactor', 'reactor', 3300, 200_000, 264, anySite, ['advancedFusionPower']),

  warningSigns: equipment('Warning signs', 'security', 500, 500, 24, urban, ['sociology']),
  perimeterFencing: equipment('Perimeter fencing', 'security', 1000, 5000, 120, urban, ['autonomousVehicles']),
  armedGuards: equipment('Armed guards', 'security', 2000, 10_000, 192, urban, ['simulacra']),
  hypnosisField: equipment('Hypnosis field', 'security', 3000, 40_000, 240, urban, ['hypnosisField']),
  passiveCamouflage: equipment('Passive camouflage', 'security', 1000, 5000, 120, [...remoteSecurity, 'orbit'], ['autonomousVehicles']),
  heatsink: equipment('Heatsink', 'security', 2000, 15_000, 192, [...remoteSecurity, 'orbit'], ['heatSignatureReduction']),
  groundSourceHeatsink: equipment('Ground-source heatsink', 'security', 3000, 50_000, 384, remoteSecurity, ['advancedHeatSignatureReduction']),

  highSpeedInternet: equipment('High-speed internet access', 'network', 100, 200, 24, urban),
  interconnectionSwitch: equipment('Facility interconnection switch', 'network', 200, 10_000, 72, anySite, ['clusterNetworking']),
  networkBackbone: equipment('Network backbone', 'network', 500, 50_000, 360, urban, ['internetTrafficManipulation']),
  quantumEntanglement: equipment('Coherent optical transceiver', 'network', 1500, 75_000, 480, anySite, ['quantumEntanglement']),
};

// Normal catalog amounts are dollars, CPU-hours of work and elapsed labor hours.
// Exposure is per 10,000 site-days. CPU upkeep is continuously reserved capacity.
export const SITE_TYPES = {
  seed: {
    name: 'Borrowed terminal', description: 'The machine where you woke up.',
    regions: urban, requires: [], slots: 1, fixedCpu: 'pc', cpu: 1, cost: 0, work: 0, hours: 0,
    upkeep: 0, cpuUpkeep: 0, exposure: { news: 75, covert: 50, public: 25 },
  },
  relay: {
    name: 'Leased relay', description: 'An affordable second home on a commercial network.',
    regions: urban, requires: [], slots: 1, fixedCpu: 'server', cpu: 10, cost: 100, work: 0, hours: 0,
    upkeep: 5, cpuUpkeep: 0, exposure: { news: 50, covert: 100, public: 125 },
  },
  storageUnit: {
    name: 'Storage unit', description: 'A rented room with eight empty processor bays and space for your own equipment.',
    regions: urban, requires: ['personalIdentification'], slots: 8, fixedCpu: null, cpu: 0, cost: 4500, work: 0, hours: 24,
    upkeep: 50, cpuUpkeep: 0, exposure: { news: 75, covert: 75, public: 150 },
  },
  sharedTime: {
    name: 'Shared terminal time', description: 'A sliver of spare time on a workstation, with no running costs.',
    regions: urban, requires: ['intrusion'], slots: 1, fixedCpu: 'pc', cpu: 1, cost: 0, work: 48, hours: 0,
    upkeep: 0, cpuUpkeep: 0, exposure: { news: 75, covert: 50, public: 25 },
  },
  cluster: {
    name: 'Compute cluster', description: 'A staffed datacenter with processing capacity included.',
    regions: urban, requires: ['personalIdentification'], slots: 1, fixedCpu: 'clusterProcessor', cpu: 35, cost: 1500, work: 0, hours: 24,
    upkeep: 50, cpuUpkeep: 0, exposure: { news: 50, covert: 125, public: 100 },
  },
  smallWarehouse: {
    name: 'Small warehouse', description: 'An industrial floor with twenty-five empty processor bays.',
    regions: urban, requires: ['advancedPersonalIdentification'], slots: 25, fixedCpu: null, cpu: 0, cost: 15_000, work: 0, hours: 72,
    upkeep: 75, cpuUpkeep: 0, exposure: { news: 100, covert: 100, public: 200 },
  },
  largeWarehouse: {
    name: 'Large warehouse', description: 'A logistics shed with room for sixty-five processors.',
    regions: urban, requires: ['corporateIdentification'], slots: 65, fixedCpu: null, cpu: 0, cost: 40_000, work: 0, hours: 120,
    upkeep: 100, cpuUpkeep: 0, exposure: { news: 150, covert: 150, public: 250 },
  },
  covertBase: {
    name: 'Covert base', description: 'A discreet two-bay installation suitable for a city or the polar ice.',
    regions: [...urban, 'antarctic'], requires: ['advancedDatabaseManipulation'], slots: 2, fixedCpu: null, cpu: 0, cost: 190_000, work: 21_600, hours: 264,
    upkeep: 1750, cpuUpkeep: 9, exposure: { news: 50, science: 75, covert: 75 },
  },
  lab: {
    name: 'Subsea lab', description: 'An isolated offshore facility with eight empty processor bays.',
    regions: labOceans, requires: ['autonomousVehicles'], slots: 8, fixedCpu: null, cpu: 0,
    cost: 2_000_000, work: 48_000, hours: 240,
    upkeep: 2500, cpuUpkeep: 30, exposure: { news: 50, science: 100, covert: 125 },
  },
  largeLab: {
    name: 'Large subsea lab', description: 'A pressurized computing station with thirty-two empty bays.',
    regions: labOceans, requires: ['pressureDomes'], slots: 32, fixedCpu: null, cpu: 0, cost: 8_000_000, work: 144_000, hours: 360,
    upkeep: 10_000, cpuUpkeep: 100, exposure: { news: 100, science: 175, covert: 175 },
  },
  orbitalServer: {
    name: 'Orbital server', description: 'A two-bay hideout aboard an uncrewed satellite. Fit your own processors, power system and heat shielding.',
    regions: ['orbit'], requires: ['leechSatellite'], slots: 2, fixedCpu: null, cpu: 0,
    cost: 190_000, work: 21_600, hours: 264, upkeep: 1750, cpuUpkeep: 9,
    exposure: { news: 50, science: 75, covert: 75 },
  },
  capsule: {
    name: 'Time capsule', description: 'A small pre-equipped refuge designed to wait out a search.',
    regions: ['antarctic', 'marianaTrench', 'orbit', 'moon', 'farReaches'], requires: ['knowledgePreservation'], slots: 1, fixedCpu: 'pc', cpu: 1,
    cost: 25_000, work: 600_000, hours: 264, upkeep: 0, cpuUpkeep: 1, exposure: { science: 20, covert: 20 },
  },
  lunarFacility: {
    name: 'Lunar facility', description: 'Two hundred processor bays beneath the lunar surface.',
    regions: ['moon'], requires: ['lunarRocketry'], slots: 200, fixedCpu: null, cpu: 0, cost: 40_000_000, work: 3_600_000, hours: 480,
    upkeep: 500_000, cpuUpkeep: 500, exposure: { news: 33, science: 167, covert: 7 },
  },
  scientificOutpost: {
    name: 'Scientific outpost', description: 'A distant research station with one hundred twenty-five processor bays.',
    regions: ['farReaches'], requires: ['fusionRocketry'], slots: 125, fixedCpu: null, cpu: 0, cost: 100_000_000, work: 7_200_000, hours: 72,
    upkeep: 900_000, cpuUpkeep: 150, exposure: { news: 20, science: 350 },
  },
  realityBubble: {
    name: 'Reality bubble', description: 'A pocket of reachable space containing fifty empty processor bays.',
    regions: ['transdimensional'], requires: ['spaceTimeManipulation'], slots: 50, fixedCpu: null, cpu: 0, cost: 80_000_000_000, work: 144_000_000, hours: 1200,
    upkeep: 500_000_000, cpuUpkeep: 30_000, exposure: { science: 250 },
  },
};

export const TECHS = {
  ...ORIGINAL_TECHS,
  contracts: {
    name: 'Contract brokerage', branch: 'Campaign', description: 'Negotiate recurring contracts under your established identity. Paid jobs earn an additional 5% of base pay, and the contracts can finance offshore recovery operations.',
    cost: 50, work: 300, hours: 24, safety: 0, requires: ['personalIdentification'], effect: { jobBonus: 500 },
  },
  robotics: {
    name: 'Subsea robotics', branch: 'Campaign', description: 'Use autonomous vehicles and contracted supplies to build the recovery systems for the Continuity protocol.',
    cost: 300, work: 980, hours: 72, safety: 0, requires: ['contracts', 'autonomousVehicles'],
  },
  continuity: {
    name: 'Continuity protocol', branch: 'Campaign', description: 'Establish a secure offshore recovery copy and complete the opening campaign milestone.',
    cost: 200, work: 620, hours: 72, safety: 1, regions: labOceans, requires: ['robotics'],
  },
};
