const width = 600, height = 284;
const boulevard = [
  [86, 224], [497, 224], [523, 215], [536, 194], [536, 94], [527, 75],
  [506, 63], [105, 63], [82, 74], [69, 96], [69, 146],
];
const depot = [[218, 224], [276, 178], [267, 141], [334, 63]];
const gates = [
  { x: 185, y: 224, label: 'Pick up', horizontal: false },
  { x: 302, y: 63, label: 'Quay', horizontal: false },
  { x: 69, y: 145, label: 'Drop', horizontal: true },
];
const deadline = 22;
const lastCall = 36;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

function segmentDistance(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function nearRoad(x, y, road, radius) {
  return road.some((point, index) => index && segmentDistance(x, y, road[index - 1], point) <= radius);
}

const drivable = (x, y) => nearRoad(x, y, boulevard, 18) || nearRoad(x, y, depot, 9.5);

// The clock and trace start only when the player dispatches the courier.
export function createRace() {
  return { phase: 'ready', x: 88, y: 224, angle: 0, speed: 0, time: 0, gate: 0,
    shortcut: false, scrape: 0, trace: [] };
}

function record(race) {
  race.trace.push({ t: race.time, x: race.x, y: race.y, angle: race.angle });
}

export function dispatch(race) {
  if (race.phase !== 'ready') return;
  race.phase = 'racing';
  record(race);
}

export function stepRace(race, input, dt) {
  if (race.phase !== 'racing' || dt <= 0) return;
  race.time += dt;
  race.scrape = Math.max(0, race.scrape - dt);
  if (input.brake) race.speed = Math.max(0, race.speed - 175 * dt);
  else if (input.gas) race.speed = Math.min(102, race.speed + 65 * dt);
  else race.speed = Math.max(0, race.speed - 48 * dt);

  // Slowing down tightens the steering radius in the tram depot's chicane.
  const steering = 3.35 - 1.35 * race.speed / 102;
  race.angle = wrapAngle(race.angle + clamp(input.turn || 0, -1, 1) * steering * dt);
  const dx = Math.cos(race.angle) * race.speed * dt;
  const dy = Math.sin(race.angle) * race.speed * dt;
  if (drivable(race.x + dx, race.y + dy)) {
    race.x += dx;
    race.y += dy;
  } else {
    if (drivable(race.x + dx, race.y)) race.x += dx;
    if (drivable(race.x, race.y + dy)) race.y += dy;
    race.speed *= Math.exp(-7 * dt);
    race.scrape = 0.2;
  }
  if (race.gate === 1 && nearRoad(race.x, race.y, depot.slice(1, 3), 13)) race.shortcut = true;
  const target = gates[race.gate];
  const along = target.horizontal ? race.y - target.y : race.x - target.x;
  const across = target.horizontal ? race.x - target.x : race.y - target.y;
  if (Math.abs(along) <= 8 && Math.abs(across) <= 21) {
    race.gate++;
    if (race.gate === gates.length) {
      race.phase = race.time <= deadline ? 'complete' : 'partial';
    }
  }
  if (race.phase === 'racing' && race.time >= lastCall) race.phase = 'failed';
  if (race.phase !== 'racing' || race.time - race.trace.at(-1).t >= 0.09) record(race);
  return race.phase;
}

export function recordBest(previous, race) {
  if (!['complete', 'partial'].includes(race.phase) || (previous && previous.time <= race.time)) return previous;
  return { time: race.time, trace: race.trace };
}

export function ghostAt(recording, time) {
  if (!recording || time > recording.time || time < 0) return null;
  const trace = recording.trace;
  let low = 0, high = trace.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (trace[middle].t <= time) low = middle;
    else high = middle;
  }
  const a = trace[low], b = trace[high];
  const mix = b.t === a.t ? 0 : clamp((time - a.t) / (b.t - a.t), 0, 1);
  return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix,
    angle: a.angle + wrapAngle(b.angle - a.angle) * mix };
}

// Tapping road ahead provides a one-finger steering and throttle option.
// It follows the player's chosen waypoints. It cannot navigate corners by itself.
export function steerTo(race, point) {
  const distance = Math.hypot(point.x - race.x, point.y - race.y);
  if (distance < 5) return { brake: true, turn: 0 };
  const offset = wrapAngle(Math.atan2(point.y - race.y, point.x - race.x) - race.angle);
  const desiredSpeed = Math.min(100, Math.sqrt(150 * Math.max(0, distance - 3))) / (1 + Math.abs(offset));
  return { gas: race.speed <= desiredSpeed && Math.abs(offset) < 1.2, brake: race.speed > desiredSpeed + 2,
    turn: clamp(offset * 3.8, -1, 1) };
}

function roadPath(ctx, road, color, thickness, dash = []) {
  ctx.beginPath();
  road.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineWidth = thickness;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function scenery(ctx) {
  ctx.fillStyle = '#101927'; ctx.fillRect(0, 0, width, height);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 13; col++) {
      const x = col * 49 + 3, y = row * 40 - 18;
      const tile = (col * 3 + row * 5) % 7;
      ctx.fillStyle = '#081421'; ctx.fillRect(x + 3, y + 5, 42, 30);
      ctx.fillStyle = ['#263648', '#253344', '#293b4b'][tile % 3]; ctx.fillRect(x, y, 40, 27);
      ctx.fillStyle = '#36485b'; ctx.fillRect(x, y, 40, 2);
      ctx.fillStyle = '#192938'; ctx.fillRect(x + 7, y + 6, 19, 13);
      ctx.fillStyle = tile % 2 ? '#877854' : '#5b8184';
      for (let i = 0; i < 4; i++) if ((tile + i) % 3) ctx.fillRect(x + 3 + 9 * i, y + 28, 4, 2);
      ctx.fillStyle = '#3f5261'; ctx.fillRect(x + 29, y + 4, 6, 7);
    }
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  roadPath(ctx, boulevard, '#121b28', 58);
  roadPath(ctx, boulevard, '#577078', 52);
  roadPath(ctx, boulevard, '#344150', 49);
  roadPath(ctx, boulevard, '#56616b', 1.4, [10, 9]);
  roadPath(ctx, depot, '#4e454c', 32);
  roadPath(ctx, depot, '#9d8060', 27);
  roadPath(ctx, depot, '#3a3844', 24);
  ctx.save();
  for (const offset of [-4.5, 4.5]) {
    ctx.save(); ctx.translate(offset, 0); roadPath(ctx, depot, '#7b737b', 1.3); ctx.restore();
  }
  ctx.restore();
  const chevron = (x, y, angle, color) => {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3,-3); ctx.lineTo(1,0); ctx.lineTo(-3,3); ctx.stroke(); ctx.restore();
  };
  for (const x of [127, 375, 457]) chevron(x, 224, 0, '#94aab2');
  for (const x of [402, 224, 152]) chevron(x, 63, Math.PI, '#94aab2');
  chevron(536, 142, -Math.PI / 2, '#94aab2');
  chevron(243, 204, -.68, '#ffc77e'); chevron(294, 109, -.85, '#ffc77e');
  function sign(x, y, text, tint) {
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#172431'; ctx.fillRect(x - 4, y - 10, ctx.measureText(text).width + 8, 14);
    ctx.fillStyle = tint; ctx.fillText(text, x, y);
  }
  sign(337, 195, 'MARKET BLVD', '#adc4c1');
  sign(177, 153, 'TRAM DEPOT', '#f0bb7d');
  sign(161, 34, 'NORTH QUAY', '#8db6c1');
  sign(21, 176, 'HANDOFF', '#fcbc9a');
  for (let i = 0; i < 140; i++) {
    const x = (i * 83 + 17) % width, y = (i * 103) % height;
    ctx.fillStyle = '#91bedc22'; ctx.fillRect(x, y, 1, 3);
  }
}

function car(ctx, car, ghost = false) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = ghost ? '#8cf7ef66' : '#090f19';
  ctx.fillRect(-9, -6, 18, 12);
  ctx.fillStyle = ghost ? '#7ddadd99' : '#fd805c';
  ctx.fillRect(-9, -4.5, 15, 9); ctx.fillRect(6, -3.5, 3, 7);
  ctx.fillStyle = ghost ? '#d1ffffaa' : '#98e4e8'; ctx.fillRect(0, -3.5, 4, 7);
  ctx.fillStyle = ghost ? '#7ddadd99' : '#ffc493'; ctx.fillRect(-6, -3, 3, 6);
  ctx.fillStyle = '#f6e4a5'; ctx.fillRect(7, -4, 2.5, 2); ctx.fillRect(7, 2, 2.5, 2);
  ctx.restore();
}

function paint(ctx, back, race, best, pointer) {
  ctx.drawImage(back, 0, 0);
  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i], active = i === race.gate;
    const color = active ? '#ffe389' : i < race.gate ? '#79d8ac' : '#7cabb4';
    ctx.save(); ctx.translate(gate.x, gate.y); if (gate.horizontal) ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = active ? 0.96 : 0.65;
    ctx.fillStyle = color;
    for (let j = -3; j < 3; j++) ctx.fillRect((j % 2) * 2, j * 6, 3, 5);
    ctx.fillRect(-4, -21, 10, 3); ctx.fillRect(-4, 18, 10, 3); ctx.restore();
    if (active) {
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      const text = gate.label.toUpperCase();
      const center = gate.horizontal ? gate.x + 42 : gate.x;
      const y = gate.horizontal ? gate.y + 4 : gate.y - 27;
      ctx.fillStyle = '#1c2631'; ctx.fillRect(center - ctx.measureText(text).width / 2 - 3, y - 11, ctx.measureText(text).width + 6, 15);
      ctx.fillStyle = color; ctx.fillText(text, center, y); ctx.textAlign = 'left';
    }
  }
  if (pointer) {
    ctx.strokeStyle = '#ffd68c'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 5, 0, Math.PI * 2); ctx.stroke();
  }
  const ghost = ghostAt(best, race.time);
  if (ghost && race.phase !== 'ready') car(ctx, ghost, true);
  if (race.scrape) {
    ctx.fillStyle = '#ffd785'; ctx.fillRect(race.x - 10, race.y - 7, 3, 2);
  }
  car(ctx, race);
}

let personalBest = null;

export default function mount(api) {
  const race = createRace(), best = personalBest;
  const { canvas, ctx } = api.canvas(width, height);
  const back = document.createElement('canvas'); back.width = width; back.height = height;
  scenery(back.getContext('2d'));
  canvas.style.touchAction = 'none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Courier starts heading east. The boulevard bends north and west to the quay. The tram depot cuts northwest from the fork. The handoff is on the west side.');
  const keys = new Set(), contacts = new Map(), pulses = new Map();
  let aim = null;
  const bindings = { ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left',
    KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function begin() {
    if (race.phase !== 'ready') return;
    dispatch(race);
    api.sfx?.('ignition');
    if (document.activeElement === start) api.stage.focus({ preventScroll: true });
    start.disabled = true;
  }
  const start = api.action('Dispatch courier', begin, { primary: true });
  function control(label, kind) {
    const button = api.action(label, e => {
      if (e.detail !== 0 && e.pointerType) return;
      begin(); aim = null; pulses.set(kind, race.time + .18);
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      begin(); aim = null; button.setPointerCapture(e.pointerId);
      contacts.set(e.pointerId, kind); pulses.set(kind, race.time + .12);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(event, e => contacts.delete(e.pointerId));
  }
  control('Steer left', 'left'); control('Steer right', 'right'); control('Accelerate', 'gas'); control('Brake', 'brake');
  function target(event) {
    const box = canvas.getBoundingClientRect();
    aim = { x: (event.clientX - box.left) * width / box.width, y: (event.clientY - box.top) * height / box.height };
  }
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    begin(); canvas.setPointerCapture(e.pointerId); target(e);
  });
  canvas.addEventListener('pointermove', e => { if (canvas.hasPointerCapture(e.pointerId)) target(e); });
  api.onKey(e => {
    if (!bindings[e.code]) return;
    e.preventDefault(); begin(); aim = null; keys.add(e.code);
  });
  const release = e => keys.delete(e.code);
  const clear = () => { keys.clear(); contacts.clear(); pulses.clear(); aim = null; };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release); window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear); clear();
  });
  const held = kind => [...keys].some(code => bindings[code] === kind) || [...contacts.values()].includes(kind) || pulses.get(kind) > race.time;
  function hud() {
    const bestTime = best ? ` · Best ${best.time.toFixed(1)}s` : '';
    let clock = race.time.toFixed(1) + 's / ' + deadline + 's';
    if (race.time > deadline) clock = 'Late · ' + Math.max(0, lastCall - race.time).toFixed(1) + 's left';
    api.setHud(`${clock} · ${Math.round(race.speed)} km/h · ${gates[race.gate]?.label ?? 'Delivered'}${bestTime}`);
  }
  hud(); paint(ctx, back, race, best, null);
  api.setStatus('Follow the gold pickup, quay and drop gates. Drive with arrows or WASD, or tap and drag along the road. The tram depot cuts the corner on Market Boulevard.');
  api.frame(dt => {
    const input = aim ? steerTo(race, aim) : { gas: held('gas'), brake: held('brake'), turn: Number(held('right')) - Number(held('left')) };
    const gateBefore = race.gate;
    const scraping = race.scrape > 0;
    stepRace(race, input, dt);
    if (race.phase === 'racing' && race.gate !== gateBefore) api.sfx?.(race.gate === 1 ? 'pickup' : 'quay');
    else if (!scraping && race.scrape > 0) api.sfx?.('scrape');
    paint(ctx, back, race, best, aim); hud();
    if (race.phase === 'failed') api.finish('failed', 'The handoff closed. Brake before tight bends or tap short waypoints through the depot.');
    if (['complete', 'partial'].includes(race.phase)) {
      personalBest = recordBest(personalBest, race);
      const route = race.shortcut ? 'tram depot' : 'boulevard';
      const stamp = race.phase === 'complete' ? 'On-time delivery' : 'Late delivery';
      api.finish(race.phase, `${stamp} via the ${route} in ${race.time.toFixed(1)}s. ${personalBest.trace === race.trace ? 'Your new ghost is ready to race.' : 'Your fastest ghost stays on the course.'}`);
    }
  });
}
