import { MENU_LANGUAGES, preferredMenuLanguage } from './ui/menu-languages.js';
import { decodeCampaign, encodeCampaign, GAME_VERSION } from './persistence.js';

export const PREF_KEY = 'no-fixed-host.interface';
export const SLOT_PREFIX = 'no-fixed-host.checkpoint.';
export const QUICK_SLOT = SLOT_PREFIX + 'quick';
export const RECOVERY_SLOT = SLOT_PREFIX + 'recovery.' + GAME_VERSION;
export const WARNING_KEYS = ['lastHost', 'stalledBuild', 'maintenance', 'spareCpu', 'unassigned'];
export const DEFAULT_PREFS = {
  language: 'en', theme: 'night', scale: '100', daylight: true,
  sound: false, uiVolume: 45, musicVolume: 20, audioLatency: 'balanced',
  warnings: Object.fromEntries(WARNING_KEYS.map(key => [key, true])),
  reviewWarnings: false, pauseOnCompletion: false,
};

export function preferences(storage) {
  let raw;
  try { raw = JSON.parse(storage.getItem(PREF_KEY)); } catch { /* Use defaults on first visit or after a failed read. */ }
  const choose = (key, allowed) => allowed.includes(raw?.[key]) ? raw[key] : DEFAULT_PREFS[key];
  const volume = key => Number.isInteger(raw?.[key]) && raw[key] >= 0 && raw[key] <= 100 ? raw[key] : DEFAULT_PREFS[key];
  return {
    language: Object.hasOwn(MENU_LANGUAGES, raw?.language) ? raw.language : preferredMenuLanguage(globalThis.navigator?.languages), theme: choose('theme', ['night', 'contrast', 'amber']),
    scale: choose('scale', ['90', '100', '110', '125']), daylight: choose('daylight', [true, false]),
    audioLatency: choose('audioLatency', ['interactive', 'balanced', 'playback']),
    sound: choose('sound', [true, false]), uiVolume: volume('uiVolume'), musicVolume: volume('musicVolume'),
    warnings: Object.fromEntries(WARNING_KEYS.map(key => [key, raw?.warnings?.[key] !== false])),
    reviewWarnings: choose('reviewWarnings', [true, false]),
    pauseOnCompletion: choose('pauseOnCompletion', [true, false]),
  };
}

export function slotKey(name) {
  const trimmed = name.normalize('NFC').trim();
  if (!trimmed || trimmed.length > 60 || /[\u0000-\u001f\u007f]/u.test(trimmed)) throw new Error('invalidName');
  return SLOT_PREFIX + 'named.' + encodeURIComponent(trimmed.toLowerCase());
}

function readSlot(storage, key) {
  if (!key.startsWith(SLOT_PREFIX)) throw new Error('missingSlot');
  const text = storage.getItem(key);
  if (text === null) return null;
  let entry;
  try { entry = JSON.parse(text); } catch { throw new Error('invalidSlot'); }
  if (!entry || typeof entry.revision !== 'string' || typeof entry.name !== 'string' ||
      !Number.isFinite(entry.savedAt) || entry.data?.game !== 'no-fixed-host' ||
      !Number.isInteger(entry.data.format) || !Number.isSafeInteger(entry.data.campaign?.hour)) {
    throw new Error('invalidSlot');
  }
  return entry;
}

export function slotInfo(storage, key, includeDamaged = false) {
  let entry;
  try { entry = readSlot(storage, key); }
  catch (error) {
    if (!includeDamaged || error.message !== 'invalidSlot') throw error;
    let name = key.slice(SLOT_PREFIX.length);
    if (name.startsWith('named.')) name = name.slice('named.'.length);
    try { name = decodeURIComponent(name); } catch { /* A malformed key can still be removed. */ }
    return { key, name, damaged: true, savedAt: 0, unreadableData: storage.getItem(key) };
  }
  if (!entry) return null;
  return {
    key, name: entry.name, revision: entry.revision, savedAt: entry.savedAt, format: entry.data.format,
    gameVersion: typeof entry.gameVersion === 'string' ? entry.gameVersion : null,
    minutes: entry.data.campaign.hour * 60 + (entry.data.campaign.minute || 0),
  };
}

export function matchesSlotName(name, query) {
  const folded = name.normalize('NFC').toLocaleLowerCase();
  return query.trim().normalize('NFC').toLocaleLowerCase().split(/\s+/u).every(word => folded.includes(word));
}

export function listSlots(storage, query = '', includeDamaged = false) {
  const slots = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(SLOT_PREFIX)) continue;
    try {
      const entry = slotInfo(storage, key, includeDamaged);
      if (entry && matchesSlotName(entry.name, query)) slots.push(entry);
    } catch { /* One damaged record must not make other checkpoints inaccessible. */ }
  }
  return slots.sort((a, b) => b.savedAt - a.savedAt || a.name.localeCompare(b.name));
}

function checkRevision(current, expected) {
  if ((current?.revision ?? null) !== expected) throw new Error('staleSlot');
}

// The UI serializes writes across tabs with a Web Lock. The revision also guards
// confirmations left open while a different tab changes a checkpoint.
export function writeSlot(storage, key, name, state, expected, { now = Date.now(), gameVersion } = {}) {
  if (key !== QUICK_SLOT && key !== RECOVERY_SLOT && key !== slotKey(name)) throw new Error('invalidName');
  const data = JSON.parse(encodeCampaign(state));
  checkRevision(readSlot(storage, key), expected);
  const revision = crypto.getRandomValues(new Uint32Array(4)).join('-');
  const entry = { revision, name: name.normalize('NFC').trim(), savedAt: now, gameVersion, data };
  storage.setItem(key, JSON.stringify(entry));
}

export function loadSlot(storage, key, expected) {
  const entry = readSlot(storage, key);
  if (!entry) throw new Error('missingSlot');
  checkRevision(entry, expected);
  return decodeCampaign(JSON.stringify(entry.data));
}

export function removeSlot(storage, key, expected, unreadableData) {
  if (unreadableData !== undefined) {
    if (!key.startsWith(SLOT_PREFIX) || storage.getItem(key) !== unreadableData) throw new Error('staleSlot');
    storage.removeItem(key);
    return;
  }
  const entry = readSlot(storage, key);
  if (!entry) throw new Error('missingSlot');
  checkRevision(entry, expected);
  storage.removeItem(key);
}
