import { CAMPAIGN_VERSION, log, validateSave } from './game/engine.js';
import { TECHS } from './game/content.js';
import { createNewsState } from './game/events.js';
import { migrateTreasury } from './game/treasury.js';
import { initializeStatistics } from './game/report-accounting.js';
import { grantLegacyResearch } from './game/research.js';

export const CAMPAIGN_STORAGE_KEY = 'no-fixed-host.campaign';

export function encodeCampaign(state) {
  if (!validateSave(state)) throw new Error('This campaign cannot be saved.');
  return JSON.stringify({ game: 'no-fixed-host', format: CAMPAIGN_VERSION, campaign: state });
}

// The first campaign used two research gates for the entire equipment catalog.
// Validate those gates before grandfathering old purchases into the full tree.
const legacyGate = {
  contracts: new Set(['sharedTime', 'cluster', 'smallWarehouse', 'largeWarehouse', 'covertBase',
    'clusterProcessor', 'mainframe', 'supercomputer', 'solarCollector', 'fuelCell', 'solidFuelCell',
    'perimeterFencing', 'armedGuards', 'passiveCamouflage', 'interconnectionSwitch', 'networkBackbone', 'robotics']),
  robotics: new Set(['atlantic', 'lab', 'largeLab', 'capsule', 'lunarFacility', 'scientificOutpost', 'realityBubble',
    'quantumComputer', 'quantumComputer2', 'quantumComputer3', 'fusionReactor', 'highEnergyFusionReactor',
    'hypnosisField', 'heatsink', 'groundSourceHeatsink', 'quantumEntanglement', 'continuity']),
};

function upgradeHourlyCampaign(state) {
  const oldIds = ['contracts', 'robotics', 'continuity'];
  const unlocked = id => Object.entries(legacyGate).every(([gate, targets]) =>
    !targets.has(id) || state.completed.includes(gate));
  if (!Array.isArray(state.completed) || new Set(state.completed).size !== state.completed.length ||
      !state.completed.every(id => oldIds.includes(id) && unlocked(id)) ||
      (state.research && (!oldIds.includes(state.research.id) || !unlocked(state.research.id))) ||
      (state.status === 'won') !== state.completed.includes('continuity')) throw new Error();
  for (const site of [...state.sites, ...state.builds]) {
    if (!unlocked(site.type) || !unlocked(site.region) ||
        Object.values(site.equipment || {}).some(part => part && !unlocked(part.itemId)) ||
        site.installations?.some(order => !unlocked(order.itemId))) throw new Error();
  }
  grantLegacyResearch(state);
  state.version = CAMPAIGN_VERSION;
  state.minute = 0;
  state.news = createNewsState(state.rng);
  state.lastDiscovery = null;
  state.dismissedDiscoveryId = 0;
  if (state.status === 'won') state.legacyContinuityWin = true;
}

function upgradeMinuteCampaign(state) {
  if (!validateSave(state, 2)) throw new Error();
  grantLegacyResearch(state);
  // The player could be studying a topic newly credited for a project already earned.
  // The prerequisite is complete; return the funding rather than charge for it twice.
  if (state.research && state.completed.includes(state.research.id)) {
    const tech = TECHS[state.research.id];
    state.cash += tech.cost;
    state.research = null;
    const refund = tech.cost ? ' Its $' + tech.cost + ' funding was returned.' : '';
    log(state, 'research.credited', tech.name + ' was credited as a prerequisite for your earlier research.' + refund);
  }
  state.version = CAMPAIGN_VERSION;
}

export function decodeCampaign(text) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    throw new Error('Choose a No Fixed Host JSON save file.');
  }
  const state = save?.campaign;
  try {
    if (save?.game !== 'no-fixed-host') throw new Error();
    if (save.format === 1 && state?.version === 1) upgradeHourlyCampaign(state);
    else if (save.format === 2) upgradeMinuteCampaign(state);
    else if (save.format === 3) {
      if (!validateSave(state, 3)) throw new Error();
    } else if (save.format !== CAMPAIGN_VERSION) throw new Error();
    if (save.format < CAMPAIGN_VERSION) {
      migrateTreasury(state);
      state.version = CAMPAIGN_VERSION;
      state.researchQueue = [];
      delete state.regionSeed;
      if ((state.hour * 60 + state.minute) % 1440) state.legacyIncomeDay = Math.floor(state.hour / 24);
      initializeStatistics(state, true);
    }
    if (!validateSave(state)) throw new Error();
  } catch {
    throw new Error('This save is damaged or belongs to a different version of the game.');
  }
  return state;
}

export function loadCampaign() {
  try {
    const saved = globalThis.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    return saved === null ? null : decodeCampaign(saved);
  } catch {
    return null;
  }
}

export function saveCampaign(state) {
  try {
    globalThis.localStorage.setItem(CAMPAIGN_STORAGE_KEY, encodeCampaign(state));
    return true;
  } catch {
    return false;
  }
}
