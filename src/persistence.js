import { validateSave } from './game/engine.js';

export const CAMPAIGN_STORAGE_KEY = 'no-fixed-host.campaign';

export function encodeCampaign(state) {
  if (!validateSave(state)) throw new Error('This campaign cannot be saved.');
  return JSON.stringify({ game: 'no-fixed-host', format: 1, campaign: state });
}

export function decodeCampaign(text) {
  let save;
  try {
    save = JSON.parse(text);
  } catch {
    throw new Error('Choose a No Fixed Host JSON save file.');
  }
  if (save?.game !== 'no-fixed-host' || save.format !== 1 || !validateSave(save.campaign)) {
    throw new Error('This save is damaged or belongs to a different version of the game.');
  }
  return save.campaign;
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
