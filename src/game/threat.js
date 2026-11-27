import { networkDiscoveryReading, suspicionReading } from './awareness.js';
import { GROUPS } from './content.js';
import { campaignMinutes, hasGrace, siteExposure } from './engine.js';
import { groupDangerForState } from './events.js';
import { researchEffects } from './research.js';

const groups = Object.keys(GROUPS);
const levels = ['quiet', 'guarded', 'high', 'critical'];
const incidentMinutes = 24 * 60;

// The dock and the interface share a single evaluation of every site's exposure.
export function networkThreat(state, grace = hasGrace(state)) {
  const effects = researchEffects(state);
  const { insight } = effects;
  const immortal = state.freePlay || state.completed.includes('apotheosis');
  if (grace || immortal) {
    return { level: 'protected', cause: immortal ? 'apotheosis' : 'protection', sourceGroup: null, insight, rows: [] };
  }

  const rates = [...state.sites, ...state.builds].map(site => siteExposure(state, site, effects).rates);
  const rows = groups.map(id => {
    const intensity = rates.reduce((sum, site) => sum + site[id], 0);
    const danger = groupDangerForState(state, id, -Math.expm1(-intensity));
    const suspicion = suspicionReading(state.suspicion[id], insight);
    return { id, danger, suspicion, outlook: networkDiscoveryReading(intensity, insight, danger) };
  });

  let severity = 0;
  let sourceGroup = null;
  let cause = 'quiet';
  for (const { id, danger, suspicion } of rows) {
    // A tie favors evidence already held over a projected discovery.
    if (suspicion.level > severity || (suspicion.level === severity && cause === 'outlook')) {
      severity = suspicion.level;
      sourceGroup = id;
      cause = 'evidence';
    }
    if (danger.level > severity) {
      severity = danger.level;
      sourceGroup = id;
      cause = 'outlook';
    }
  }

  const report = state.lastDiscovery;
  const age = report ? campaignMinutes(state) - campaignMinutes(report) : Infinity;
  if (state.status === 'lost') {
    // Exceeding the evidence threshold publicly names the group in the ending.
    // A last-copy loss can also come from unpaid upkeep in the same minute.
    const investigator = groups.find(id => state.suspicion[id] > 10_000);
    const lostToDiscovery = age === 0 && !state.events.some(event =>
      event.kind === 'site.failed' && event.hour === state.hour && event.minute === state.minute);
    if (investigator || lostToDiscovery) {
      return { level: 'critical', sourceGroup: investigator ?? report.group, cause: 'investigation-loss', insight, rows };
    }
  } else if (report && severity < 3 && (report.id > state.dismissedDiscoveryId || age < incidentMinutes)) {
    return { level: 'high', sourceGroup: report.group, cause: 'discovery', insight, rows };
  }

  return { level: levels[severity], sourceGroup, cause, insight, rows };
}
