import { candidates, jumpLimit, layers, pulseJump, selectRelay, startJump, tickJump } from '../migration.js';
import { createMigrationView } from './migration-scene.js';
import './first-jump.css';

const endings = { complete: 'Linked', traced: 'Traced', expired: 'Closed' };
let currentSession = null;

export async function openFirstJump({ closeLabel = 'Close drill', sfx = () => {}, resetAudioRound = () => {} } = {}) {
  if (currentSession) return currentSession;
  const dialog = document.createElement('dialog');
  dialog.className = 'first-jump';
  dialog.setAttribute('aria-labelledby', 'jump-title');
  dialog.setAttribute('aria-describedby', 'jump-brief');
  dialog.innerHTML = `
    <header class="jump-head"><div><p>Migration drill</p><h2 id="jump-title">First Jump</h2></div>
      <button type="button" data-close></button></header>
    <p id="jump-brief">Reach Haven across four links. Choose a lit relay, then tap quickly to build launch speed. In flight, tap to lift and release to fall. Stay near the wire, dodge amber listeners, and line up with the socket.</p>
    <div class="jump-stage" aria-label="Network map and live packet flight"></div>
    <dl class="jump-stats">
      <div><dt>Carrier</dt><dd data-signal></dd></div>
      <div><dt>Links</dt><dd data-links></dd></div>
      <div><dt>Port closes</dt><dd data-clock></dd></div>
    </dl>
    <div class="jump-routes" role="group" aria-label="Choose next relay"></div>
    <div class="jump-actions">
      <button type="button" data-transmit autofocus>Pulse uplink</button>
      <button type="button" data-restart hidden>Restart jump</button>
      <span class="jump-keys">1–3 select · Space pulses</span>
    </div>
    <p class="jump-message" role="status" aria-atomic="true"></p>`;
  const select = selector => dialog.querySelector(selector);
  const stage = select('.jump-stage'), routes = select('.jump-routes'), pulse = select('[data-transmit]');
  const restart = select('[data-restart]'), close = select('[data-close]'), status = select('.jump-message');
  const signal = select('[data-signal]'), count = select('[data-links]'), clock = select('[data-clock]');
  const returnFocus = document.activeElement;
  let state = startJump(), game, previousTime, frameId, routeKey = '', statusKey = '';
  let viewReady = false;
  function set(el, value) { if (el.textContent !== value) el.textContent = value; }
  function choose(index) {
    if (state.phase !== 'docked' || state.outcome !== 'active') return;
    selectRelay(state, index);
    sfx('hold');
    render();
  }
  function render() {
    const active = state.outcome === 'active', docked = state.phase === 'docked';
    const key = [state.hop, state.relay, state.phase, state.outcome].join('/');
    if (routeKey !== key) {
      routes.replaceChildren();
      const options = candidates(state);
      if (active) options.forEach((index, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = `${i + 1} · ${layers[state.hop + 1][index].name}`;
        b.disabled = !docked;
        b.addEventListener('click', () => { choose(index); pulse.focus({ preventScroll: true }); });
        routes.append(b);
      });
      routeKey = key;
    }
    [...routes.children].forEach((b, i) => b.setAttribute('aria-pressed', String(candidates(state)[i] === state.choice)));
    set(signal, !active ? endings[state.outcome] : docked ? Math.floor(state.energy) + '% charged' : (state.offset > 8 ? 'Below wire' : state.offset < -8 ? 'Above wire' : 'On wire'));
    set(count, `${state.hop} / 4`);
    set(clock, Math.max(0, Math.ceil(jumpLimit - state.elapsed)) + ' s');
    dialog.dataset.alert = String(state.outcome === 'traced');
    dialog.dataset.flight = state.phase;
    dialog.dataset.hop = state.hop;
    pulse.hidden = !active;
    restart.hidden = active;
    if (statusKey === key) return;
    statusKey = key;
    if (!active) {
      set(status, state.reason || 'A second copy of you is awake on Haven.');
      restart.focus();
    } else if (!docked) set(status, 'Packet airborne. Tap to rise, coast to fall. Dock inside the mint receiver.');
    else set(status, `${layers[state.hop][state.relay].name} online. Choose your next relay and pulse to launch.`);
  }
  function update(time) {
    const dt = previousTime === undefined ? 0 : Math.min(.1, (time - previousTime) / 1000);
    previousTime = time;
    const oldHop = state.hop, oldOutcome = state.outcome;
    if (viewReady) tickJump(state, dt);
    if (oldOutcome !== state.outcome) sfx({ complete: 'complete', traced: 'failed', expired: 'partial' }[state.outcome]);
    else if (oldHop !== state.hop) sfx('hold');
    render();
    if (dialog.open && !document.hidden && state.outcome === 'active') frameId = requestAnimationFrame(update);
  }
  function schedule() {
    cancelAnimationFrame(frameId);
    previousTime = undefined;
    if (dialog.open && !document.hidden && state.outcome === 'active') frameId = requestAnimationFrame(update);
  }
  function push() {
    if (state.outcome !== 'active' || !viewReady) return;
    pulseJump(state);
    sfx('transmit');
    render();
  }
  pulse.addEventListener('click', push);
  dialog.addEventListener('keydown', event => {
    if (state.outcome !== 'active' || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (event.key === 'Enter' && event.repeat && event.target === pulse) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' && (event.target === close || event.target.closest('.jump-routes'))) return;
    const options = candidates(state);
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) push();
    } else if (/^[123]$/.test(event.key) && options[Number(event.key) - 1] !== undefined) {
      event.preventDefault();
      if (!event.repeat) choose(options[Number(event.key) - 1]);
    } else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (!event.repeat && options.length) choose(options[(options.indexOf(state.choice) + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]);
    }
  });
  restart.addEventListener('click', () => {
    resetAudioRound();
    state = startJump();
    render();
    pulse.focus();
    schedule();
  });
  close.textContent = closeLabel;
  close.addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  dialog.showModal();
  render();
  currentSession = new Promise((resolve, reject) => {
    let loadError;
    document.addEventListener('visibilitychange', schedule);
    dialog.addEventListener('close', () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', schedule);
      game?.destroy(true);
      dialog.remove();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      currentSession = null;
      if (loadError) reject(loadError);
      else resolve(state.outcome === 'active' ? 'abandoned' : state.outcome);
    }, { once: true });
    try {
      game = createMigrationView(stage, () => state, index => { choose(index); pulse.focus({ preventScroll: true }); }, push);
      viewReady = true;
      schedule();
    } catch (error) { loadError = error; dialog.close(); }
  });
  return currentSession;
}
