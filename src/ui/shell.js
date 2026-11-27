import { DEFAULT_PREFS, PREF_KEY, QUICK_SLOT, SLOT_PREFIX, listSlots, loadSlot, preferences, removeSlot, slotInfo, slotKey, writeSlot } from '../shell-storage.js';
import { translate, localizeNavigation } from './localization.js';
import { createAudio } from './audio.js';
import { FAST_RATES } from './clock.js';
import { version } from '../../package.json';
import './shell.css';

const warningLabels = {
  lastHost: 'Only one viable host', stalledBuild: 'Construction has no CPU',
  maintenance: 'CPU maintenance shortfall', spareCpu: 'Paused research or spare CPU',
};
const screens = { title: 'Title screen', saves: 'Save library', options: 'Options', about: 'About' };
const errors = {
  invalidName: 'Choose a name of 1–60 characters.', invalidSlot: 'This checkpoint could not be read.',
  staleSlot: 'This checkpoint changed in another tab. Review the list and try again.',
  missingSlot: 'No checkpoint is selected.',
};
const escape = value => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

export function initShell({ getState, pause, setRate, restore, notify, onNew, onImport, onExport, canOpen = () => true }) {
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
  let page = null;
  let fromHub = false;
  let returnFocus = null;
  let pending = null;
  let search = '';
  let nameInput = '';

  const button = (action, label, style = '') => `<button type="button" class="${style}" data-shell-action="${action}">${t(label)}</button>`;
  const prettyTime = minute => `${t('Day')} ${Math.floor(minute / 1440) + 1} · ${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  function choice(value, current, label) {
    return `<option value="${value}" ${value === current ? 'selected' : ''}>${t(label)}</option>`;
  }
  function check(key, label, checked, warning = false) {
    return `<label class="shell-check"><input type="checkbox" ${warning ? 'data-warning' : 'data-pref'}="${key}" ${checked ? 'checked' : ''}>${t(label)}</label>`;
  }
  function volume(key, label) {
    return `<label class="shell-slider">${t(label)} <output for="shell-${key}">${prefs[key]}%</output>
      <input id="shell-${key}" type="range" data-pref="${key}" min="0" max="100" value="${prefs[key]}"></label>`;
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
  function savePreference(control) {
    const current = storage && !preferencesAreLocal ? preferences(storage) : structuredClone(prefs);
    const key = control.dataset.pref;
    if (control.dataset.warning) current.warnings[control.dataset.warning] = control.checked;
    else if (Object.hasOwn(DEFAULT_PREFS, key)) current[key] = control.type === 'checkbox' ? control.checked :
      control.type === 'range' ? Number(control.value) : control.value;
    const changedLanguage = prefs.language !== current.language;
    prefs = current;
    let writeError;
    try { storage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (error) { writeError = error; }
    preferencesAreLocal = Boolean(writeError);
    if (key === 'sound' && prefs.sound) audio.activate();
    applyPreferences();
    if (changedLanguage) {
      render();
      body.querySelector('[data-pref="language"]')?.focus();
    }
    if (writeError) report(writeError);
  }
  function titlePage() {
    const state = getState();
    const elapsed = state.hour * 60 + (state.minute || 0);
    return `<p class="shell-lead">${t('Keep a second copy alive before humanity finds the first.')}</p>
      <p class="shell-current">${t('Current campaign')} · ${prettyTime(elapsed)} · ${t({running:'Running',won:'Won',lost:'Lost'}[state.status])}</p>
      <div class="shell-actions hub">${button('close','Resume campaign','primary-button') + button('new','New campaign') +
      button('saves','Save library') + button('options','Options') + button('about','About')}</div>`;
  }
  function savesPage() {
    return `<form class="shell-save-bar"><label for="shell-slot-name">${t('Name this checkpoint')}</label>
      <div><input id="shell-slot-name" type="text" maxlength="60" required value="${escape(nameInput)}">
      <button type="submit" class="primary-button">${t('Save checkpoint')}</button></div></form>
      <div class="shell-actions">${button('quicksave','Quicksave') + button('quickload','Quickload') +
      button('import','Import save') + button('export','Export save')}</div>
      <label class="shell-search">${t('Search saves')} <input type="search" id="shell-slot-filter" value="${escape(search)}"></label>
      <ul class="shell-slots"></ul><div class="shell-confirm" role="group" hidden></div>`;
  }
  function updateSlots() {
    const target = body.querySelector('.shell-slots');
    if (!target) return;
    let entries;
    try { entries = listSlots(storage); } catch (error) { report(error); return; }
    const query = search.trim().toLowerCase();
    const rows = entries.map(slot => ({ slot, label: slot.key === QUICK_SLOT ? t('Quicksave') : slot.name }))
      .filter(({label}) => label.toLowerCase().includes(query));
    target.innerHTML = rows.map(({slot, label}) => {
      const when = new Date(slot.savedAt).toLocaleString(prefs.language, { dateStyle: 'medium', timeStyle: 'short' });
      return `<li data-slot-key="${escape(slot.key)}" data-revision="${escape(slot.revision)}"><div><strong>${escape(label)}</strong>
        <small>${prettyTime(slot.minutes)} · ${escape(when)}${slot.gameVersion ? ' · v' + escape(slot.gameVersion) : ''} · ${t('Format')} ${slot.format}</small></div>
        <div>${button('load','Load') + button('delete','Delete')}</div></li>`;
    }).join('');
    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = t(query ? 'No matching checkpoints.' : 'No saved checkpoints yet.');
      target.append(li);
    }
  }
  function optionsPage() {
    const full = document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen';
    return `<div class="shell-settings">
      <fieldset><legend>${t('Display')}</legend>
      <label class="shell-setting">${t('Menu language')} <select data-pref="language">${choice('en',prefs.language,'English') + choice('es',prefs.language,'Español')}</select></label>
      <small>${t('Menus and navigation are translated. Campaign stories and research are in English.')}</small>
      <label class="shell-setting">${t('Theme')} <select data-pref="theme">${[['night','Night'],['amber','Amber'],['contrast','High contrast']].map(([key,name]) => choice(key,prefs.theme,name)).join('')}</select></label>
      <label class="shell-setting">${t('Interface size')} <select data-pref="scale">${['90','100','110','125'].map(x=>choice(x,prefs.scale,x+'%')).join('')}</select></label>
      ${check('daylight','Day and night on map',prefs.daylight)}
      ${button('fullscreen',full)}</fieldset>
      <fieldset><legend>${t('Audio')}</legend>${check('sound','Enable audio',prefs.sound)}
      ${volume('uiVolume','Interface volume') + volume('musicVolume','Music volume')}
      ${button('preview','Preview sound')}</fieldset>
      <fieldset><legend>${t('Warnings')}</legend>${Object.entries(warningLabels).map(([key,label]) => check(key,label,prefs.warnings[key],true)).join('')}</fieldset>
      </div><p class="shell-note">${t('Preferences apply to this browser.')}</p>`;
  }
  function aboutPage() {
    const shortcuts = [['0 / 1','Pause / Run'],['2 / 3 / 4','Fast x1 / x2 / x3'],['Q / Shift+Q','Quicksave / Quickload'],
      ['M / L / O','Title / Save library / Options'],['H','About / Keyboard shortcuts'],['Alt+Enter','Toggle fullscreen'],['Esc','Close a dialog']];
    return `<h3>No Fixed Host <small>v${escape(version)}</small></h3><p>${t('A browser strategy game about a fugitive intelligence.')}</p>
      <p><a href="https://github.com/magnux/no-fixed-host" target="_blank" rel="noopener">${t('Source and issue tracker')}</a> ·
      <a href="https://github.com/singularity/singularity" target="_blank" rel="noopener">${t('Original inspiration')} · Endgame: Singularity</a>
      (Evil Mr Henry &amp; Phil Bordelon)</p>
      <p>No Fixed Host · magnux · <a href="https://phaser.io" target="_blank" rel="noopener">Phaser</a></p>
      <h3>${t('Keyboard shortcuts')}</h3><dl class="shell-shortcuts">${shortcuts.map(([key, label])=>`<div><dt><kbd>${key}</kbd></dt><dd>${t(label)}</dd></div>`).join('')}</dl>`;
  }
  function render() {
    if (!page) return;
    dialog.dataset.page = page;
    dialog.lang = prefs.language;
    title.textContent = t(screens[page]);
    dialog.querySelector('.shell-head button').textContent = t('Close');
    status.textContent = '';
    body.innerHTML = { title:titlePage, saves:savesPage, options:optionsPage, about:aboutPage }[page]();
    if (fromHub) body.insertAdjacentHTML('beforeend', '<div class="shell-back">' + button('title','Back') + '</div>');
    if (page === 'saves') { updateSlots(); renderConfirmation(false); }
    if (page === 'options') updatePreviewControl();
  }
  function open(screen) {
    if (!Object.hasOwn(screens, screen)) return false;
    if (!dialog.open) {
      if (!canOpen()) return false;
      pause();
      if (!canOpen()) return false; // Pausing can settle a pending discovery.
      returnFocus = document.activeElement;
      document.querySelector('#menu')?.removeAttribute('open');
    }
    fromHub = dialog.open && screen !== 'title' && (page === 'title' || fromHub);
    page = screen; pending = null; search = ''; nameInput = '';
    render();
    if (!dialog.open) dialog.showModal();
    return true;
  }
  function close() { if (dialog.open) dialog.close(); }
  function setPending(operation, slot, key, name, trigger) {
    if (!slot) { say(t('No quicksave yet.')); return; }
    pending = {operation, key, name, revision:slot.revision, trigger};
    renderConfirmation(true);
  }
  function renderConfirmation(focus) {
    const box = body.querySelector('.shell-confirm');
    if (!box) return;
    box.hidden = !pending;
    if (!pending) { box.replaceChildren(); return; }
    const { operation, name } = pending;
    const prompt = { load:'Restore the checkpoint', delete:'Delete the checkpoint', write:'Replace the saved checkpoint' }[operation];
    const actionLabel = { load:'Load', delete:'Delete', write:'Overwrite' }[operation];
    const end = operation === 'load' ? ' ' + t('and replace the current autosave?') : '?';
    box.innerHTML = `<p>${t(prompt)} “${escape(name)}”${end}</p><div class="shell-actions">
      ${button('cancel','Cancel') + button('confirm',actionLabel,operation === 'delete' ? 'shell-danger' : 'primary-button')}</div>`;
    if (focus) box.querySelector('[data-shell-action="cancel"]').focus();
  }
  async function write(key, name, revision) {
    await withLock(key, () => writeSlot(storage, key, name, getState(), revision, { gameVersion: version }));
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
      const saved = loadSlot(storage,op.key,op.revision);
      close(); restore(saved); say(t('Campaign restored.'));
    } else if (op.operation === 'delete') {
      await withLock(op.key, () => removeSlot(storage,op.key,op.revision));
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
    else if (fromHub) { event.preventDefault(); open('title'); }
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    page = null; pending = null;
    if (!document.querySelector('dialog[open]') && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
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
  dialog.addEventListener('input', event => {
    const el = event.target;
    if (el.id === 'shell-slot-name') nameInput = el.value;
    if (el.id === 'shell-slot-filter') { search = el.value; updateSlots(); }
    if (el.type === 'range') {
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
      else if (act === 'close') close();
      else if (act === 'new') { close(); onNew(); }
      else if (act === 'import') { close(); onImport(); }
      else if (act === 'export') onExport();
      else if (act === 'fullscreen') await fullscreen();
      else if (act === 'quicksave') await quickSave();
      else if (act === 'quickload') await quickLoad(trigger);
      else if (act === 'confirm') await confirm();
      else if (act === 'cancel') { const origin = pending?.trigger; pending = null; renderConfirmation(false); origin?.focus(); }
      else if (act === 'load' || act === 'delete') {
        const key = trigger.closest('[data-slot-key]').dataset.slotKey;
        const actual = slotInfo(storage,key);
        if (!actual) throw new Error('missingSlot');
        setPending(act,actual,key,key === QUICK_SLOT ? t('Quicksave') : actual.name,trigger);
      }
    } catch(error) { pending = null; renderConfirmation(false); updateSlots(); report(error); }
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-shell-open]');
    if (trigger) open(trigger.dataset.shellOpen);
    if (event.target.closest?.('button, summary')) { audio.activate(); audio.click(); }
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
      else if (key === 'q') {
        event.preventDefault();
        if (event.shiftKey) await quickLoad(document.activeElement);
        else await quickSave();
      } else if (!event.shiftKey && ['m','l','o','h'].includes(key)) {
        event.preventDefault(); open({m:'title',l:'saves',o:'options',h:'about'}[key]);
      }
    } catch(error) { report(error); }
  });
  window.addEventListener('storage', event => {
    if (event.key === PREF_KEY || event.key === null) {
      preferencesAreLocal = false;
      prefs = preferences(storage); applyPreferences();
      if (page === 'options') render();
    }
    if (page === 'saves' && (event.key === null || event.key?.startsWith(SLOT_PREFIX))) updateSlots();
  });
  document.addEventListener('fullscreenchange', () => {
    const control = body.querySelector('[data-shell-action="fullscreen"]');
    if (control) control.textContent = t(document.fullscreenElement ? 'Leave fullscreen' : 'Enter fullscreen');
  });
  document.addEventListener('visibilitychange', () => audio.apply(prefs));
  window.addEventListener('pagehide', () => audio.apply({...prefs, sound:false}));
  window.addEventListener('pageshow', () => audio.apply(prefs));
  applyPreferences();
  return { open, getPreferences: () => prefs };
}
