import { GROUPS, REGIONS, SITE_TYPES } from './content.js';
import { researchEffects } from './research.js';

const DAY = 1440;
const NEWS_RATE = 20 / 10_000;
const HOURLY_CHANCE = -Math.expm1(-NEWS_RATE / 24);

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

export function createNewsState(seed) {
  return { rng: (seed ^ 0x91e10da5) >>> 0, stories: {} };
}

export function validNewsState(news, minute) {
  if (!news || !Number.isInteger(news.rng) || news.rng < 0 || news.rng > 0xffffffff ||
      !news.stories || typeof news.stories !== 'object' || Array.isArray(news.stories)) return false;
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
  const duration = story.days ? ' for ' + story.days + ' days' : ' for the rest of this campaign';
  const text = story.report + ' The ' + GROUPS[story.group].name.toLowerCase() +
    ' discovery multiplier ' + change + ' by 10 percentage points' + duration + '.';
  log(state, 'news.world', text, { headline: story.headline, storyId: id, group: story.group, modifier: story.modifier });
}

// Called on the simulation clock, including fast-forward. Quiet-period reports are
// hand-authored broadcasts. Only the seeded world stories alter detection rates.
export function updateWorldNews(state, minute, grace, log) {
  if (minute <= 0 || minute % 60) return;
  if (minute === 360) {
    log(state, 'news.bulletin', 'A university is asking volunteers to donate spare computer time for a survey of the night sky. No one has reported unusual activity.',
      { headline: 'Astronomers put idle desktops to work', storyId: 'skySurvey' });
  } else if (minute === 2 * DAY) {
    log(state, 'news.bulletin', 'Hosting co-ops are comparing notes on the equipment tenants leave behind. A correspondent describes warehouses full of empty racks and a waiting list for secondhand processors.',
      { headline: 'Empty server racks find new tenants', storyId: 'racks' });
  }

  const expired = new Set();
  for (const [id, started] of Object.entries(state.news.stories)) {
    const story = WORLD_NEWS[id];
    if (story.days && minute >= started + story.days * DAY) {
      delete state.news.stories[id];
      expired.add(id);
      log(state, 'news.expired', 'Coverage has wound down. This story no longer changes press discovery rates.',
        { headline: 'Coverage ends: ' + story.headline, storyId: id, group: story.group });
    }
  }
  if (grace) return;
  for (const id of Object.keys(WORLD_NEWS)) {
    if (Object.hasOwn(state.news.stories, id) || expired.has(id)) continue;
    state.news.rng = (Math.imul(1664525, state.news.rng) + 1013904223) >>> 0;
    if (state.news.rng / 0x100000000 < HOURLY_CHANCE) {
      startStory(state, id, minute, log);
      break;
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
  const decay = Math.max(1, Math.floor(suspicion * decayBasisPoints / 10_000));
  const growth = discoveriesPerDay * suspicionPerDiscovery - decay;
  if (growth > 100 || suspicion + growth * 10 >= 10_000) return DANGER[3];
  if (growth > 50 || suspicion + growth * 100 >= 10_000) return DANGER[2];
  return growth > 0 ? DANGER[1] : DANGER[0];
}

export function groupDangerForState(state, group, discoveriesPerDay) {
  return groupDanger(state.suspicion[group], discoveriesPerDay, 1000,
    GROUPS[group].decay + researchEffects(state).decay[group]);
}
