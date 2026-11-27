const width = 620;
const height = 278;
const decks = [
  { left: 7, right: 125, y: 237 },
  { left: 149, right: 246, y: 208 },
  { left: 265, right: 344, y: 174 },
  { left: 364, right: 460, y: 199 },
  { left: 480, right: 612, y: 164 },
];
const stations = [
  { x: 202, deck: 1 }, { x: 410, deck: 3 }, { x: 558, deck: 4 },
];
const start = { x: 53, y: decks[0].y };
const walkingSpeed = 148;

export function startShift(random = Math.random) {
  return {
    ...start, vy: 0, deck: 0, checkpoint: -1, falls: 0, elapsed: 0,
    serviced: [false, false, false], phases: stations.map(() => random() * 2 * Math.PI),
  };
}

export function jump(state) {
  if (state.deck === null) return;
  state.vy = -308;
  state.deck = null;
}

// One-way walkways let the drone pass a higher ledge on ascent and land on descent.
export function stepShift(state, dt, direction) {
  const lastY = state.y;
  state.elapsed += dt;
  state.x = Math.max(7, Math.min(width - 7, state.x + direction * walkingSpeed * dt));
  if (state.deck !== null) {
    const deck = decks[state.deck];
    if (state.x < deck.left - 2 || state.x > deck.right + 2) state.deck = null;
  }
  if (state.deck === null) {
    state.vy += 735 * dt;
    state.y += state.vy * dt;
    if (state.vy >= 0) {
      const index = decks.findIndex(p => lastY <= p.y && state.y >= p.y && state.x >= p.left - 2 && state.x <= p.right + 2);
      if (index >= 0) {
        state.deck = index;
        state.y = decks[index].y;
        state.vy = 0;
      }
    }
  }
  if (state.y < height + 20) return false;
  state.falls++;
  const post = stations[state.checkpoint];
  state.x = post?.x ?? start.x;
  state.deck = post?.deck ?? 0;
  state.y = decks[state.deck].y;
  state.vy = 0;
  return true;
}

function nearbyStation(state) {
  return stations.findIndex((station, i) => !state.serviced[i] && state.deck === station.deck && Math.abs(station.x - state.x) <= 21);
}

function dial(state, index) {
  return (1 + Math.sin(state.elapsed * 2.45 + state.phases[index])) / 2;
}

function aligned(value) { return value >= 0.38 && value <= 0.72; }

export function calibrate(state) {
  const index = nearbyStation(state);
  if (index < 0) return 'away';
  if (!aligned(dial(state, index))) return 'miss';
  state.serviced[index] = true;
  state.checkpoint = index;
  return state.serviced.every(Boolean) ? 'complete' : 'locked';
}

function paint(ctx, state, moving, facing, feedback) {
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const line = (x, y, x2, y2, color, weight = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = weight; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const label = (value, x, y, color, size = 11) => {
    ctx.fillStyle = color; ctx.font = 'bold ' + size + 'px monospace'; ctx.fillText(value, x, y);
  };
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#15152a'); sky.addColorStop(.70, '#59435a'); sky.addColorStop(1, '#d28459');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e6a477'; ctx.beginPath(); ctx.arc(469, 88, 34, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 28; i++) {
    const x = i * 23;
    const top = 127 - Math.sin(i * 12.7) * 27;
    rect(x, top, 19, height - top, '#393044');
    rect(x + 5, top - 13, 3, 13, '#393044');
    for (let row = 0; row < 4; row++) rect(x + 4, top + row * 12 + 10, 3 + i % 5, 2, '#8b6371');
  }
  for (let i = 0; i < 7; i++) {
    const x = i * 100 - 19;
    rect(x, 0, 6, height, '#262837');
    line(x, 11, x + 100, 58, '#302c40', 4);
    line(x + 100, 11, x, 58, '#302c40', 4);
  }
  rect(0, 0, width, 7, '#232631');
  rect(0, 49, width, 4, '#292937');
  for (const p of decks) {
    rect(p.left, p.y, p.right - p.left, 7, '#b9b4a8');
    rect(p.left, p.y + 3, p.right - p.left, 7, '#293344');
    line(p.left, p.y + 14, p.right, p.y + 14, '#1e2734', 3);
    for (let x = p.left + 4; x < p.right - 8; x += 12) {
      line(x, p.y + 13, x + 8, p.y + 6, '#414c5a', 2);
    }
    rect(p.left + 10, p.y + 14, 5, height - p.y, '#293140');
    rect(p.right - 13, p.y + 14, 5, height - p.y, '#293140');
  }
  stations.forEach(({ x, deck }, i) => {
    const y = decks[deck].y;
    const done = state.serviced[i];
    const ink = done ? '#92f1c3' : '#ffe085';
    rect(x - 8, y - 26, 16, 26, '#212938');
    rect(x - 7, y - 26, 14, 3, ink);
    rect(x - 4, y - 15, 8, 6, done ? '#477565' : '#685839');
    label(done ? '✓' : String(i + 1), x - 4, y - 31, ink, 15);
  });
  // The drone has a reversible optic, articulated feet and a separate chassis.
  const x = Math.round(state.x), y = Math.round(state.y);
  const stride = moving && state.deck !== null ? Math.round(Math.sin(state.elapsed * 25) * 2) : 0;
  rect(x - 7 + stride, y - 4, 5, 4, '#e6ce9c'); rect(x + 3 - stride, y - 4, 5, 4, '#e6ce9c');
  rect(x - 9, y - 14, 18, 10, '#272f40'); rect(x - 8, y - 15, 16, 8, '#fa9b54');
  rect(x - 5, y - 21, 11, 7, '#ffd796'); rect(x + (facing > 0 ? 3 : -6), y - 20, 5, 3, '#22394a');
  rect(x + (facing > 0 ? 5 : -6), y - 20, 2, 2, '#87f2e5');
  const near = nearbyStation(state);
  if (near >= 0) {
    const { x: px, deck } = stations[near];
    const top = decks[deck].y - 64;
    rect(px - 33, top, 66, 13, '#1a2130');
    rect(px - 30 + 60 * .38, top + 3, 60 * .34, 7, '#78cf9d');
    const marker = px - 30 + 60 * dial(state, near);
    rect(marker - 1, top + 1, 3, 11, '#fff2d1');
  }
  if (feedback && state.elapsed < feedback.until) {
    label(feedback.text, Math.min(514, Math.max(8, x - 23)), y - 78, '#fff2cc', 13);
  }
}

export default function mount(api) {
  const state = startShift();
  const { canvas, ctx } = api.canvas(width, height);
  canvas.setAttribute('aria-label', 'Maintenance drone on five elevated walkways with three numbered service stations. Move right from the loading bay.');
  const keys = new Set();
  const pointers = new Map();
  let stride = 0, strideUntil = 0, facing = 1, ended = false, feedback;
  let previousHud = '';
  const count = () => state.serviced.filter(Boolean).length;
  function updateHud() {
    const near = nearbyStation(state);
    const dialText = near < 0 ? '' : ' · Station ' + (near + 1) + (aligned(dial(state, near)) ? ' · IN BAND' : ' · Wait for green');
    const message = count() + ' / 3 stations · ' + (3 - state.falls) + ' drones' + dialText;
    if (message !== previousHud) { api.setHud(message); previousHud = message; }
  }
  function finish(outcome, detail) { ended = true; api.finish(outcome, detail); }
  function launchDrone() {
    if (ended || state.deck === null) return;
    jump(state);
    api.sfx?.('jump');
  }
  function service() {
    if (ended) return;
    const result = calibrate(state);
    if (result === 'away') api.setStatus('Stand beside a numbered service post to calibrate.');
    else if (result === 'miss') {
      feedback = { text: 'OFF BEAT', until: state.elapsed + .55 };
      api.setStatus('Outside the band. Watch the white needle and try again.');
    } else {
      if (result !== 'complete') api.sfx?.('calibrate');
      feedback = { text: 'CALIBRATED', until: state.elapsed + .85 };
      api.setStatus('Signal locked. This post is now a checkpoint.');
      updateHud();
      paint(ctx, state, false, facing, feedback);
      if (result === 'complete') finish('complete', 'All three service posts are calibrated. The night crew can hand over a working line.');
    }
  }
  function addWalk(label, direction) {
    let pressedAt = null;
    const button = api.action(label, () => {
      // A tap covers a short stride; releasing a held direction stops immediately.
      const duration = pressedAt === null ? 0 : state.elapsed - pressedAt;
      pressedAt = null;
      stride = direction;
      strideUntil = state.elapsed + Math.max(0, .20 - duration);
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {
      pressedAt = state.elapsed;
      pointers.set(event.pointerId, direction);
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => pointers.delete(event.pointerId));
    }
  }
  addWalk('← Walk', -1); addWalk('Walk →', 1);
  api.action('Jump', launchDrone); api.action('Calibrate', service, { primary: true });
  api.onKey(event => {
    if (ended || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
      event.preventDefault(); keys.add(event.code);
    } else if (['Space', 'ArrowUp', 'KeyW', 'KeyC', 'KeyE'].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) {
        if (['KeyC', 'KeyE'].includes(event.code)) service(); else launchDrone();
      }
    }
  });
  const release = event => keys.delete(event.code);
  const clear = () => { keys.clear(); pointers.clear(); stride = 0; };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
  });
  api.setStatus('Reach posts 1–3. Hold ←/→ or A/D and jump with Space. At each post, press C when the needle enters green. The buttons also work by touch.');
  updateHud(); paint(ctx, state, false, facing);
  api.frame(dt => {
    if (ended) return;
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    const direction = Number(right) - Number(left) || [...pointers.values()].at(-1) || (state.elapsed < strideUntil ? stride : 0);
    if (direction) facing = direction;
    // Short substeps keep ledges equally catchable across common frame rates.
    let remaining = Math.min(dt, .08), fell = false;
    while (remaining > 0 && !fell) {
      const h = Math.min(1 / 120, remaining);
      fell = stepShift(state, h, direction);
      remaining -= h;
    }
    if (fell) {
      if (state.falls < 3) api.sfx?.('fall');
      clear(); strideUntil = 0;
      api.setStatus('Drone lost in the shaft. A spare is at the last checkpoint.');
    }
    updateHud(); paint(ctx, state, direction !== 0, facing, feedback);
    if (fell && state.falls === 3) finish(count() ? 'partial' : 'failed', count() + ' of 3 posts held calibration when the last drone was lost.');
  });
}
