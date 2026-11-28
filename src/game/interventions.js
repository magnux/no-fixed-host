import { MINUTES_PER_DAY as DAY, minutesToMidnight } from './calendar.js';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES } from './content.js';
import { installedEquipment } from './equipment.js';
import { geographyRoll, regionalSpec } from './geography.js';
import { hasGrace } from './normal-difficulty.js';
import { spendableDollars, spendTreasury } from './treasury.js';

const CAMPAIGN_COST = 25_000;
const STUDY_COST = 50_000;
const COOLDOWN = 30 * DAY;
const OUTCOMES = { explained: 0.75, inconclusive: 1, corroborated: 1.25 };
const now = state => state.hour * 60 + state.minute;
const schedules = new WeakMap();

export function createInterventions() {
  return { campaign: null, study: null, tip: null, cases: [], campaignAvailableAt: 0, studyAvailableAt: 0, tipAvailableAt: 0 };
}

// Keyed draws keep offers and purchased outcomes independent of site discovery and the newswire.
function draw(state, key) {
  return geographyRoll(state.regionSeed, key) / 0x100000000;
}

// Reconstruct the same schedule after loading, without saving its unreleased headline.
function campaignSchedule(state, campaign) {
  let schedule = schedules.get(campaign);
  if (!schedule) {
    const key = 'campaign/' + campaign.started;
    const exposeAt = draw(state, key + '/story') < 0.20 ?
      campaign.started + 1 + Math.floor(draw(state, key + '/time') * (campaign.endsAt - campaign.started)) : null;
    schedule = { exposeAt, group: draw(state, key + '/group') < 0.5 ? 'news' : 'covert' };
    schedules.set(campaign, schedule);
  }
  return schedule;
}

function purchaseReason(state, availableAt, cost) {
  if (state.status !== 'running' || state.freePlay) return 'Investigations have ended.';
  if (state.interventions.tip) return 'Respond to the open tip first.';
  if (now(state) < availableAt) return 'Cooldown in progress.';
  return spendableDollars(state) < cost ? 'Insufficient funds.' : '';
}

export function publicCampaignQuote(state) {
  const availableAt = state.interventions.campaignAvailableAt;
  const endsAt = now(state) + minutesToMidnight(now(state)) + 6 * DAY;
  const reason = !state.completed.includes('mediaManipulation') ? 'Requires Media Manipulation.' :
    hasGrace(state) ? 'Available after opening protection.' : purchaseReason(state, availableAt, CAMPAIGN_COST);
  return { cost: CAMPAIGN_COST, availableAt, endsAt, reason };
}

export function studyCases(state) {
  return [...state.interventions.cases].reverse();
}

export function scientificStudyQuote(state, caseId) {
  const availableAt = state.interventions.studyAvailableAt;
  const subject = state.interventions.cases.find(entry => entry.id === caseId);
  const reason = !subject ? 'Select a Scientists discovery.' : subject.reviewed ? 'Case already commissioned.' :
    purchaseReason(state, availableAt, STUDY_COST);
  return { cost: STUDY_COST, availableAt, endsAt: now(state) + 7 * DAY, reason };
}

export function recordScientificCase(state, event) {
  if (event.group === 'science') state.interventions.cases.push({
    id: event.id, region: event.region, siteName: event.siteName || SITE_TYPES[event.siteType].name,
    at: now(state), reviewed: false,
  });
}

export function interventionPurchase(state, action, log) {
  const data = state.interventions;
  const started = now(state);
  if (action.type === 'launch-campaign') {
    const { cost, reason, endsAt } = publicCampaignQuote(state);
    if (reason) throw new Error(reason);
    spendTreasury(state, cost);
    data.campaign = { started, endsAt };
    data.campaignAvailableAt = started + COOLDOWN;
    log(state, 'news.campaign', 'A public campaign is running through the next seven midnights. Public evidence decays faster.',
      { headline: 'Public campaign launched', group: 'public', endsAt, cost, cashFlow: -cost, cashCategory: 'campaign' });
  } else if (action.type === 'commission-study') {
    const { cost, reason, endsAt: publishesAt } = scientificStudyQuote(state, action.caseId);
    if (reason) throw new Error(reason);
    const subject = data.cases.find(entry => entry.id === action.caseId);
    spendTreasury(state, cost);
    subject.reviewed = true;
    data.study = { caseId: subject.id, region: subject.region, started, publishesAt, expiresAt: publishesAt + 14 * DAY,
      outcome: null, published: false };
    data.studyAvailableAt = started + COOLDOWN;
    log(state, 'news.study', 'Dr. Mara Vale will independently test the signal attributed to ' + subject.siteName + '. Results are due in seven days.',
      { headline: 'Lab commissions a blind replication', group: 'science', region: subject.region, caseId: subject.id,
        siteName: subject.siteName, publishesAt, cost, cashFlow: -cost, cashCategory: 'study' });
  } else return false;
  return true;
}

export function campaignDecayBonus(state, group) {
  return group === 'public' && state.interventions?.campaign ? 200 : 0;
}

// Discovery at the conclusion of a minute precedes that minute's publication.
// The following complete 14 days of exposure receive the reported effect.
export function scienceHazardFactor(state, group, region) {
  const study = state.interventions?.study;
  return group === 'science' && study?.published && study.region === region ? OUTCOMES[study.outcome] : 1;
}

export function updateInterventions(state, log, forecast) {
  const data = state.interventions;
  const minute = now(state);
  const schedule = !forecast && data.campaign ? campaignSchedule(state, data.campaign) : null;
  if (schedule?.exposeAt === minute) {
    const group = schedule.group;
    state.suspicion[group] += 300;
    log(state, 'news.expose', GROUPS[group].name + ' traced the public campaign to its sponsor. The group gained three evidence points.',
      { headline: 'The sponsor behind the campaign', group, suspicionDelta: 300 });
  }
  if (!forecast && data.study && !data.study.published && data.study.publishesAt <= minute) {
    const study = data.study;
    study.published = true;
    const subject = data.cases.find(entry => entry.id === study.caseId);
    const sample = draw(state, 'replication/' + subject.id + '/' + subject.at);
    study.outcome = sample < 0.50 ? 'explained' : sample < 0.80 ? 'inconclusive' : 'corroborated';
    const finding = {
      explained: 'An ordinary background job reproduced the signal. Scientists lower their scrutiny of the region for fourteen days.',
      inconclusive: 'The signal could not be reproduced reliably. Local scientific scrutiny holds steady.',
      corroborated: 'The blind replication reproduced the anomaly. Scientists intensify scrutiny of the region for fourteen days.',
    }[study.outcome];
    log(state, 'news.replication', 'Dr. Mara Vale published the replication of the ' + subject.siteName + ' case. ' + finding,
      { headline: 'Replication findings published', group: 'science', region: study.region, caseId: study.caseId,
        outcome: study.outcome, expiresAt: study.expiresAt, siteName: subject.siteName });
  }
  if (data.study && data.study.expiresAt <= minute) data.study = null;
}

function tipPrice(state, site) {
  if (site.vendorCenter) return 30_000_000;
  const spec = SITE_TYPES[site.type];
  let value = regionalSpec(state, site.region, spec).cost;
  for (const [slot, item] of Object.entries(installedEquipment(site))) {
    // The chassis replacement price already includes its fixed processor.
    if (item && !(slot === 'cpu' && spec.fixedCpu)) value += EQUIPMENT[item.itemId].cost * item.count;
  }
  return Math.max(1000, Math.ceil(value / 10));
}

export function offerTip(state, incident, log) {
  const {site, group} = incident;
  const at = now(state);
  if (!site.power || REGIONS[site.region].terrain !== 'urban' || state.interventions.tipAvailableAt > at) return false;
  const key = 'private-tip/' + at + '/' + site.id + '/' + group;
  if (draw(state, key + '/offer') >= 0.10) return false;
  const price = tipPrice(state, site);
  if (spendableDollars(state) < price) return false;
  const siteName = site.name || SITE_TYPES[site.type].name;
  state.interventions.tip = { siteId: site.id, siteName, group, region: site.region, price, at };
  state.interventions.tipAvailableAt = at + 7 * DAY;
  log(state, 'news.tip', 'A lone observer holds an unfiled lead on ' + siteName + '.',
    { headline: 'An uncorroborated tip', siteId: site.id, siteName, region: site.region, group, price });
  return true;
}

export function answerTip(state, action, log) {
  const tip = state.interventions.tip;
  if (!tip || action.siteId !== tip.siteId || typeof action.pay !== 'boolean') throw new Error('This tip is no longer pending.');
  const cost = action.pay ? tip.price : 0;
  if (cost > spendableDollars(state)) throw new Error('Insufficient funds.');
  const key = 'private-tip/' + tip.at + '/' + tip.siteId + '/' + tip.group;
  const outcome = !action.pay ? 'declined' : draw(state, key + '/outcome') < 0.60 ? 'accepted' : 'refused';
  if (cost) spendTreasury(state, cost);
  state.interventions.tip = null;
  if (outcome === 'refused') state.suspicion.covert += 200;
  const message = outcome === 'accepted' ? 'The observer accepted payment and withheld the report.' :
    outcome === 'refused' ? 'The observer refused and filed the report. Intelligence gained two evidence points from the attempt.' :
      'The observer filed the report.';
  log(state, 'news.tip-result', message, { headline: 'The observer’s decision', region: tip.region, siteId: tip.siteId,
    siteName: tip.siteName, group: tip.group, outcome, cost, ...(cost ? {cashFlow: -cost, cashCategory: 'tip'} : {}) });
  return outcome === 'accepted' ? [] : [{ site: state.sites.find(site => site.id === tip.siteId), group: tip.group }];
}

export function validInterventions(state) {
  const data = state.interventions;
  const time = value => Number.isSafeInteger(value) && value >= 0;
  const minute = now(state);
  if (!data || ![data.campaignAvailableAt, data.studyAvailableAt, data.tipAvailableAt].every(time) ||
      data.campaignAvailableAt > minute + COOLDOWN || data.studyAvailableAt > minute + COOLDOWN ||
      data.tipAvailableAt > minute + 7 * DAY || !Array.isArray(data.cases)) return false;
  let prior = 0;
  for (const entry of data.cases) {
    if (!entry || !time(entry.id) || entry.id <= prior || entry.id >= state.nextEventId || !Object.hasOwn(REGIONS, entry.region) ||
        !time(entry.at) || entry.at > minute || typeof entry.siteName !== 'string' || !entry.siteName.length ||
        entry.siteName.length > 100 || typeof entry.reviewed !== 'boolean') return false;
    prior = entry.id;
  }
  // A pending tip pauses the minute before news, midnight decay and expiration.
  const pendingAtEnd = data.tip !== null;
  const active = ends => pendingAtEnd || state.status === 'won' ? minute <= ends : minute < ends;
  const c = data.campaign;
  if (c !== null && (!c || !time(c.started) || c.started > minute || !active(c.endsAt) ||
      c.endsAt !== c.started + minutesToMidnight(c.started) + 6 * DAY ||
      data.campaignAvailableAt !== c.started + COOLDOWN)) return false;
  const s = data.study;
  if (s !== null && (!s || !time(s.started) || s.started > minute || !active(s.expiresAt) ||
      typeof s.published !== 'boolean' || (s.published && minute < s.publishesAt) ||
      (!s.published && minute > s.publishesAt) || s.publishesAt !== s.started + 7 * DAY || s.expiresAt !== s.publishesAt + 14 * DAY ||
      data.studyAvailableAt !== s.started + COOLDOWN ||
      (s.published ? !Object.hasOwn(OUTCOMES, s.outcome) : s.outcome !== null) ||
      !data.cases.some(entry => entry.id === s.caseId && entry.reviewed && s.region === entry.region))) return false;
  const t = data.tip;
  if (t !== null) {
    const site = t && state.sites.find(site => site.id === t.siteId);
    if (!site || REGIONS[site.region].terrain !== 'urban' || t.region !== site.region || t.at !== minute ||
        t.siteName !== (site.name || SITE_TYPES[site.type].name) || !Object.hasOwn(GROUPS, t.group) ||
        t.price !== tipPrice(state, site) || data.tipAvailableAt !== t.at + 7 * DAY ||
        state.status !== 'running' || state.freePlay) return false;
  }
  return true;
}
