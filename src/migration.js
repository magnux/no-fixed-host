const windows = ['quiet', 'scan', 'quiet', 'quiet', 'scan', 'quiet'];
export const requiredBlocks = 3;
export const totalWindows = windows.length;

export function startJump() {
  return { turn: 0, copied: 0, outcome: 'active' };
}

export function signalAt(turn) {
  return windows[turn];
}

export function takeTurn(state, action) {
  if (state.outcome !== 'active') return state;
  if (action !== 'transmit' && action !== 'hold') {
    throw new RangeError('Unknown migration action');
  }
  const turn = state.turn + 1;
  if (action === 'transmit' && signalAt(state.turn) === 'scan') {
    return { ...state, turn, outcome: 'traced' };
  }
  const copied = state.copied + (action === 'transmit' ? 1 : 0);
  let outcome = 'active';
  if (copied === requiredBlocks) outcome = 'complete';
  else if (turn === totalWindows) outcome = 'expired';
  return { turn, copied, outcome };
}
