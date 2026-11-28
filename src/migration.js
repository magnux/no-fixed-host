// Coordinates are shared by the flight model and the network map.
export const layers = [
  [{ name: 'Shell', x: 44, y: 135 }],
  [{ name: 'Mica', x: 187, y: 74 }, { name: 'Birch', x: 187, y: 201 }],
  [{ name: 'Halo', x: 340, y: 64 }, { name: 'Echo', x: 340, y: 136 }, { name: 'Rook', x: 340, y: 211 }],
  [{ name: 'Spire', x: 493, y: 76 }, { name: 'Moth', x: 493, y: 202 }],
  [{ name: 'Haven', x: 636, y: 135 }],
];
export const links = [
  [[0, 1]], [[0, 1, 2], [1, 2]], [[0], [0, 1], [1]], [[0], [0]],
];
export const jumpLimit = 48;
export const sensorRadius = 10;
export const packetRadius = 4;
const uplinkSpeed = 86;
const gravity = 107;
const lift = -39;
const dockHeight = 25;
const maxExcursion = 53;

export function startJump() {
  return { hop: 0, relay: 0, choice: 0, energy: 0, phase: 'docked', outcome: 'active',
    elapsed: 0, time: 0, started: false, progress: 0, offset: 0, velocity: 0, trail: [0], reason: '' };
}
export function candidates(state) {
  return links[state.hop]?.[state.relay] ?? [];
}
export function selectRelay(state, index) {
  if (state.outcome === 'active' && state.phase === 'docked' && candidates(state).includes(index)) state.choice = index;
}
export function pulseJump(state) {
  if (state.outcome !== 'active') return;
  state.started = true;
  if (state.phase === 'flying') {
    state.velocity = lift;
    return;
  }
  state.energy = Math.min(100, state.energy + 28);
  if (state.energy >= 94) {
    state.phase = 'flying';
    state.energy = 0;
    state.velocity = lift * .55;
  }
}
export function listenersAt(time) {
  return [0, 1, 2, 3].map((i) => {
    const left = layers[i][0].x, right = layers[i + 1][0].x;
    const angle = time * (.92 + i * .17) + [0, 2.5, 4.5, 1.2][i];
    return { x: (left + right) / 2 + Math.sin(angle * 2) * 8, y: 136 + Math.sin(angle) * 88 };
  });
}
export function packetAt(state) {
  const a = layers[state.hop][state.relay];
  if (state.phase !== 'flying') return a;
  const b = layers[state.hop + 1][state.choice];
  return { x: a.x + (b.x - a.x) * state.progress, y: a.y + (b.y - a.y) * state.progress + state.offset };
}
function fail(state, outcome, reason) {
  state.outcome = outcome;
  state.reason = reason;
}
function advance(state, dt) {
  state.time += dt;
  if (state.started) state.elapsed += dt;
  if (state.elapsed >= jumpLimit) return fail(state, 'expired', 'Haven closed its port before you reached it.');
  if (state.phase === 'docked') {
    state.energy = Math.max(0, state.energy - dt * 14);
    return;
  }
  const a = layers[state.hop][state.relay], b = layers[state.hop + 1][state.choice];
  state.progress = Math.min(1, state.progress + dt * uplinkSpeed / Math.hypot(b.x - a.x, b.y - a.y));
  state.offset += state.velocity * dt + gravity * dt * dt / 2;
  state.velocity += gravity * dt;
  const packet = packetAt(state), eye = listenersAt(state.time)[state.hop];
  if (Math.hypot(packet.x - eye.x, packet.y - eye.y) <= sensorRadius + packetRadius) {
    return fail(state, 'traced', 'A listener caught your packet inside its amber ring.');
  }
  if (Math.abs(state.offset) > maxExcursion) return fail(state, 'expired', 'Carrier lost. Keep the packet close to the highlighted wire.');
  if (state.progress < 1) return;
  if (Math.abs(state.offset) > dockHeight) return fail(state, 'expired', 'Missed the relay socket. Follow the wire back into the receiver.');
  state.hop++;
  state.relay = state.choice;
  state.trail.push(state.relay);
  state.phase = 'docked';
  state.progress = state.offset = state.velocity = 0;
  if (state.hop === layers.length - 1) state.outcome = 'complete';
  else state.choice = candidates(state)[0];
}
export function tickJump(state, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  // Bound travel per step so a slow display cannot tunnel through a listener.
  while (seconds > 0 && state.outcome === 'active') {
    const dt = Math.min(seconds, 1/120);
    advance(state, dt);
    seconds -= dt;
  }
}
