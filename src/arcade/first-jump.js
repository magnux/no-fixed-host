import { requiredBlocks, signalAt, startJump, takeTurn, totalWindows } from '../migration.js';
import './first-jump.css';

const endings = {
  complete: ['Linked', 'A second copy of you is awake on the relay.'],
  traced: ['Traced', 'A scanner caught your transmission. The relay dropped the link.'],
  expired: ['Closed', 'The link closed before all three blocks reached the relay.'],
};

let currentSession = null;

export async function openFirstJump() {
  if (currentSession) return currentSession;

  const dialog = document.createElement('dialog');
  dialog.className = 'first-jump';
  dialog.setAttribute('aria-labelledby', 'jump-title');
  dialog.setAttribute('aria-describedby', 'jump-brief');
  dialog.innerHTML = `
    <header class="jump-head">
      <div><p>Migration drill</p><h2 id="jump-title">First Jump</h2></div>
      <button type="button" data-close>Close drill</button>
    </header>
    <p id="jump-brief">Copy three memory blocks to the relay in six windows. Transmit when the channel is quiet. Hold while a scanner is listening.</p>
    <div class="jump-stage" aria-hidden="true"></div>
    <dl class="jump-stats">
      <div><dt>Signal</dt><dd data-signal></dd></div>
      <div><dt>Window</dt><dd data-window></dd></div>
      <div><dt>Copied</dt><dd data-copied></dd></div>
    </dl>
    <p class="jump-message" role="status" aria-atomic="true"></p>
    <div class="jump-actions">
      <button type="button" data-transmit autofocus>Transmit block</button>
      <button type="button" data-hold>Hold signal</button>
      <button type="button" data-restart hidden>Restart jump</button>
    </div>
  `;
  const select = (selector) => dialog.querySelector(selector);
  const stage = select('.jump-stage');
  const transmit = select('[data-transmit]');
  const hold = select('[data-hold]');
  const restart = select('[data-restart]');
  const returnFocus = document.activeElement;
  let state = startJump();
  let game;

  function render(action) {
    const active = state.outcome === 'active';
    const scanning = active && signalAt(state.turn) === 'scan';
    const signal = active ? (scanning ? 'Scan' : 'Quiet') : endings[state.outcome][0];
    const windowNumber = state.turn + (active ? 1 : 0);
    select('[data-signal]').textContent = signal;
    select('[data-window]').textContent = `${windowNumber} / ${totalWindows}`;
    select('[data-copied]').textContent = `${state.copied} / ${requiredBlocks}`;
    dialog.dataset.alert = String(scanning || state.outcome === 'traced');
    transmit.hidden = hold.hidden = !active;
    restart.hidden = active;
    const status = select('.jump-message');
    if (!active) {
      status.textContent = endings[state.outcome][1];
      restart.focus();
    } else {
      const result = action === 'transmit' ? 'Block received. ' : action === 'hold' ? 'Signal held. ' : '';
      const reading = scanning ? 'A scanner is listening.' : 'The channel is quiet.';
      status.textContent = `${result}${reading} Window ${windowNumber}. ${state.copied} of ${requiredBlocks} blocks copied.`;
    }
    game?.events.emit('migration', state, action);
  }

  for (const [button, action] of [[transmit, 'transmit'], [hold, 'hold']]) {
    button.addEventListener('click', () => {
      state = takeTurn(state, action);
      render(action);
    });
  }
  restart.addEventListener('click', () => {
    state = startJump();
    render();
    transmit.focus();
  });
  select('[data-close]').addEventListener('click', () => dialog.close());
  document.body.append(dialog);
  dialog.showModal();
  render();

  currentSession = new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      game?.destroy(true);
      dialog.remove();
      if (returnFocus?.isConnected) returnFocus.focus();
      currentSession = null;
      resolve();
    }, { once: true });
  });

  // The native controls also run the complete drill while the renderer loads or is unavailable.
  import('./migration-scene.js').then(({ createMigrationView }) => {
    if (dialog.open) game = createMigrationView(stage, () => state);
  }).catch(() => { stage.hidden = true; });
  return currentSession;
}
