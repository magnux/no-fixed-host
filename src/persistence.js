import release from '../package.json' with { type: 'json' };
import { CAMPAIGN_VERSION, validateSave } from './game/engine.js';

export const CAMPAIGN_STORAGE_KEY = 'no-fixed-host.campaign';
export const GAME_VERSION = release.version;

export class UnsupportedCampaignError extends Error {
  constructor() {
    super('This save belongs to a different version of No Fixed Host. A fresh campaign has started in version ' + GAME_VERSION + '.');
  }
}

export function encodeCampaign(state) {
  if (!validateSave(state)) throw new Error('This campaign cannot be saved.');
  return JSON.stringify({ game: 'no-fixed-host', gameVersion: GAME_VERSION, format: CAMPAIGN_VERSION, campaign: state });
}

export function decodeCampaign(text) {
  let save;
  try { save = JSON.parse(text); } catch { throw new Error('Choose a No Fixed Host JSON save file.'); }
  if (save?.game !== 'no-fixed-host' || !Number.isInteger(save.format)) throw new Error('Choose a No Fixed Host save file.');
  if (save.format !== CAMPAIGN_VERSION || save.gameVersion !== GAME_VERSION) throw new UnsupportedCampaignError();
  if (!validateSave(save.campaign)) throw new Error('This campaign save is damaged.');
  return save.campaign;
}

export function loadCampaign(onError) {
  try {
    const saved = globalThis.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    return saved === null ? null : decodeCampaign(saved);
  } catch (error) {
    onError?.(error);
    return null;
  }
}

export function saveCampaign(state) {
  try {
    globalThis.localStorage.setItem(CAMPAIGN_STORAGE_KEY, encodeCampaign(state));
    return true;
  } catch { return false; }
}
