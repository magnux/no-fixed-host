import './practice.css';

const resultLabels = { complete: 'Completed', partial: 'Partial result', failed: 'Attempt ended' };
let currentSession;

export async function openPractice(game, mount, { closeLabel = 'Back to tester', radio, sfx, resetAudioRound, setMusicMode } = {}) {
  if (currentSession) return currentSession;

  const returnFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'arcade-practice';
  dialog.dataset.practiceGame = game.id;
  dialog.setAttribute('aria-labelledby', 'practice-title');
  dialog.setAttribute('aria-describedby', 'practice-brief');
  dialog.innerHTML = `
    <header class="practice-head">
      <div><p class="practice-genre"></p><h2 id="practice-title"></h2></div>
      <button type="button" data-practice-back></button>
    </header>
    <div class="practice-body">
      <p id="practice-brief"></p>
      <p class="practice-hud" data-hud></p>
      <div class="practice-stage" data-stage></div>
      <div class="practice-controls" data-controls></div>
      <div class="practice-footer">
        <div class="practice-status" role="status" aria-atomic="true">
          <strong data-result></strong><span data-status></span>
        </div>
        <button type="button" data-retry>Retry</button>
      </div>
    </div>`;
  const el = selector => dialog.querySelector(selector);
  el('.practice-genre').textContent = game.category;
  el('#practice-title').textContent = game.title;
  el('#practice-brief').textContent = game.brief;
  const back = el('[data-practice-back]');
  const retry = el('[data-retry]');
  const hud = el('[data-hud]');
  const result = el('[data-result]');
  const status = el('[data-status]');
  back.textContent = closeLabel;
  let outcome = 'abandoned';
  let dispose;
  let mountError;

  function start() {
    dispose?.();
    // A prototype can bind events directly to its stage or controls.
    // Replace both roots so a replay gets a completely new set of listeners.
    const stage = document.createElement('div');
    stage.className = 'practice-stage';
    stage.dataset.stage = '';
    stage.tabIndex = -1;
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', game.title + ' play area');
    const controls = document.createElement('div');
    controls.className = 'practice-controls';
    controls.dataset.controls = '';
    el('[data-stage]').replaceWith(stage);
    el('[data-controls]').replaceWith(controls);
    hud.textContent = status.textContent = result.textContent = '';
    dialog.dataset.outcome = 'active';
    outcome = 'abandoned';

    let active = true;
    let frameId = 0;
    let previousTime = null;
    let elapsed = 0;
    const cleanups = [];
    const frames = [];
    const keys = [];
    function tick(time) {
      frameId = 0;
      if (!active || !dialog.open || document.hidden) return;
      const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      elapsed += dt;
      for (const handler of frames) {
        handler(dt, elapsed);
        if (!active) return;
      }
      frameId = requestAnimationFrame(tick);
    }
    function scheduleFrame() {
      if (active && frames.length && !frameId && !document.hidden) frameId = requestAnimationFrame(tick);
    }
    function visibilityChanged() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previousTime = null;
      scheduleFrame();
    }
    function keydown(event) {
      if (!dialog.open) return;
      if (!dialog.contains(event.target)) {
        // A focused control that disables itself returns keyboard focus to the body.
        if (event.target !== document.body || [...document.querySelectorAll('dialog:modal')].at(-1) !== dialog) return;
        stage.focus({ preventScroll: true });
      }
      if (!active || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'Escape' || event.key === 'Tab') return;
      if (event.target === back || event.target === retry) return;
      if (event.target.closest?.('input,select,textarea,[contenteditable="true"]')) return;
      for (const handler of keys) {
        handler(event);
        if (!active) return;
      }
    }
    document.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', visibilityChanged);
    dispose = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibilityChanged);
      for (const callback of cleanups.reverse()) {
        try { callback(); } catch (error) { console.error(error); }
      }
    };
    function finish(next, detail = '') {
      if (!active || !Object.hasOwn(resultLabels, next)) return;
      outcome = next;
      sfx?.(next);
      dialog.dataset.outcome = next;
      result.textContent = game.outcomes?.[next] ?? resultLabels[next];
      status.textContent = detail;
      stage.inert = controls.inert = true;
      dispose();
      retry.focus();
    }
    function update(target, text) {
      if (active && target.textContent !== text) target.textContent = text;
    }
    function action(label, callback, { primary = false } = {}) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (primary) button.className = 'practice-primary';
      button.addEventListener('click', event => { if (active) callback(event); });
      controls.append(button);
      return button;
    }
    function canvas(width, height) {
      const surface = document.createElement('canvas');
      surface.width = width;
      surface.height = height;
      stage.append(surface);
      return { canvas: surface, ctx: surface.getContext('2d') };
    }
    try {
      mount({
        stage, controls, canvas, action, finish, radio, sfx, setMusicMode,
        setHud: text => update(hud, text),
        setStatus: text => update(status, text),
        onKey: handler => keys.push(handler),
        frame(handler) { frames.push(handler); scheduleFrame(); },
        onCleanup: handler => cleanups.push(handler),
      });
      if (active) {
        stage.focus({ preventScroll: true });
        dialog.scrollTop = 0;
      }
    } catch (error) {
      mountError = error;
      dialog.close();
    }
  }

  back.addEventListener('click', () => dialog.close());
  retry.addEventListener('click', () => { resetAudioRound?.(); start(); });
  document.body.append(dialog);
  try {
    dialog.showModal();
    currentSession = new Promise((resolve, reject) => {
      dialog.addEventListener('close', () => {
        dispose?.();
        if (mountError) reject(mountError);
        else resolve(outcome);
      }, { once: true });
    });
    start();
    return await currentSession;
  } finally {
    dialog.remove();
    currentSession = undefined;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
}
