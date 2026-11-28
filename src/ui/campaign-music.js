// Campaign recordings stay on this browser. The campaign save contains no media.
export const MUSIC_CLASSES = { normal: 'Campaign', victory: 'Victory', defeat: 'Defeat' };

const scores = {
  normal: [[50, 57, 60, 55, 53, 60, 57, 52], [45, 52, 57, 59, 55, 52, 50, 47], [48, 55, 62, 60, 55, 53, 52, 55]],
  victory: [[55, 62, 67, 66, 64, 71, 69, 67], [60, 64, 67, 71, 69, 67, 62, 67]],
  defeat: [[50, 53, 52, 48, 46, 45, 43, 38], [45, 48, 47, 43, 41, 40, 38, 33]],
};

function musicStore(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('no-fixed-host.soundtracks', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('music');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('music', mode);
      const query = operation(tx.objectStore('music'));
      tx.oncomplete = () => { db.close(); resolve(query.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

export function createCampaignMusic() {
  let mode = 'normal', level = 0, media = null, url = '', phrase = 0, step = 0;
  let index = 0;
  const playlists = new Map();
  const broken = new Set();

  function release() {
    if (media) {
      media.onended = media.onerror = null;
      media.pause();
      media.removeAttribute('src');
      media.load();
      media = null;
    }
    if (url) URL.revokeObjectURL(url);
    url = '';
  }
  function choose() {
    const files = playlists.get(mode) || [];
    if (!files.length || !level) return;
    for (let n = 0; n < files.length; n++) {
      const file = files[index++ % files.length];
      if (broken.has(file)) continue;
      media = new Audio();
      url = URL.createObjectURL(file);
      media.src = url;
      media.volume = level;
      media.onended = () => { release(); play(); };
      media.onerror = () => { broken.add(file); release(); play(); };
      break;
    }
  }
  function play() {
    if (!media) choose();
    if (media?.paused && level) media.play().catch(() => {});
  }
  function setMode(next) {
    if (mode === next || !Object.hasOwn(scores, next)) return false;
    release();
    mode = next;
    index = Math.floor(Math.random() * (playlists.get(mode)?.length || 1));
    phrase = step = 0;
    play();
    return true;
  }
  function setLevel(value) {
    level = value;
    if (!value) { media?.pause(); return; }
    if (media) media.volume = value;
    play();
  }
  function note() {
    if (media) { play(); return null; }
    const choices = scores[mode], line = choices[phrase];
    const pitch = line[step];
    const bass = step === 0 || step === 4;
    if (++step === line.length) {
      step = 0;
      phrase = (phrase + 1 + Math.floor(Math.random() * (choices.length - 1))) % choices.length;
    }
    return { frequency: 440 * 2 ** ((pitch - 69) / 12), bass };
  }
  async function load() {
    try {
      const stored = await musicStore('readonly', store => store.getAll());
      for (const record of stored) playlists.set(record.mode, record.files);
      play();
    } catch { /* The included score works when local media storage is unavailable. */ }
  }
  async function replace(target, files) {
    if (!Object.hasOwn(scores, target)) throw new Error('Unknown music category');
    const probe = new Audio();
    if (files.some(file => !(file instanceof Blob) || !(probe.canPlayType(file.type) || /\.(mp3|ogg|wav|m4a|flac|opus)$/i.test(file.name)))) {
      throw new Error('Unsupported audio file.');
    }
    await ready;
    await musicStore('readwrite', store => files.length ? store.put({mode:target, files}, target) : store.delete(target));
    for (const old of playlists.get(target) || []) broken.delete(old);
    playlists.set(target, files);
    if (target === mode) { release(); index = 0; play(); }
  }
  const ready = load();
  return { ready, setMode, setLevel, note, replace, names: key => (playlists.get(key) || []).map(file => file.name) };
}

export function soundtrackControls(t) {
  return `<details class="soundtrack-settings"><summary>${t('Campaign soundtrack')}</summary>
    <label>${t('Music for')} <select data-music-class>${Object.entries(MUSIC_CLASSES).map(([id,name]) => '<option value="' + id + '">' + t(name) + '</option>').join('')}</select></label>
    <small data-music-names></small><input type="file" accept="audio/*,.ogg,.mp3" multiple hidden data-music-files aria-label="${t('Local audio files')}">
    <button type="button" data-choose-music>${t('Choose audio files')}</button>
    <small data-music-selection aria-live="polite">${t('No files selected')}</small>
    <div class="shell-actions"><button type="button" data-save-music disabled>${t('Save playlist')}</button>
    <button type="button" data-reset-music>${t('Use built-in music')}</button></div></details>`;
}

export function bindSoundtrackControls(root, music, t, say) {
  const refresh = () => {
    const select = root.querySelector('[data-music-class]');
    if (!select) return;
    const names = music.names(select.value);
    root.querySelector('[data-music-names]').textContent = names.length ? names.join(' · ') : t('Built-in score');
    root.querySelector('[data-reset-music]').disabled = !names.length;
    const files = Array.from(root.querySelector('[data-music-files]').files);
    root.querySelector('[data-music-selection]').textContent = files.length ? files.map(file => file.name).join(' · ') : t('No files selected');
    root.querySelector('[data-save-music]').disabled = !files.length;
  };
  root.addEventListener('toggle', e => { if (e.target.matches('.soundtrack-settings') && e.target.open) music.ready.then(refresh); }, true);
  root.addEventListener('change', e => {
    if (e.target.matches('[data-music-class]')) root.querySelector('[data-music-files]').value = '';
    if (e.target.matches('[data-music-files],[data-music-class]')) refresh();
  });
  root.addEventListener('click', async e => {
    if (e.target.closest('[data-choose-music]')) {
      root.querySelector('[data-music-files]').click();
      return;
    }
    const button = e.target.closest('[data-save-music],[data-reset-music]');
    if (!button) return;
    const select = root.querySelector('[data-music-class]');
    const upload = root.querySelector('[data-music-files]');
    button.disabled = true;
    try {
      await music.replace(select.value, button.hasAttribute('data-reset-music') ? [] : [...upload.files]);
      upload.value = '';
      say(t('Playlist saved in this browser.'));
    } catch { say(t('Could not save the playlist. Check the audio format and available browser storage.')); }
    refresh();
  });
}
