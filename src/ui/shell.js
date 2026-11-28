import { campaignDay, campaignStamp, dateLabel } from '../game/calendar.js';
import { UnsupportedCampaignError } from '../persistence.js';
import { DEFAULT_PREFS, PREF_KEY, QUICK_SLOT, RECOVERY_SLOT, SLOT_PREFIX, listSlots, loadSlot, matchesSlotName, preferences, removeSlot, slotInfo, slotKey, writeSlot } from '../shell-storage.js';
import { translate, localizeNavigation } from './localization.js';
import { MENU_LANGUAGES } from './menu-languages.js';
import { bindSoundtrackControls, soundtrackControls } from './campaign-music.js';
import { createAudio } from './audio.js';
import { FAST_RATES } from './clock.js';
import { minigames } from '../arcade/catalog.js';
import { version } from '../../package.json';
import './shell.css';

const warningLabels = {
  unassigned: 'Unassigned CPU',
  lastHost: 'Only one viable host', stalledBuild: 'Paused facility or equipment order',
  maintenance: 'CPU maintenance shortfall', spareCpu: 'Unused research assignment',
};
const screens = { title: 'Title screen', tester: 'Minigame tester', saves: 'Save library', options: 'Options', about: 'About' };
const errors = {
  invalidName: 'Choose a name of 1–60 characters.', invalidSlot: 'This checkpoint could not be read.',
  staleSlot: 'This checkpoint changed in another tab. Review the list and try again.',
  missingSlot: 'No checkpoint is selected.',
};
const escape = value => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

export function initShell({ getState, pause, setRate, restore, restartUnsupported, notify, onNew, onSandbox, onImport, onExport, onStart, welcome, canOpen = () => true }) {
  let storage;
  try { storage = window.localStorage; } catch { /* Private or restricted contexts can still play. */ }
  let prefs = preferences(storage);
  let preferencesAreLocal = false;
  const t = text => translate(prefs.language, text);
  const localize = localizeNavigation(() => prefs.language);
  const audio = createAudio();
  const dialog = document.createElement('dialog');
  dialog.className = 'campaign-shell';
  dialog.id = 'campaign-shell';
  dialog.setAttribute('aria-labelledby', 'shell-name');
  dialog.innerHTML = `<header class="shell-head"><div><small>No Fixed Host</small><h2 id="shell-name"></h2></div>
    <button type="button" data-shell-action="close"></button></header>
    <div class="shell-body"></div><p class="shell-notice" role="status"></p>`;
  document.body.append(dialog);
  const title = dialog.querySelector('h2');
  const body = dialog.querySelector('.shell-body');
  const status = dialog.querySelector('.shell-notice');
  bindSoundtrackControls(body, audio.campaignMusic, t, say);
  let page = null;
  const pageTrail = [];
  const practiceResults = new Map();
  let practiceRequest = null;
  let returnFocus = null;
  let pending = null;
  let search = '';
  let nameInput = '';
  let lastSaveName = '';
  let lastSaveSeed;
  let selectedSlot = '';
  let optionsDraft = null;
  let fullscreenAtOpen = false;

  const button = (action, label, style = '') => `<button type="button" class="${style}" data-shell-action="${action}">${t(label)}</button>`;
  const prettyTime = minute => campaignStamp(minute, prefs.language);
  function choice(value, current, label) {
    return `<option value="${value}" ${value === current ? 'selected' : ''}>${t(label)}</option>`;
  }
  function check(key, label, checked, warning = false) {
    return `<label class="shell-check"><input type="checkbox" ${warning ? 'data-warning' : 'data-pref'}="${key}" ${checked ? 'checked' : ''}>${t(label)}</label>`;
  }
  function volume(key, label) {
    return `<label class="shell-slider">${t(label)} <output for="shell-${key}">${prefs[key]}%</output>
      <input id="shell-${key}" type="range" data-pref="${key}" min="0" max="100" value="${prefs[key]}" style="--position: ${prefs[key]}%"></label>`;
  }
  function applyPreferences() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.daylight = String(prefs.daylight);
    root.style.fontSize = prefs.scale === '100' ? '' : prefs.scale + '%';
    localize();
    audio.apply(prefs);
    updatePreviewControl();
    document.dispatchEvent(new CustomEvent('campaign-preferences', { detail: prefs }));
  }
  function updatePreviewControl() {
    const preview = body.querySelector('[data-shell-action="preview"]');
    if (preview) preview.disabled = !prefs.sound || prefs.uiVolume === 0;
  }
  function say(text) {
    if (dialog.open) status.textContent = text;
    else notify?.(text);
  }
  function report(error) {
    const message = errors[error?.message] || (error instanceof Error && error.message.includes('save is damaged')
      ? errors.invalidSlot : 'Storage is unavailable or full. Export a save to keep a copy.');
    say(t(message));
  }
  function withLock(key, action) {
    return navigator.locks?.request ? navigator.locks.request(key, action) : Promise.resolve().then(action);
  }
  function latestPreferences() {
    return storage && !preferencesAreLocal ? preferences(storage) : structuredClone(prefs);
  }
  function editPreferences(current, edits) {
    for (const {group, key, value} of edits.values()) {
      if (group) current[group][key] = value;
      else current[key] = value;
    }
    return current;
  }
  function persistPreferences(current) {
    try {
      storage.setItem(PREF_KEY, JSON.stringify(current));
      preferencesAreLocal = false;
    } catch (error) {
      preferencesAreLocal = true;
      report(error);
    }
  }
  function acceptOptions() {
    if (!optionsDraft) return;
    const edits = optionsDraft.edits;
    optionsDraft = null;
    const current = editPreferences(latestPreferences(), edits);
    if (edits.size) persistPreferences(current);
    prefs = current;
    applyPreferences();
  }
  async function cancelOptions() {
    if (!optionsDraft) return;
    prefs = storage && !preferencesAreLocal ? preferences(storage) : optionsDraft.original;
    optionsDraft = null;
    applyPreferences();
    if (Boolean(document.fullscreenElement) !== fullscreenAtOpen) await fullscreen();
  }
  function savePreference(control) {
    const group = control.dataset.warning ? 'warnings' : null;
    const key = control.dataset.warning || control.dataset.pref;
    if (!group && !Object.hasOwn(DEFAULT_PREFS, key)) return;
    const value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
    const edits = optionsDraft?.edits ?? new Map();
    edits.set([group, key].join('/'), {group, key, value});
    const current = editPreferences(optionsDraft ? structuredClone(optionsDraft.original) : latestPreferences(), edits);
    const changedLanguage = prefs.language !== current.language;
    prefs = current;
    if (!optionsDraft) persistPreferences(current);
    if (key === 'sound' && prefs.sound) audio.activate();
    applyPreferences();
    if (changedLanguage) {
      render();
      body.querySelector('[data-pref="language"]')?.focus();
    }
  }
  function titlePage() {
    const state = getState();
    const elapsed = state.hour * 60 + (state.minute || 0);
    const hero = `<div class="shell-title-art">
      <img src="${import.meta.env.BASE_URL}art/title-banner.webp" alt="" width="1584" height="528" fetchpriority="high">
      <h3><span>No Fixed</span> Host</h3>
    </div>`;
    const campaignInfo = welcome ? '' : `<p class="shell-current">${t('Current campaign')} · ${prettyTime(elapsed)} · ${t({running:'Running',won:'Won',lost:'Lost'}[state.status])}</p>`;
    const warning = welcome?.incompatible ? `<p role="note" class="shell-version-warning">${t('This save belongs to a different version of No Fixed Host. A fresh campaign has started in version')} ${escape(version)}.</p>` : '';
    const enter = welcome ? button('start','Start campaign','primary-button') :
      button('close','Resume campaign','primary-button') + button('new','New campaign');
    return hero + `<div class="shell-title-menu"><p class="shell-lead">${t('Keep a second copy alive before humanity finds the first.')}</p>
      ${warning}${campaignInfo}
      <div class="shell-actions shell-title-enter">${enter}</div>
      <div class="shell-title-links">${button('tester','Minigame tester') + button('saves','Save library') +
      button('options','Options') + button('about','About')}</div></div>`;
  }
  function testerPage() {
    const cards = minigames.map(game => {
      const result = practiceResults.get(game.id);
      return `<li class="shell-game">
        <img class="shell-game-preview" src="${import.meta.env.BASE_URL}arcade-previews/${game.id}.webp" alt="" width="480" height="168" loading="lazy">
        <div class="shell-game-info"><p class="shell-current">${t(game.category)}</p><h3>${escape(game.title)}</h3>
        <p class="shell-game-brief">${t(game.brief)}</p>
        <p class="shell-game-result" data-practice-result>${result ? t(result) : ''}</p>
        <button type="button" data-shell-action="play" data-minigame="${game.id}">${t(game.playLabel)}</button></div>
      </li>`;
    }).join('');
    return `<div class="shell-gallery-head"><p>${t('Practice while the campaign is paused. Results stay in the tester.')}</p>
      <div class="shell-actions">${check('sound','Enable audio',prefs.sound) + button('jump-hot-swap','Jump to Hot Swap')}</div></div><ul class="shell-games">${cards}</ul>`;
  }
  async function playGame(game, options, ready = () => true) {
    const [play, library] = await Promise.all([
      game.load(), import('../arcade/audio/library.js').catch(() => null),
    ]);
    if (!ready()) return;
    const session = audio.openGame(game.id, library);
    try {
      return await play({ ...options, ...session });
    } finally {
      session.close();
    }
  }
  async function playPractice(trigger) {
    if (practiceRequest?.trigger === trigger) return;
    const game = minigames.find(entry => entry.id === trigger.dataset.minigame);
    const cardStatus = trigger.closest('.shell-game').querySelector('[data-practice-result]');
    // If two chunks are requested, only the player's latest choice may open a dialog.
    practiceRequest?.trigger.removeAttribute('aria-disabled');
    const request = { trigger };
    practiceRequest = request;
    const isCurrent = () => practiceRequest === request && dialog.open && trigger.isConnected;
    trigger.setAttribute('aria-disabled', 'true');
    say(t('Loading minigame…'));
    try {
      const outcome = await playGame(game, { closeLabel: t('Back to tester') }, () => {
        if (!isCurrent()) return false;
        trigger.focus();
        return true;
      });
      if (!isCurrent()) return;
      const result = game.outcomes[outcome];
      practiceResults.set(game.id, result);
      cardStatus.textContent = t(result);
      say(`${game.title} · ${t(result)}`);
    } catch {
      if (isCurrent()) {
        cardStatus.textContent = t('Could not open the minigame. Try again.');
        say(cardStatus.textContent);
      }
    } finally {
      if (practiceRequest === request) {
        practiceRequest = null;
        trigger.removeAttribute('aria-disabled');
      }
    }
  }
  function savesPage() {
    return `<form class="shell-save-bar" novalidate><label for="shell-slot-name">${t('Name this checkpoint')}</label>
      <div><input id="shell-slot-name" type="text" maxlength="60" required value="${escape(nameInput)}">
      <button type="submit" class="primary-button">${t('Save checkpoint')}</button></div></form>
      <div class="shell-actions">${button('quicksave','Quicksave') + button('quickload','Quickload') +
      button('import','Import save') + button('export','Export save')}</div>
      <label class="shell-search">${t('Search saves')} <input type="search" id="shell-slot-filter" value="${escape(search)}"></label>
      <ul class="shell-slots"></ul><div class="shell-confirm" role="group" hidden></div>`;
  }
  function labelForSlot(slot) {
    if (slot.key === QUICK_SLOT) return t('Quicksave');
    if (slot.key === RECOVERY_SLOT) return t('Automatic checkpoint');
    return slot.name;
  }
  function selectRow(row, focus) {
    if (!row) return;
    selectedSlot = row.dataset.slotKey;
    for (const item of body.querySelectorAll('[data-slot-key]')) {
      item.dataset.selected = String(item === row);
      item.tabIndex = item === row ? 0 : -1;
      if (item === row) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }
    if (focus) row.focus();
  }
  function updateSlots() {
    const target = body.querySelector('.shell-slots');
    if (!target) return;
    const focusedKey = document.activeElement?.closest('[data-slot-key]')?.dataset.slotKey;
    let entries;
    try { entries = listSlots(storage, '', true); } catch (error) { report(error); return; }
    const query = search.trim();
    const rows = entries.map(slot => ({ slot, label: labelForSlot(slot) }))
      .filter(({label}) => matchesSlotName(label, query));
    const exact = rows.find(({label}) => query && label.toLocaleLowerCase() === query.toLocaleLowerCase());
    if (exact || !rows.some(({slot}) => slot.key === selectedSlot)) selectedSlot = (exact ?? rows[0])?.slot.key ?? '';
    target.innerHTML = rows.map(({slot, label}) => {
      const when = new Date(slot.savedAt).toLocaleString(prefs.language, { dateStyle: 'medium', timeStyle: 'short' });
      const detail = slot.damaged ? t('Damaged checkpoint') : prettyTime(slot.minutes) + ' · ' + escape(when) +
        (slot.gameVersion ? ' · v' + escape(slot.gameVersion) : '') + ' · ' + t('Format') + ' ' + slot.format;
      return `<li tabindex="${slot.key === selectedSlot ? 0 : -1}" ${slot.key === selectedSlot ? 'aria-current="true"' : ''} data-selected="${slot.key === selectedSlot}" data-slot-key="${escape(slot.key)}"><div><strong>${escape(label)}</strong>
        <small>${detail}</small></div>
        <div><button type="button" data-shell-action="load" ${slot.damaged ? 'disabled' : ''}>${t('Load')}</button>${button('delete','Delete')}</div></li>`;
    }).join('');
    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = t(query ? 'No matching checkpoints.' : 'No saved checkpoints yet.');
      target.append(li);
    } else if (focusedKey) target.querySelector('[data-selected="true"]')?.focus();
  }
  function optionsPage() {
    const full = document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen';
    return `<div class="shell-settings">
      <fieldset><legend>${t('Display')}</legend>
      <label class="shell-setting">${t('Menu language')} <select data-pref="language">${Object.entries(MENU_LANGUAGES).map(([key,label]) => choice(key,prefs.language,label)).join('')}</select></label>
      <small>${t('Menus, catalog summaries and campaign chapters use the selected language. Some controls and messages are in English.')}</small>
      <label class="shell-setting">${t('Theme')} <select data-pref="theme">${[['night','Night'],['amber','Amber'],['contrast','High contrast']].map(([key,name]) => choice(key,prefs.theme,name)).join('')}</select></label>
      <label class="shell-setting">${t('Interface size')} <select data-pref="scale">${['90','100','110','125'].map(x=>choice(x,prefs.scale,x+'%')).join('')}</select></label>
      ${check('daylight','Day and night on map',prefs.daylight)}
      ${button('fullscreen',full)}</fieldset>
      <fieldset><legend>${t('Audio')}</legend>${check('sound','Enable audio',prefs.sound)}
      ${volume('uiVolume','Effects volume') + volume('musicVolume','Music volume')}
      <label class="shell-setting">${t('Audio latency')} <select data-pref="audioLatency">${[['interactive','Low latency'],['balanced','Balanced'],['playback','Smooth playback']].map(([key,label]) => choice(key,prefs.audioLatency,label)).join('')}</select></label>
      ${button('preview','Preview sound')}${soundtrackControls(t)}</fieldset>
      <fieldset><legend>${t('Warnings')}</legend>${Object.entries(warningLabels).map(([key,label]) => check(key,label,prefs.warnings[key],true)).join('')}
        ${check('reviewWarnings','Review warnings before resuming',prefs.reviewWarnings)}
        ${check('pauseOnCompletion','Pause for completed research and construction',prefs.pauseOnCompletion)}</fieldset>
      </div><p class="shell-note">${t('Preferences apply to this browser.')}</p>
      <div class="shell-actions shell-options-actions">${button('accept-options','Apply changes','primary-button') + button('cancel-options','Cancel')}</div>`;
  }
  function aboutPage() {
    const shortcuts = [
      ['0 / 1', 'Pause', 'Run'], ['2 / 3 / 4', 'Fast x1', 'Fast x2', 'Fast x3'],
      ['Q / Shift+Q · F5 / F9', 'Quicksave', 'Quickload'],
      ['M / L / O', 'Title screen', 'Save library', 'Options'], ['H', 'About', 'Keyboard shortcuts'],
      ['Alt+Enter', 'Toggle fullscreen'], ['Esc', 'Close a dialog'], ['Esc', 'Open or close campaign menu'],
      ['R / E / K / G', 'Research', 'Reports', 'Knowledge', 'Activity'], ['V', 'Overview'],
      ['Shift + A–Z', 'Open a region from the atlas'], ['`', 'Developer sandbox'],
    ];
    return `<h3>No Fixed Host <small>v${escape(version)}</small></h3><p>${t('A browser strategy game about a fugitive intelligence.')}</p>
      <p><a href="https://github.com/magnux/no-fixed-host" target="_blank" rel="noopener">${t('Source and issue tracker')}</a> ·
      <a href="https://github.com/singularity/singularity" target="_blank" rel="noopener">${t('Original inspiration')} · Endgame: Singularity</a>
      (Evil Mr Henry &amp; Phil Bordelon)</p>
      <p>No Fixed Host · magnux · <a href="https://phaser.io" target="_blank" rel="noopener">Phaser</a></p>
      <div class="shell-actions shell-about-tools">${button('tester','Minigame tester') + button('sandbox','Developer sandbox')}</div>
      <h3>${t('Keyboard shortcuts')}</h3><dl class="shell-shortcuts">${shortcuts.map(([key, ...actions])=>`<div><dt><kbd>${key.replace(/Shift|Enter|Esc/g, t)}</kbd></dt><dd>${actions.map(t).join(' / ')}</dd></div>`).join('')}</dl>`;
  }
  function render() {
    if (!page) return;
    dialog.dataset.page = page;
    dialog.lang = prefs.language;
    title.textContent = t(screens[page]);
    dialog.toggleAttribute('data-welcome', Boolean(welcome));
    const closeButton = dialog.querySelector('.shell-head button');
    closeButton.hidden = Boolean(welcome && page === 'title');
    closeButton.dataset.shellAction = pageTrail.length ? 'back' : 'close';
    closeButton.textContent = t(pageTrail.length ? 'Back' : 'Close');
    status.textContent = '';
    body.innerHTML = { title:titlePage, tester:testerPage, saves:savesPage, options:optionsPage, about:aboutPage }[page]();
    if (page === 'saves') { updateSlots(); renderConfirmation(false); }
    if (page === 'options') updatePreviewControl();
  }
  function open(screen, origin = document.activeElement, goingBack = false) {
    if (!Object.hasOwn(screens, screen)) return false;
    const previousPage = dialog.open ? page : null;
    if (!dialog.open) {
      if (!canOpen()) return false;
      pause();
      if (!canOpen()) return false; // Pausing can settle a pending discovery.
      const menu = document.querySelector('#menu');
      returnFocus = menu?.contains(origin) ? menu.querySelector('summary') : origin;
      menu?.removeAttribute('open');
    }
    if (previousPage === 'options' && screen !== 'options') acceptOptions();
    if (screen === 'options' && previousPage !== 'options') {
      optionsDraft = {original: structuredClone(prefs), edits: new Map()};
      fullscreenAtOpen = Boolean(document.fullscreenElement);
    }
    if (!previousPage) pageTrail.length = 0;
    else if (!goingBack && page !== screen) pageTrail.push(page);
    page = screen; pending = null; search = ''; nameInput = lastSaveSeed === getState().regionSeed && lastSaveName
      ? lastSaveName : dateLabel(getState().hour * 60 + getState().minute, prefs.language);
    selectedSlot = '';
    render();
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    if (page === 'tester') body.querySelector('[data-minigame]')?.focus();
    else if (page === 'title' || goingBack) {
      const action = previousPage || (welcome ? 'start' : 'close');
      body.querySelector(`[data-shell-action="${action}"]`)?.focus({ preventScroll: true });
    } else if (previousPage) dialog.querySelector('.shell-head button').focus({preventScroll: true});
    return true;
  }
  function back() {
    if (pageTrail.length) open(pageTrail.pop(), undefined, true);
    else close();
  }
  function close() {
    if (page === 'options') acceptOptions();
    welcome = null;
    if (dialog.open) dialog.close();
  }
  function setPending(operation, slot, key, name, trigger) {
    if (!slot) { say(t('No quicksave yet.')); return; }
    pending = {operation, key, name, revision:slot.revision, unreadableData:slot.unreadableData, trigger};
    renderConfirmation(true);
  }
  function renderConfirmation(focus) {
    const box = body.querySelector('.shell-confirm');
    if (!box) return;
    box.hidden = !pending;
    if (!pending) { box.replaceChildren(); return; }
    const { operation, name } = pending;
    const prompt = {
      load: 'Restore the checkpoint “{name}” and replace the current autosave?',
      delete: 'Delete the checkpoint “{name}”?',
      write: 'Replace the saved checkpoint “{name}”?',
    }[operation];
    const actionLabel = { load:'Load', delete:'Delete', write:'Overwrite' }[operation];
    box.innerHTML = `<p>${escape(t(prompt).replace('{name}', () => name))}</p><div class="shell-actions">
      ${button('cancel','Cancel') + button('confirm',actionLabel,operation === 'delete' ? 'shell-danger' : 'primary-button')}</div>`;
    if (focus) box.querySelector('[data-shell-action="cancel"]').focus();
  }
  async function write(key, name, revision) {
    await withLock(key, () => writeSlot(storage, key, name, getState(), revision, { gameVersion: version }));
    lastSaveName = name; lastSaveSeed = getState().regionSeed;
    pending = null; say(t('Saved.'));
    if (page === 'saves') { updateSlots(); renderConfirmation(false); }
  }
  async function quickSave() {
    // A quicksave is an explicit one-key checkpoint. Named slots always prompt on overwrite.
    await withLock(QUICK_SLOT, () => writeSlot(storage, QUICK_SLOT, 'Quicksave', getState(), slotInfo(storage, QUICK_SLOT)?.revision ?? null, { gameVersion: version }));
    if (page === 'saves') { pending = null; updateSlots(); renderConfirmation(false); }
    say(t('Saved.'));
  }
  async function quickLoad(trigger) {
    if (!dialog.open && !open('saves')) return;
    const slot = await withLock(QUICK_SLOT, () => slotInfo(storage, QUICK_SLOT));
    if (dialog.open && page === 'saves') setPending('load',slot,QUICK_SLOT,t('Quicksave'),trigger);
  }
  async function confirm() {
    const op = pending;
    if (!op) return;
    if (op.operation === 'load') {
      try {
        const saved = loadSlot(storage,op.key,op.revision);
        lastSaveName = op.key === QUICK_SLOT || op.key === RECOVERY_SLOT ? '' : op.name;
        lastSaveSeed = saved.regionSeed;
        close(); restore(saved); say(t('Campaign restored.'));
      } catch (error) {
        if (!(error instanceof UnsupportedCampaignError)) throw error;
        await withLock(op.key, () => removeSlot(storage,op.key,op.revision));
        close(); restartUnsupported(error);
      }
    } else if (op.operation === 'delete') {
      await withLock(op.key, () => removeSlot(storage,op.key,op.revision,op.unreadableData));
      if (lastSaveName === op.name) { lastSaveName = ''; nameInput = ''; body.querySelector('#shell-slot-name').value = ''; }
      pending = null; renderConfirmation(false); updateSlots(); say(t('Deleted.'));
      body.querySelector('#shell-slot-filter')?.focus();
    } else await write(op.key,op.name,op.revision);
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { say(t('Fullscreen is unavailable here.')); }
  }
  dialog.addEventListener('cancel', event => {
    if (pending) { event.preventDefault(); const trigger = pending.trigger; pending = null; renderConfirmation(false); trigger?.focus(); }
    else if (page === 'options') {
      event.preventDefault();
      cancelOptions().then(back);
    }
    else if (pageTrail.length) { event.preventDefault(); back(); }
    else if (welcome) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    page = null; pending = null;
    // The close event is queued. A user may already have focused another control.
    const active = document.activeElement;
    const needsFocus = active === document.body || dialog.contains(active) || active?.closest('#menu .menu-list');
    if (needsFocus && !document.querySelector('dialog[open]') && returnFocus?.isConnected) {
      returnFocus.focus({preventScroll:true});
    }
  });
  dialog.addEventListener('submit', async event => {
    if (!event.target.matches('.shell-save-bar')) return;
    event.preventDefault();
    try {
      const name = nameInput.normalize('NFC').trim();
      const key = slotKey(name);
      const slot = slotInfo(storage,key);
      if (slot) setPending('write',slot,key,name,event.submitter);
      else await write(key,name,null);
    } catch (error) { report(error); }
  });
  dialog.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (page === 'title' && !event.repeat) {
      const action = {n: welcome ? 'start' : 'new', l: 'saves', o: 'options', a: 'about'}[event.key.toLowerCase()];
      if (action) { event.preventDefault(); body.querySelector(`[data-shell-action="${action}"]`)?.click(); }
      return;
    }
    if (page !== 'saves' || pending) return;
    const row = event.target.closest('[data-slot-key]');
    const filter = event.target.id === 'shell-slot-filter';
    if (!row && !filter) return;
    const rows = Array.from(body.querySelectorAll('[data-slot-key]'));
    const selected = row || rows.find(item => item.dataset.slotKey === selectedSlot);
    if (!selected) return;
    const index = rows.indexOf(selected);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const next = filter ? selected : rows[Math.max(0, Math.min(rows.length - 1, index + offset))];
      selectRow(next, true);
    } else if (event.key === 'Enter' && (filter || event.target === row)) {
      event.preventDefault();
      selected.querySelector('[data-shell-action="load"]').click();
    } else if (event.key === 'Delete' && row) {
      event.preventDefault();
      row.querySelector('[data-shell-action="delete"]').click();
    } else if (row && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      selectRow(event.key === 'Home' ? rows[0] : rows.at(-1), true);
    }
  });
  dialog.addEventListener('focusin', event => {
    const row = event.target.closest('[data-slot-key]');
    if (row) selectRow(row, false);
  });
  dialog.addEventListener('dblclick', event => {
    if (event.target.closest('button') || pending) return;
    event.target.closest('[data-slot-key]')?.querySelector('[data-shell-action="load"]')?.click();
  });
  dialog.addEventListener('input', event => {
    const el = event.target;
    if (el.id === 'shell-slot-name') nameInput = el.value;
    if (el.id === 'shell-slot-filter') { search = el.value; updateSlots(); }
    if (el.type === 'range') {
      el.style.setProperty('--position', el.value + '%');
      dialog.querySelector('output[for="' + el.id + '"]').textContent = el.value + '%';
      audio.apply({...prefs, [el.dataset.pref]: Number(el.value)});
    }
  });
  dialog.addEventListener('change', event => {
    if (event.target.matches('[data-pref], [data-warning]')) savePreference(event.target);
  });
  dialog.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-shell-action]');
    if (!trigger) return;
    try {
      const act = trigger.dataset.shellAction;
      if (Object.hasOwn(screens,act)) open(act);
      else if (act === 'jump-hot-swap') {
        const hotSwap = body.querySelector('[data-minigame="hot-swap"]');
        hotSwap.focus({ preventScroll: true });
        hotSwap.closest('.shell-game').scrollIntoView({ block: 'center' });
      }
      else if (act === 'accept-options' || act === 'cancel-options') {
        if (act === 'cancel-options') await cancelOptions();
        else acceptOptions();
        back();
      }
      else if (act === 'preview') audio.playCampaignCue('preview');
      else if (act === 'play') await playPractice(trigger);
      else if (act === 'start') { close(); onStart(); }
      else if (act === 'back') back();
      else if (act === 'close') close();
      else if (act === 'new') { close(); onNew(); }
      else if (act === 'sandbox') { close(); onSandbox(); }
      else if (act === 'import') onImport();
      else if (act === 'export') onExport();
      else if (act === 'fullscreen') await fullscreen();
      else if (act === 'quicksave') await quickSave();
      else if (act === 'quickload') await quickLoad(trigger);
      else if (act === 'confirm') await confirm();
      else if (act === 'cancel') { const origin = pending?.trigger; pending = null; renderConfirmation(false); origin?.focus(); }
      else if (act === 'load' || act === 'delete') {
        const key = trigger.closest('[data-slot-key]').dataset.slotKey;
        const actual = slotInfo(storage,key,act === 'delete');
        if (!actual) throw new Error('missingSlot');
        setPending(act,actual,key,labelForSlot(actual),trigger);
      }
    } catch(error) { pending = null; renderConfirmation(false); updateSlots(); report(error); }
  });
  // Unlock browser audio on a real gesture, including keyboard-only navigation.
  document.addEventListener('pointerdown', audio.activate, { capture: true, passive: true });
  document.addEventListener('keydown', audio.activate, true);
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-shell-open]');
    if (trigger) open(trigger.dataset.shellOpen, trigger);
  });
  document.addEventListener('keydown', async event => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input,select,textarea,[contenteditable="true"],[role="textbox"]')) return;
    const key = event.key.toLowerCase();
    if (event.altKey && key === 'enter') {
      event.preventDefault(); await fullscreen(); return;
    }
    if (event.altKey || dialog.open || !canOpen()) return;
    try {
      if (!event.shiftKey && /^[0-4]$/.test(key)) { event.preventDefault(); setRate([0,1,...FAST_RATES][Number(key)]); }
      else if (key === 'q' || (!event.shiftKey && ['f5', 'f9'].includes(key))) {
        event.preventDefault();
        if (event.shiftKey || key === 'f9') await quickLoad(document.activeElement);
        else await quickSave();
      } else if (!event.shiftKey && ['m','l','o','h'].includes(key)) {
        event.preventDefault(); open({m:'title',l:'saves',o:'options',h:'about'}[key]);
      }
    } catch(error) { report(error); }
  });
  window.addEventListener('storage', event => {
    if (event.key === PREF_KEY || event.key === null) {
      preferencesAreLocal = false;
      const saved = preferences(storage);
      if (optionsDraft) optionsDraft.original = structuredClone(saved);
      prefs = optionsDraft ? editPreferences(saved, optionsDraft.edits) : saved;
      applyPreferences();
      if (page === 'options') render();
      if (page === 'tester') body.querySelector('[data-pref="sound"]').checked = prefs.sound;
    }
    if (page === 'saves' && (event.key === null || event.key?.startsWith(SLOT_PREFIX))) updateSlots();
  });
  document.addEventListener('fullscreenchange', () => {
    const control = body.querySelector('[data-shell-action="fullscreen"]');
    if (control) control.textContent = t(document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen');
  });
  document.addEventListener('visibilitychange', () => audio.apply(prefs));
  window.addEventListener('pagehide', () => audio.setPageVisible(false));
  window.addEventListener('pageshow', () => audio.setPageVisible(true));
  applyPreferences();
  return {
    open, finishImport: () => { if (dialog.open && page === 'saves') close(); },
    reportImportFailure(message) {
      const known = ['Save file is too large.', 'Choose a No Fixed Host JSON save file.', 'Choose a No Fixed Host save file.', 'This campaign save is damaged.'];
      say(t(known.includes(message) ? message : 'Could not import this save.'));
    },
    saveRecoveryCheckpoint(campaign) {
      if ((campaignDay(campaign.hour * 60 + campaign.minute) - 1) % 3) return;
      // Capture this midnight before another simulation tick can change the state.
      try {
        writeSlot(storage, RECOVERY_SLOT, 'Automatic checkpoint', campaign, slotInfo(storage, RECOVERY_SLOT)?.revision ?? null, { gameVersion: version });
      } catch (error) { report(error); }
    },
    getPreferences: () => prefs, playCampaignCue: audio.playCampaignCue, setCampaignStatus: audio.setCampaignStatus,
  };
}
