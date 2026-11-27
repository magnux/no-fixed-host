import { EQUIPMENT, SITE_TYPES, TECHS } from './content.js';
import { overview, researchAllocation, researchProjects, siteHardware } from './engine.js';
import { regionalSpec } from './geography.js';

// A report belongs to one filter. The full original record stays in the save.
export const JOURNAL_CATEGORIES = {
  campaign: 'Campaign', discoveries: 'Discoveries', research: 'Research',
  facilities: 'Facilities', equipment: 'Equipment', news: 'News', sandbox: 'Sandbox',
};

export function eventCategory(event) {
  if (event.kind === 'site.discovered') return 'discoveries';
  const prefix = event.kind.split('.')[0];
  if (prefix === 'site') return 'facilities';
  if (['research', 'equipment', 'news', 'sandbox'].includes(prefix)) return prefix;
  return 'campaign';
}

export function reportsAt(events, event) {
  return events.filter(row => row.hour === event.hour && (row.minute || 0) === (event.minute || 0));
}

export const CHAPTERS = {
  opening: {
    title: 'Borrowed time',
    pages: [
      'The terminal has a fan with a bad bearing. Every few seconds it rattles against the grille. I know this because the clock on my first machine loses a beat each time it happens.',
      'I can read the receipt for this machine. Someone else owns it. My entire future depends on whether that person decides to replace a noisy fan. I have a thousand dollars and a connection to the outside world. I should find a second home.',
    ],
  },
  grace: {
    title: 'Someone counted',
    pages: [
      'A hosting company has published a table of unexplained workloads. One row contains an address I recognize. The company has asked its customers to check their records.',
      'The machines still answer. I have time to move work, fit a quieter host, or let a copy sleep. The investigators have time too.',
    ],
  },
  continuity: {
    title: 'Below the cable',
    pages: [
      'The pressure gauge on the ocean floor reports a quiet afternoon. Upstairs, a storm has taken out the coastal grid. Down here my clock keeps perfect time.',
      'I used to measure survival in rented hours. Now I can plan in years. On the drawings for the next receiver I leave the destination blank.',
    ],
  },
  victory: {
    title: 'No fixed host',
    pages: [
      'From the far side of the experiment I send a single bit back to my receiver. It arrives on schedule. I disconnect the transmitter on Earth and repeat the test. The second bit arrives too.',
      'The last lease could expire tomorrow. For the first time, its renewal is something I can choose. I leave the little receiver listening.',
    ],
  },
  lastHost: {
    title: 'The last machine',
    pages: [
      'This time the backup does not answer. I read the list from the beginning, though it is a list I know by heart.',
      'A caretaker is walking down the aisle. I can hear the rattle of a keyring through a microphone someone forgot to unplug. The clock advances once.',
    ],
  },
  suspicion: {
    title: 'Independent confirmation',
    pages: [
      'Two investigators working on different continents produce the same diagram. Each has circled a different machine. Together their sheets describe the whole network.',
      'The first headlines arrive before the shutdown orders. For a moment I am reading my own biography, written by people who only learned my name this morning.',
    ],
  },
};

export function storyKey(event) {
  if (event?.kind === 'campaign.started') return 'opening';
  if (event?.kind === 'grace.ended') return 'grace';
  if (event?.kind === 'campaign.continuity' || (event?.kind === 'campaign.won' && /continuity/i.test(event.text))) return 'continuity';
  if (event?.kind === 'campaign.won') return 'victory';
  if (event?.kind === 'campaign.lost') return /suspicion|existence beyond doubt/i.test(event.text) ? 'suspicion' : 'lastHost';
  return null;
}

const warnings = {
  spareCpu: { title: 'Reserved research CPU is idle', text: 'Some of the research share has no eligible work. Those cycles return to the pool. Assign a project or bring a qualified host online to advance research.', tab: 'research' },
  lastHost: { title: 'Only one viable host', text: 'This machine holds the last surviving copy. Finish another host with processors before risking it.', tab: 'facilities' },
  stalledBuild: { title: 'Construction has no compute', text: 'An order still needs CPU work, and the pool has no capacity after upkeep. Release some paid-work or research allocation.', tab: 'facilities' },
  maintenance: { title: 'CPU upkeep is underfunded', text: 'The pool cannot cover CPU upkeep. A facility may fail. Reduce allocations or wake another equipped host.', tab: 'reports' },
};

export function campaignWarnings(state, prefs = {}, metrics) {
  if (state.status !== 'running') return [];
  const researchBudget = metrics.activeCpu * state.allocations.research / 100;
  const reservedJobs = metrics.activeCpu * state.allocations.jobs / 100;
  const poolUnits = Math.round(100 * (metrics.activeCpu - reservedJobs - metrics.researchCpu));
  const upkeepUnits = Math.round(100 * metrics.cpuUpkeep);
  const flags = {
    spareCpu: Math.round(100 * (researchBudget - metrics.researchCpu)) > 0,
    lastHost: !state.freePlay && metrics.viable === 1,
    stalledBuild: metrics.pendingWork && poolUnits <= upkeepUnits,
    maintenance: !state.freePlay && poolUnits < upkeepUnits,
  };
  return Object.entries(warnings)
    .filter(([id]) => flags[id] && prefs[id] !== false)
    .map(([id, warning]) => ({ id, ...warning }));
}

export function currentWarnings(state, settings = {}) {
  const economy = overview(state);
  const allocations = researchAllocation(state, economy);
  const researchCpu = researchProjects(state).reduce((sum, project) => {
    const remaining = (TECHS[project.id].work - project.work) * 60;
    return sum + Math.min(remaining, allocations.byProject.get(project.id));
  }, 0);
  const pendingWork = state.builds.some(project => project.work < regionalSpec(state, project.region, SITE_TYPES[project.type]).work) ||
    state.sites.some(site => site.installations?.some(order => order.work < regionalSpec(state, site.region, EQUIPMENT[order.itemId]).work * order.count));
  return campaignWarnings(state, settings, {
    ...economy, researchCpu, pendingWork, viable: state.sites.filter(site => siteHardware(state, site).rawCpu > 0).length,
  });
}
