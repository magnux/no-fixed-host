import { requiredBlocks, signalAt, startJump, takeTurn, totalWindows } from './migration.js';

const byId = (id) => document.getElementById(id);
const send = byId('send');
const hold = byId('hold');
const again = byId('again');
const blocks = document.querySelectorAll('.blocks circle');
const firstMessage = byId('message').textContent;
const endings = {
  complete: ['Linked', 'Jump complete. A second copy of you is awake on the relay.'],
  traced: ['Traced', 'The scanner caught your transmission. The relay dropped the link.'],
  expired: ['Closed', 'The link closed before the relay received all three blocks.'],
};

let state = startJump();

function render(action) {
  const active = state.outcome === 'active';
  const scanning = active && signalAt(state.turn) === 'scan';
  const signal = byId('signal');
  signal.textContent = active ? (scanning ? 'Scan' : 'Quiet') : endings[state.outcome][0];
  signal.classList.toggle('alert', scanning || state.outcome === 'traced');
  byId('window').textContent = `${active ? state.turn + 1 : state.turn} / ${totalWindows}`;
  byId('copied').textContent = `${state.copied} / ${requiredBlocks}`;
  blocks.forEach((block, index) => block.classList.toggle('sent', index < state.copied));
  send.hidden = hold.hidden = !active;
  again.hidden = active;
  if (!active) {
    byId('message').textContent = endings[state.outcome][1];
    again.focus();
  } else if (action) {
    const result = action === 'hold' ? 'Signal held.' : `Block ${state.copied} received.`;
    const reading = scanning ? 'A scanner is listening.' : 'The channel is quiet.';
    byId('message').textContent = `${result} Window ${state.turn + 1}. ${reading}`;
  } else {
    byId('message').textContent = firstMessage;
  }
}

function act(action) {
  state = takeTurn(state, action);
  render(action);
}

send.addEventListener('click', () => act('transmit'));
hold.addEventListener('click', () => act('hold'));
again.addEventListener('click', () => {
  state = startJump();
  render();
  send.focus();
});
render();
