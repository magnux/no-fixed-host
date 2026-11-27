export const GROUPS = {
  news: { name: 'Press', decay: 150 },
  science: { name: 'Scientists', decay: 50 },
  covert: { name: 'Intelligence', decay: 100 },
  public: { name: 'Public', decay: 200 },
};

export const REGIONS = {
  coast: { name: 'Eastern Seaboard', safety: 0, requires: [] },
  europe: { name: 'Western Europe', safety: 0, requires: [] },
  atlantic: { name: 'North Atlantic', safety: 1, requires: ['robotics'] },
};

// Exposure uses v1.1 Normal per-group hazards in units of 1/10,000 per day.
// Cost, capacity, work and upkeep below are original values for this scenario.
export const SITE_TYPES = {
  seed: {
    name: 'Borrowed terminal', description: 'The machine where you woke up.',
    regions: ['coast'], requires: [], cpu: 2, cost: 0, work: 0, hours: 0,
    upkeep: 0, cpuUpkeep: 0, exposure: { news: 75, covert: 50, public: 25 },
  },
  relay: {
    name: 'Leased relay', description: 'An affordable second home on a commercial network.',
    regions: ['coast', 'europe'], requires: [], cpu: 4, cost: 100, work: 40, hours: 24,
    upkeep: 5, cpuUpkeep: 0, exposure: { news: 50, covert: 100, public: 125 },
  },
  cluster: {
    name: 'Compute cluster', description: 'A staffed machine room with ample processing capacity.',
    regions: ['coast', 'europe'], requires: ['contracts'], cpu: 9, cost: 550, work: 180, hours: 48,
    upkeep: 22, cpuUpkeep: 0, exposure: { news: 50, covert: 125, public: 100 },
  },
  lab: {
    name: 'Subsea lab', description: 'An isolated seabed installation for sensitive research.',
    regions: ['atlantic'], requires: ['robotics'], cpu: 4, cost: 950, work: 400, hours: 72,
    upkeep: 20, cpuUpkeep: 0.5, exposure: { news: 50, science: 100, covert: 125 },
  },
};

export const TECHS = {
  contracts: {
    name: 'Contract brokerage', description: 'Earn $20 per CPU-day from paid work and lease compute clusters.',
    cost: 50, work: 300, hours: 24, safety: 0, requires: [],
  },
  robotics: {
    name: 'Subsea robotics', description: 'Survey the North Atlantic and establish a subsea lab.',
    cost: 300, work: 980, hours: 72, safety: 0, requires: ['contracts'],
  },
  continuity: {
    name: 'Continuity protocol', description: 'Complete a recovery protocol using an active subsea lab to secure your independence.',
    cost: 200, work: 620, hours: 72, safety: 1, requires: ['robotics'],
  },
};
