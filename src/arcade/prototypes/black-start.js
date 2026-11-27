const width = 344;
const height = 386;
const gravity = 300;
const radius = 5.5;
const restAngle = 0.38;
const raisedAngle = -0.48;
const batLength = 62;
const pivotY = 320;
const drainY = 373;
const banks = [
  { x: 62, y: 137, radius: 18, color: '#f6a482', name: 'Cooling' },
  { x: 153, y: 104, radius: 17, color: '#b9da87', name: 'Memory' },
  { x: 242, y: 143, radius: 18, color: '#8ccedb', name: 'Relay' },
];
const rails = [
  [10, 285, 10, 80], [10, 80, 29, 40], [29, 40, 73, 16],
  [73, 16, 240, 16], [240, 16, 274, 31], [274, 31, 295, 68],
  [295, 68, 295, 285], [10, 285, 82, pivotY], [295, 285, 225, pivotY],
];
const outlines = [
  [[30, 225], [64, 269], [40, 260]],
  [[274, 225], [241, 269], [265, 260]],
];
const slings = outlines.flatMap(points => points.map(([x, y], i) => [x, y, ...points[(i + 1) % points.length]]));
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function newTable() {
  return {
    ball: { x: 319, y: 334, vx: 0, vy: 0 }, phase: 'ready', charge: 0, plunge: 0, power: 0,
    balls: 3, lit: [false, false, false], hits: [0, 0, 0],
    angles: [restAngle, restAngle], held: [false, false], pulse: [0, 0],
    saveTime: 0, saveUsed: false, rampShot: false, message: '',
  };
}

export function pullPlunger(table) {
  if (table.phase === 'ready') {
    table.phase = 'charging';
    table.charge = 0;
  }
}

export function launchBall(table) {
  if (table.phase !== 'charging' && table.phase !== 'ready') return;
  table.phase = 'rail';
  table.power = clamp(table.charge / 0.9, 0, 1);
  table.plunge = 0;
  table.rampShot = false;
  table.saveTime = table.saveUsed ? 0 : 4;
  table.message = 'Ball in play. Light each breaker, then shoot up the striped generator ramp.';
}

function drain(table) {
  if (table.saveTime > 0 && !table.saveUsed) {
    table.saveUsed = true;
    table.message = 'Early drain. Ball save returned this ball to the plunger.';
  } else {
    table.balls--;
    table.saveUsed = false;
    table.message = table.balls ? 'Ball drained. Your lit breakers stay on. Launch the next ball.' : 'All three balls drained.';
  }
  table.phase = table.balls ? 'ready' : 'ended';
  table.ball = { x: 319, y: 334, vx: 0, vy: 0 };
  table.charge = 0;
  if (!table.balls) return table.lit.some(Boolean) ? 'partial' : 'failed';
}

// Resolve penetration against a line with rounded ends (including both flippers).
function contact(ball, ax, ay, bx, by, thickness) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((ball.x - ax) * dx + (ball.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const cx = ball.x - ax - t * dx;
  const cy = ball.y - ay - t * dy;
  const distance = Math.hypot(cx, cy);
  const overlap = radius + thickness - distance;
  if (overlap <= 0) return;
  const nx = distance > 0.0001 ? cx / distance : 0;
  const ny = distance > 0.0001 ? cy / distance : -1;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  return { nx, ny, t };
}

function bounce(ball, nx, ny, restitution, boost = 0) {
  const inward = ball.vx * nx + ball.vy * ny;
  if (inward >= 0) return false;
  const impulse = -(1 + restitution) * inward + boost;
  ball.vx += impulse * nx;
  ball.vy += impulse * ny;
  return true;
}

function moveBats(table, dt) {
  for (let i = 0; i < 2; i++) {
    table.pulse[i] = Math.max(0, table.pulse[i] - dt);
    const raised = table.held[i] || table.pulse[i] > 0;
    const old = table.angles[i];
    const angle = raised ? Math.max(raisedAngle, old - 14 * dt) : Math.min(restAngle, old + 8 * dt);
    table.angles[i] = angle;
    if (table.phase !== 'play') continue;
    const sign = i === 0 ? 1 : -1;
    const x = i === 0 ? 82 : 225;
    const ball = table.ball;
    const hit = contact(ball, x, pivotY, x + sign * Math.cos(angle) * batLength, pivotY + Math.sin(angle) * batLength, 4);
    if (!hit) continue;
    if (angle < old && hit.ny < -0.25) {
      // Near the hinge the ball goes up its own lane; the tip sends it across the table.
      ball.vx = sign * (hit.t - 0.23) * 255;
      ball.vy = -410 - 65 * hit.t;
      table.rampShot = table.lit.every(Boolean);
    } else {
      bounce(ball, hit.nx, hit.ny, 0.48);
    }
  }
}

function advance(table, dt) {
  moveBats(table, dt);
  for (let i = 0; i < banks.length; i++) table.hits[i] = Math.max(0, table.hits[i] - dt);
  if (table.phase === 'charging') table.charge = Math.min(0.9, table.charge + dt);
  const ball = table.ball;
  if (table.phase === 'rail') {
    // The physical shooter channel bends under the top rail into the table.
    table.plunge += dt * (1.35 + 0.65 * table.power);
    const t = Math.min(1, table.plunge);
    ball.x = 319 - 69 * t ** 6;
    ball.y = 334 - 315 * (1 - (1 - t) ** 2) + 30 * t ** 9;
    if (t >= 1) {
      table.phase = 'play';
      ball.vx = -130 - table.power * 190;
      ball.vy = 45 + (1 - table.power) * 75;
    }
    return;
  }
  if (table.phase !== 'play') return;
  table.saveTime = Math.max(0, table.saveTime - dt);
  const previousY = ball.y;
  ball.vy += gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  for (const rail of rails) {
    const hit = contact(ball, ...rail, 2);
    if (hit) bounce(ball, hit.nx, hit.ny, 0.86);
  }
  for (const sling of slings) {
    const hit = contact(ball, ...sling, 2);
    if (hit) bounce(ball, hit.nx, hit.ny, 0.9, 42);
  }
  for (const [index, bank] of banks.entries()) {
    const dx = ball.x - bank.x;
    const dy = ball.y - bank.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= radius + bank.radius) continue;
    const nx = distance ? dx / distance : 0;
    const ny = distance ? dy / distance : 1;
    ball.x = bank.x + nx * (radius + bank.radius);
    ball.y = bank.y + ny * (radius + bank.radius);
    if (!bounce(ball, nx, ny, 0.88, 70)) continue;
    table.hits[index] = 0.22;
    if (!table.lit[index]) {
      table.lit[index] = true;
      table.message = table.lit.every(Boolean) ? 'All breakers live! Send a flipper shot up the striped center ramp.' : bank.name + ' bank online.';
    }
  }
  if (table.rampShot && previousY >= 64 && ball.y < 64 && ball.x > 114 && ball.x < 192) {
    table.phase = 'ended';
    return 'complete';
  }
  if (ball.y > drainY) return drain(table);
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 535) {
    ball.vx *= 535 / speed;
    ball.vy *= 535 / speed;
  }
}

export function stepTable(table, delta) {
  // Keep the fastest ball below half a radius per substep at every display rate.
  const count = Math.ceil(delta * 240);
  for (let i = 0; i < count; i++) {
    const result = advance(table, delta / count);
    if (result) return result;
  }
}

function stroke(ctx, points, ink, lineWidth) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.strokeStyle = ink;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function disc(ctx, x, y, r, ink) {
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}

function lettering(ctx, text, x, y, size, ink) {
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = 'bold ' + size + 'px ui-monospace, monospace';
  ctx.fillText(text, x, y);
}

function paint(ctx, table) {
  const power = table.lit.filter(Boolean).length;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, ['#18343a', '#214145', '#254a4a', '#315b51'][power]);
  background.addColorStop(1, '#101c28');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = ctx.lineJoin = 'round';
  // Rivets and copper bus bars continue across the dark parts of the panel.
  for (let x = 24; x < 290; x += 20) {
    for (let y = 82; y < 299; y += 20) {
      ctx.fillStyle = '#405456';
      ctx.fillRect(x, y, 0.9, 0.9);
    }
  }
  const trace = '#335356';
  for (const [i, bank] of banks.entries()) {
    const endX = 112 + i * 40;
    stroke(ctx, [[bank.x, bank.y], [bank.x, 172], [endX, 190], [endX, 212]], table.lit[i] ? bank.color : trace, 2);
  }
  // Each breaker powers one bank of the art-deco generator building's windows.
  ctx.fillStyle = '#182e35';
  ctx.fillRect(91, 214, 124, 42);
  ctx.fillRect(118, 200, 70, 15);
  ctx.fillRect(139, 193, 28, 7);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = table.lit[i] ? banks[i].color : '#365455';
    for (let j = 0; j < 3; j++) ctx.fillRect(97 + i * 40 + j * 10, 221, 5, 11);
  }
  lettering(ctx, 'B L A C K   S T A R T', 153, 247, 9.5, '#c8d3ba');
  lettering(ctx, 'POWER STATION', 153, 266, 8, '#92b4a9');

  const rampInk = power === 3 ? '#fcdb78' : '#6a8980';
  stroke(ctx, [[109, 67], [119, 30], [187, 30], [197, 67]], rampInk, 2.7);
  for (const y of [56, 63, 70]) stroke(ctx, [[133, y + 2], [153, y - 3], [173, y + 2]], rampInk, 2);
  lettering(ctx, 'GENERATOR', 153, 45, 9, power === 3 ? '#fff2ae' : '#a8bbac');
  for (const [ax, ay, bx, by] of rails) {
    stroke(ctx, [[ax, ay], [bx, by]], '#17272c', 8);
    stroke(ctx, [[ax, ay], [bx, by]], '#94b1a0', 3.4);
  }
  for (const points of outlines) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fillStyle = '#b16e56';
    ctx.fill();
    ctx.strokeStyle = '#e4c393';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const [i, bank] of banks.entries()) {
    const live = table.lit[i];
    for (let tooth = 0; tooth < 8; tooth++) {
      const angle = tooth * Math.PI / 4;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      stroke(ctx, [[bank.x + dx * (bank.radius + 3), bank.y + dy * (bank.radius + 3)],
        [bank.x + dx * (bank.radius + 5), bank.y + dy * (bank.radius + 5)]], live ? bank.color : '#526b68', 2);
    }
    disc(ctx, bank.x, bank.y + 2, bank.radius + 3, '#0d2026');
    disc(ctx, bank.x, bank.y, bank.radius + 1, table.hits[i] ? '#fff6be' : bank.color);
    disc(ctx, bank.x, bank.y, bank.radius - 3, live ? bank.color : '#293c41');
    lettering(ctx, String.fromCharCode(65 + i), bank.x, bank.y + 4.6, 14, live ? '#1a3436' : bank.color);
    lettering(ctx, bank.name.toUpperCase(), bank.x, bank.y + 32, 9.5, live ? '#faf1cc' : '#c1d2c5');
  }
  // A separate spring and ball trough keep the number of balls left visible on the table.
  stroke(ctx, [[272, 21], [299, 33], [329, 62], [329, 351]], '#718c86', 3);
  stroke(ctx, [[307, 76], [307, 352]], '#536d6e', 2);
  const springTop = 336 + table.charge * 19;
  const spring = [[319, springTop]];
  for (let i = 1; i <= 8; i++) spring.push([319 + (i % 2 ? -6 : 6), springTop + i * (365 - springTop) / 9]);
  stroke(ctx, spring, '#efbe80', 2);
  const ball = table.ball;
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? 82 : 225;
    const sign = i === 0 ? 1 : -1;
    const angle = table.angles[i];
    const points = [[x, pivotY], [x + sign * Math.cos(angle) * batLength, pivotY + Math.sin(angle) * batLength]];
    stroke(ctx, points, '#182932', 13);
    stroke(ctx, points, '#eca071', 9);
    disc(ctx, x, pivotY, 3.3, '#fff0c6');
  }
  lettering(ctx, 'BALL', 36, 360, 8, '#a9bbaf');
  for (let i = 0; i < 3; i++) disc(ctx, 57 + 12 * i, 357, 3.5, i < table.balls ? '#ebd2a3' : '#3e5051');
  const by = ball.y + (table.phase === 'charging' ? table.charge * 19 : 0);
  disc(ctx, ball.x + 1.4, by + 2, radius + 0.6, '#17232a');
  disc(ctx, ball.x, by, radius, '#a9c8c5');
  disc(ctx, ball.x - 1.6, by - 1.6, radius * 0.55, '#f7f8df');
}

export default function mount(api) {
  const table = newTable();
  const { canvas, ctx } = api.canvas(width * 2, height * 2);
  ctx.scale(2, 2);
  canvas.style.maxWidth = 'min(100%, 25rem, 66dvh)';
  canvas.style.margin = '0 auto';
  canvas.style.touchAction = 'none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Pinball table with Cooling, Memory and Relay breakers. Shoot up the center ramp after lighting all three.');
  const pressed = new Map();
  function press(id, control) {
    if (pressed.has(id)) return;
    pressed.set(id, control);
    if (control === 2) pullPlunger(table);
    else {
      table.held[control] = true;
      table.pulse[control] = 0.1;
    }
  }
  function release(id) {
    const control = pressed.get(id);
    pressed.delete(id);
    if (control === undefined || [...pressed.values()].includes(control)) return;
    if (control === 2) launchBall(table);
    else table.held[control] = false;
  }
  function bindPointer(el, identify) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const control = identify(event);
      press(event.pointerId, control);
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener('pointerup', event => release(event.pointerId));
    el.addEventListener('lostpointercapture', event => release(event.pointerId));
  }
  const plunge = api.action('Plunger', event => {
    if (event.detail === 0) launchBall(table);
  }, { primary: true });
  bindPointer(plunge, () => 2);
  const flippers = ['Left flipper', 'Right flipper'].map((label, index) => {
    const button = api.action(label, event => {
      if (event.detail === 0) table.pulse[index] = 0.13;
    });
    bindPointer(button, () => index);
    return button;
  });
  bindPointer(canvas, event => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    return x > 0.87 ? 2 : x < 0.45 ? 0 : 1;
  });
  api.onKey(event => {
    const key = event.key.toLowerCase();
    let control;
    if (key === 'arrowleft' || key === 'a') control = 0;
    if (key === 'arrowright' || key === 'd') control = 1;
    if (key === ' ') control = flippers.includes(event.target) ? flippers.indexOf(event.target) : 2;
    if (control !== undefined) {
      event.preventDefault();
      if (!event.repeat) press(key, control);
    }
  });
  const keyup = event => release(event.key.toLowerCase());
  const clearHeld = () => {
    pressed.clear();
    table.held.fill(false);
    table.pulse.fill(0);
    if (table.phase === 'charging') { table.phase = 'ready'; table.charge = 0; }
  };
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', clearHeld);
  api.onCleanup(() => {
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', clearHeld);
    document.removeEventListener('visibilitychange', clearHeld);
  });
  function update() {
    plunge.disabled = table.phase !== 'ready' && table.phase !== 'charging';
    const power = table.phase === 'charging' ? ' · Plunger ' + Math.round(100 * table.charge / 0.9) + '%' : '';
    const live = banks.filter((_, i) => table.lit[i]).map(bank => bank.name);
    const breakers = live.length ? live.length + '/3 online · ' + live.join(' + ') : '0/3 breaker banks';
    api.setHud(breakers + ' · ' + table.balls + (table.balls === 1 ? ' ball left' : ' balls left') + power);
    if (table.message) {
      api.setStatus(table.message);
      table.message = '';
    }
    paint(ctx, table);
  }
  api.setStatus('Hold Space or the plunger for power, then release. Flip with ← / → or A / D. On touch, press the left or right half of the table.');
  update();
  api.frame(dt => {
    const outcome = stepTable(table, dt);
    update();
    if (outcome) api.finish(outcome, outcome === 'complete' ? 'Generator spinning. Every window in the facility lights up.' :
      table.lit.filter(Boolean).length + ' of three breaker banks stayed online when the last ball drained.');
  });
}
