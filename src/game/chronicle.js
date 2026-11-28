import { EQUIPMENT, SITE_TYPES } from './content.js';
import { overview, previewWork, researchAllocation, researchProjects, siteHardware } from './engine.js';
import { taskReservations } from './research-tasks.js';

// A report belongs to one filter. The full original record stays in the save.
export const JOURNAL_CATEGORIES = {
  campaign: 'Campaign', discoveries: 'Discoveries', research: 'Research',
  facilities: 'Facilities', maintenance: 'Maintenance losses', equipment: 'Equipment', news: 'News', sandbox: 'Sandbox',
};

export function eventCategory(event) {
  if (event.kind === 'site.discovered') return 'discoveries';
  if (event.kind === 'site.failed') return 'maintenance';
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
  unassigned: { title: 'Some CPU has no assigned task', text: 'Assign cycles to Jobs, a research topic or the CPU pool. Unassigned cycles still help with construction and upkeep, then earn income.', tab: 'research' },
  spareCpu: { title: 'A research assignment has idle CPU', text: 'Check the project’s funds, remaining work and eligible hosts. Unused research CPU returns to the pool.', tab: 'research' },
  lastHost: { title: 'Only one viable host', text: 'This machine holds the last surviving copy. Finish another host with processors before risking it.', tab: 'facilities' },
  stalledBuild: { title: 'Facility or equipment order paused', tab: 'facilities' },
  maintenance: { title: 'CPU upkeep is underfunded', text: 'The pool cannot cover CPU upkeep. A facility may fail. Reduce allocations or wake another equipped host.', tab: 'reports' },
};

export function currentWarnings(state, prefs = {}) {
  if (state.status !== 'running') return [];
  const economy = overview(state);
  const work = previewWork(state, economy);
  const reservations = taskReservations(state, economy);
  const researchCpu = researchAllocation(state, economy).budget;
  const poolCpu = Math.round(100 * (economy.activeCpu - reservations.jobs - researchCpu)) / 100;
  const committed = reservations.jobs + reservations.pool + researchCpu;
  const assigned = state.researchTarget ?? researchProjects(state).reduce((sum, project) => sum + project.cpu, 0);
  const waiting = [...work.orders].filter(([, status]) => status.stalled);
  const needsPool = poolCpu === 0 && [...work.orders.values()].some(status => status.workRemaining > 0);
  const finishing = order => work.orders.get(order)?.completesNextMinute;
  const viableNextMinute = state.sites.filter(site => siteHardware(state, site).rawCpu > 0 ||
    site.installations?.some(order => EQUIPMENT[order.itemId].slot === 'cpu' && finishing(order))).length +
    state.builds.filter(build => SITE_TYPES[build.type].fixedCpu && finishing(build)).length;
  const flags = {
    unassigned: Math.round(committed * 100) < economy.activeCpu * 99,
    spareCpu: Math.round(100 * (assigned - work.researchCpu)) > 0,
    lastHost: !state.freePlay && viableNextMinute === 1,
    stalledBuild: waiting.length > 0 || needsPool,
    maintenance: !state.freePlay && (work.maintenanceShort > 0 || poolCpu < economy.cpuUpkeep),
  };
  return Object.entries(warnings)
    .filter(([id]) => flags[id] && prefs[id] !== false)
    .map(([id, warning]) => {
      if (id === 'maintenance' && !work.maintenanceShort) {
        return { id, ...warning, text: 'Upkeep depends on CPU returned by other assignments. Reserve more CPU in the pool to cover the full maintenance bill.' };
      }
      if (id !== 'stalledBuild') return { id, ...warning };
      if (!waiting.length) return { id, ...warning, title: 'Construction has no CPU allocation',
        text: 'An order needs compute. It can advance only while other tasks return unused CPU to the pool.' };
      const [order, status] = waiting[0];
      const name = order.itemId ? EQUIPMENT[order.itemId].name : order.name || SITE_TYPES[order.type].name;
      const extra = waiting.length > 1 ? ' Other paused orders: ' + (waiting.length - 1) + '.' : '';
      return { id, ...warning, text: name + ' — ' + status.reason + '.' + extra,
        orderName: name, customName: !order.itemId && Boolean(order.name), reason: status.reason, otherOrders: waiting.length - 1 };
    });
}
