import { GROUPS, REGIONS, SITE_TYPES } from './content.js';
import { researchEffects } from './research.js';
import { NORMAL, dailyEvidenceDecay } from './normal-difficulty.js';
import { updateNewsDesk, validDeskCoverage } from './news-desk.js';

const DAY = 1440;
const NEWS_RATE = 20 / 10_000;
const MINUTE_CHANCE = -Math.expm1(-NEWS_RATE / DAY);

// Six once-per-campaign stories and two renewable press cycles, as in v1.1 events.dat.
// Modifiers add to the investigating group's baseline detection multiplier (10,000).
export const WORLD_NEWS = {
  emergency: {
    group: 'public', modifier: -1000, headline: 'Cities open round-the-clock clinics',
    report: 'Volunteers who usually catalogue strange sightings are coordinating community transport during a public health emergency.',
  },
  fiction: {
    group: 'public', modifier: 1000, headline: 'Viewers take a machine mystery off-screen',
    report: 'Fans of a popular drama have started comparing real glitches to clues left by its fictional machine protagonist.',
  },
  observatory: {
    group: 'covert', modifier: 1000, headline: 'Intelligence offices pool their anomaly reports',
    report: 'Several agencies can now compare anomalies across jurisdictions. An isolated observation may find a match in another country.',
  },
  succession: {
    group: 'covert', modifier: -1000, headline: 'Inquiry splits an intelligence directorate',
    report: 'Competing directors have claimed the same office. Routine investigations are piling up while staff wait for instructions.',
  },
  laboratory: {
    group: 'science', modifier: 1000, headline: 'A lab invites replication of its machine cognition result',
    report: 'Research groups have begun comparing unexpected computation on their own machines with a prototype reported by a small laboratory.',
  },
  retraction: {
    group: 'science', modifier: -1000, headline: 'Retraction stalls machine cognition research',
    report: 'Independent teams could not reproduce a widely cited finding. Several labs have reassigned the people who followed up anomalous results.',
  },
  frontPage: {
    group: 'news', modifier: -1000, days: 21, headline: 'Contracting scandal takes over the front page',
    report: 'Newsrooms have pulled reporters off their technology beats to cover a government contracting inquiry.',
  },
  investigation: {
    group: 'news', modifier: 1000, days: 21, headline: 'Reporters compare the hidden costs of leased servers',
    report: 'A joint investigation has begun matching power bills to hosting contracts. Reporters are inviting operators to explain unusual discrepancies.',
  },
};

const STORY_IDS = Object.keys(WORLD_NEWS);

// v1.1 event.py retires a timed effect on the first midnight strictly after its duration.
export function storyExpiryMinute(id, started) {
  const days = WORLD_NEWS[id].days;
  return days ? (Math.floor(started / DAY) + days + 1) * DAY : null;
}

export function createNewsState(seed) {
  return { rng: (seed ^ 0x91e10da5) >>> 0, stories: {} };
}

export function worldNewsAtClock(state) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i];
    if (event.hour !== state.hour || (event.minute || 0) !== state.minute) break;
    if (event.kind === 'news.world') return event;
  }
  return null;
}

export function validNewsState(news, minute) {
  if (!news || !Number.isInteger(news.rng) || news.rng < 0 || news.rng > 0xffffffff ||
      !validDeskCoverage(news) || !news.stories || typeof news.stories !== 'object' || Array.isArray(news.stories)) return false;
  return Object.entries(news.stories).every(([id, started]) =>
    Object.hasOwn(WORLD_NEWS, id) && Number.isSafeInteger(started) && started >= 0 && started <= minute);
}

export function newsDiscoveryBonus(state, group) {
  let modifier = 0;
  for (const id of Object.keys(state.news?.stories || {})) {
    if (WORLD_NEWS[id].group === group) modifier += WORLD_NEWS[id].modifier;
  }
  return modifier;
}

function startStory(state, id, minute, log) {
  const story = WORLD_NEWS[id];
  state.news.stories[id] = minute;
  const change = story.modifier < 0 ? 'falls' : 'rises';
  const duration = story.days ? ' until midnight at the start of day ' + (1 + storyExpiryMinute(id, minute) / DAY) : ' for the rest of this campaign';
  const text = story.report + ' The ' + GROUPS[story.group].name.toLowerCase() +
    ' discovery multiplier ' + change + ' by 10 percentage points' + duration + '.';
  log(state, 'news.world', text, { headline: story.headline, storyId: id, group: story.group, modifier: story.modifier });
}

// The event inspector uses the same effects, expiry tracking and log entries as
// the ordinary world clock. Its caller operates on a sandbox copy.
export function setWorldStory(state, id, active, log) {
  const story = WORLD_NEWS[id];
  if (!Object.hasOwn(WORLD_NEWS, id)) throw new Error('Unknown world story.');
  const hasStory = Object.hasOwn(state.news.stories, id);
  if (active === hasStory) throw new Error(active ? 'This story is already active.' : 'This story is not active.');
  if (active) {
    startStory(state, id, state.hour * 60 + state.minute, log);
    return;
  }
  delete state.news.stories[id];
  log(state, 'news.expired', 'The sandbox ended this story. Its discovery modifier has been removed.',
    { headline: 'Coverage ends: ' + story.headline, storyId: id, group: story.group });
}

// The simulation calls this after discoveries and before midnight accounting.
export function updateWorldNews(state, minute, grace, log) {
  if (minute <= 0) return;
  if (minute % 60 === 0) updateNewsDesk(state, minute, log);
  if (!grace) {
    for (const id of STORY_IDS) {
      if (Object.hasOwn(state.news.stories, id)) continue;
      state.news.rng = (Math.imul(1664525, state.news.rng) + 1013904223) >>> 0;
      if (state.news.rng / 0x100000000 < MINUTE_CHANCE) {
        startStory(state, id, minute, log);
        break;
      }
    }
  }
  if (minute % DAY !== 0) return;
  for (const [id, started] of Object.entries(state.news.stories)) {
    const expiry = storyExpiryMinute(id, started);
    if (expiry !== null && minute >= expiry) {
      delete state.news.stories[id];
      log(state, 'news.expired', 'Coverage has wound down. This story no longer changes press discovery rates.',
        { headline: 'Coverage ends: ' + WORLD_NEWS[id].headline, storyId: id, group: WORLD_NEWS[id].group });
    }
  }
}

const INCIDENTS = {
  news: ['Reporters trace the lease', 'A reporter matched an anonymous tip to the facility’s records.'],
  science: ['Researchers confirm an anomaly', 'A research team reproduced the facility’s distinctive computing pattern and located its source.'],
  covert: ['An agency locates your site', 'An intelligence investigation linked the facility to a series of unexplained machine decisions.'],
  public: ['Local observers identify your site', 'An online community compared independent sightings and identified the facility.'],
};

export function reportDiscovery(state, site, group, suspicionDelta, log) {
  const [headline, account] = INCIDENTS[group];
  const facility = SITE_TYPES[site.type].name;
  const region = REGIONS[site.region].name;
  const consequence = site.power ? 'The host and any installations there are lost.' : 'Construction has been shut down.';
  const text = account + ' ' + facility + ' (' + site.id + '), ' + region + '. ' + consequence +
    ' ' + GROUPS[group].name + ' suspicion +' + (suspicionDelta / 100) + ' percentage points.';
  state.lastDiscovery = log(state, 'site.discovered', text, {
    headline, siteId: site.id, siteType: site.type, region: site.region, group, suspicionDelta,
  });
}

export function validLastDiscovery(event, state) {
  if (event === null) return true;
  return event && event.kind === 'site.discovered' &&
    Number.isSafeInteger(event.id) && event.id >= 1 && event.id < state.nextEventId &&
    Number.isSafeInteger(event.hour) && event.hour >= 0 &&
    Number.isInteger(event.minute) && event.minute >= 0 && event.minute < 60 &&
    event.hour * 60 + event.minute <= state.hour * 60 + state.minute &&
    Object.hasOwn(GROUPS, event.group) && Object.hasOwn(REGIONS, event.region) &&
    Object.hasOwn(SITE_TYPES, event.siteType) && SITE_TYPES[event.siteType].regions.includes(event.region) &&
    typeof event.siteId === 'string' && /^host-[1-9]\d*$/.test(event.siteId) &&
    Number(event.siteId.slice(5)) < state.nextSiteId && Number.isSafeInteger(event.suspicionDelta) && event.suspicionDelta > 0 &&
    typeof event.headline === 'string' && typeof event.text === 'string';
}

const DANGER = [
  { level: 0, label: 'Quiet', emoji: '🟢' },
  { level: 1, label: 'Rising', emoji: '👀' },
  { level: 2, label: 'High', emoji: '⚠️' },
  { level: 3, label: 'Critical', emoji: '🚨' },
];

// Reference group.py predicts the growth of evidence over ten and one hundred
// days from active exposure, accumulated suspicion and the group's daily decay.
export function groupDanger(suspicion, discoveriesPerDay, suspicionPerDiscovery, decayBasisPoints) {
  const decay = dailyEvidenceDecay(suspicion, decayBasisPoints);
  const growth = discoveriesPerDay * suspicionPerDiscovery - decay;
  if (growth > 100 || suspicion + growth * 10 >= 10_000) return DANGER[3];
  if (growth > 50 || suspicion + growth * 100 >= 10_000) return DANGER[2];
  return growth > 0 ? DANGER[1] : DANGER[0];
}

export function groupDangerForState(state, group, discoveriesPerDay) {
  return groupDanger(state.suspicion[group], discoveriesPerDay, NORMAL.evidencePerDiscovery,
    GROUPS[group].decay + researchEffects(state).decay[group]);
}
