const TAU = 2 * Math.PI;
const width = 640;
const height = 300;
const pad = 320;
const padRadius = 48;
const safeSpeed = 8;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function startOrbit() {
  return {
    phase: 'orbit',
    angle: -1.05,
    time: 0,
    x: pad,
    altitude: 100,
    vx: 0,
    fall: 7,
    fuel: 5,
    braking: false,
  };
}

const orbitError = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function depart(craft) {
  if (craft.phase !== 'orbit') return;
  const error = orbitError(craft.angle);
  const offset = clamp(error / 1.6, -1, 1);
  craft.phase = 'descent';
  craft.x = pad + offset * 116;
  craft.vx = offset * 2;
  craft.fuel = 5.8 - Math.abs(offset) * 1.4;
}

export function stepFlight(craft, dt) {
  if (craft.phase === 'landed') return;
  craft.time += dt;
  if (craft.phase === 'orbit') {
    craft.angle = (craft.angle + dt * 0.76) % TAU;
    return;
  }
  const burning = craft.braking ? Math.min(craft.fuel, dt) : 0;
  craft.fuel = Math.max(0, craft.fuel - burning);
  if (!craft.fuel) craft.braking = false;
  const before = craft.fall;
  craft.fall = Math.max(-2, craft.fall + 2.55 * dt - 8.8 * burning);
  craft.altitude -= ((before + craft.fall) / 2) * dt;
  craft.x = clamp(craft.x + craft.vx * dt, 36, width - 36);
  craft.vx *= Math.exp(-dt * 0.9);
  if (craft.altitude <= 0) {
    craft.altitude = 0;
    craft.phase = 'landed';
    craft.braking = false;
    const aligned = Math.abs(craft.x - pad) <= padRadius;
    if (aligned && craft.fall <= safeSpeed) {
      return {
        outcome: 'complete',
        detail: 'Soft landing on the beacon pad. The survey instruments arrived intact.',
      };
    }
    if (craft.fall <= 15) {
      return {
        outcome: 'partial',
        detail: aligned
          ? 'The capsule reached the pad. A hard touchdown damaged the survey instruments.'
          : 'The capsule settled outside the beacon pad. The survey team will collect it on foot.',
      };
    }
    return {
      outcome: 'failed',
      detail: 'Impact exceeded the landing gear limit. Try braking nearer the surface.',
    };
  }
}

function stars(ctx) {
  for (let i = 1; i < 61; i++) {
    const x = (i * 151.9 + 213) % width;
    const y = (i * i * 13.7) % height;
    ctx.fillStyle = i % 3 ? '#3b586d' : '#93b4bb';
    ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, 1.5);
  }
}

function disc(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLander(ctx, x, y, size, burn, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (burn) {
    ctx.fillStyle = '#ffc46f';
    ctx.beginPath();
    ctx.moveTo(-5, 9);
    ctx.lineTo(0, 22 + Math.sin(time * 27) * 4);
    ctx.lineTo(5, 9);
    ctx.fill();
  }
  ctx.strokeStyle = '#b9d4d8';
  ctx.lineWidth = 2.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, 4);
    ctx.lineTo(side * 13, 13);
    ctx.lineTo(side * 18, 13);
    ctx.stroke();
  }
  ctx.fillStyle = '#dcac75';
  ctx.fillRect(-10, 1, 20, 7);
  ctx.fillStyle = '#c9d5cb';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-5, -10);
  ctx.lineTo(5, -10);
  ctx.lineTo(9, 0);
  ctx.fill();
  ctx.fillStyle = '#276170';
  ctx.fillRect(-4, -7, 8, 4);
  ctx.fillStyle = '#738a91';
  ctx.fillRect(-5, 8, 10, 3);
  ctx.restore();
}

function drawOrbit(ctx, craft) {
  const cx = 172,
    cy = 150,
    rx = 100,
    ry = 65;
  ctx.strokeStyle = '#3f667c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  const globe = ctx.createRadialGradient(cx - 12, cy - 13, 4, cx, cy, 39);
  globe.addColorStop(0, '#719d9f');
  globe.addColorStop(0.65, '#367681');
  globe.addColorStop(1, '#224954');
  disc(ctx, cx, cy, 34, globe);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#829d88';
  for (const [x, y, w, h] of [
    [-29, -17, 22, 9],
    [-12, -10, 13, 17],
    [-4, 5, 9, 15],
    [12, -24, 19, 8],
    [19, -17, 13, 17],
  ])
    ctx.fillRect(cx + x, cy + y, w, h);
  ctx.restore();
  ctx.strokeStyle = '#83efd6';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, -0.4, 0.4);
  ctx.stroke();
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + rx + 7, cy);
  ctx.bezierCurveTo(372, 150, 415, 62, 493, 97);
  ctx.stroke();
  ctx.setLineDash([]);
  disc(ctx, 522, 106, 32, '#a4b2ad');
  disc(ctx, 534, 115, 6, '#71878a');
  disc(ctx, 514, 93, 4, '#839797');
  drawLander(
    ctx,
    cx + Math.cos(craft.angle) * rx,
    cy + Math.sin(craft.angle) * ry,
    0.8,
    false,
    craft.time,
  );
  ctx.fillStyle = '#a3b9bd';
  ctx.font = '13px monospace';
  ctx.fillText('PARKING ORBIT', 107, 251);
  ctx.fillText('LUNA', 504, 158);
  ctx.fillStyle = '#83efd6';
  ctx.fillText('TRANSFER GATE', 257, 212);
}

function drawSurface(ctx, craft) {
  const ground = 261;
  ctx.fillStyle = '#263845';
  ctx.beginPath();
  ctx.moveTo(0, 210);
  for (const [x, y] of [
    [57, 204],
    [113, 181],
    [159, 203],
    [222, 178],
    [281, 214],
    [376, 196],
    [447, 158],
    [477, 172],
    [509, 170],
    [574, 205],
    [640, 183],
  ])
    ctx.lineTo(x, y);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();
  ctx.fillStyle = '#49565d';
  ctx.beginPath();
  ctx.moveTo(0, 248);
  for (const [x, y] of [
    [55, 255],
    [119, 245],
    [186, 258],
    [251, 252],
    [270, ground],
    [370, ground],
    [395, 252],
    [461, 256],
    [529, 238],
    [557, 252],
    [640, 246],
  ])
    ctx.lineTo(x, y);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();
  ctx.fillStyle = '#637079';
  for (let i = 0; i < 21; i++) {
    ctx.beginPath();
    ctx.ellipse((i * 91 + 53) % width, 272 + ((i * 7) % 24), 3 + ((i * 3) % 10), 1 + (i % 3), 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#83efd6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad - padRadius, ground - 9);
  ctx.lineTo(pad - padRadius, ground);
  ctx.lineTo(pad + padRadius, ground);
  ctx.lineTo(pad + padRadius, ground - 9);
  ctx.stroke();
  ctx.font = '11px monospace';
  for (const mark of [30, 60, 90]) {
    const y = ground - 13 - mark * 2.02;
    ctx.strokeStyle = '#536976';
    ctx.beginPath();
    ctx.moveTo(17, y);
    ctx.lineTo(27, y);
    ctx.stroke();
    ctx.fillStyle = '#9db1b4';
    ctx.fillText(mark + ' m', 33, y + 4);
  }
  const landerY = ground - 13 - craft.altitude * 2.02;
  ctx.strokeStyle = '#607888';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(craft.x, landerY + 17);
  ctx.lineTo(craft.x, ground - 1);
  ctx.stroke();
  ctx.setLineDash([]);
  drawLander(ctx, craft.x, landerY, 1, craft.braking, craft.time);
  ctx.fillStyle = '#c2d8d2';
  ctx.font = '13px monospace';
  ctx.fillText('BEACON 07', pad - 36, 283);
  ctx.fillText('FUEL', 24, 30);
  ctx.strokeStyle = '#657985';
  ctx.strokeRect(67, 19, 92, 10);
  ctx.fillStyle = craft.fuel > 1.5 ? '#83efd6' : '#ffbb76';
  ctx.fillRect(69, 21, (88 * craft.fuel) / 5.8, 6);
}

export default function mount(api) {
  const craft = startOrbit();
  const { canvas, ctx } = api.canvas(width, height);
  canvas.setAttribute('aria-label', 'Orbital transfer track and lunar landing pad');
  const setBrake = () => {
    if (craft.phase !== 'descent' || !craft.fuel) return;
    craft.braking = !craft.braking;
    brake.textContent = craft.braking ? 'Cut brake (B)' : 'Fire brake (B)';
    brake.setAttribute('aria-pressed', String(craft.braking));
    render();
  };
  function transfer() {
    if (craft.phase !== 'orbit') return;
    depart(craft);
    launch.hidden = true;
    left.hidden = right.hidden = brake.hidden = false;
    brake.focus();
    api.setStatus(
      'Aim between the beacons. Touch down at 8 m/s or slower. Toggle the brake to spend fuel.',
    );
    render();
  }
  function nudge(direction) {
    if (craft.phase === 'descent') craft.vx = clamp(craft.vx + direction * 28, -62, 62);
  }
  const launch = api.action('Transfer burn (L)', transfer, { primary: true });
  const left = api.action('Nudge left (←)', () => nudge(-1));
  const brake = api.action('Fire brake (B)', setBrake, { primary: true });
  const right = api.action('Nudge right (→)', () => nudge(1));
  left.hidden = right.hidden = brake.hidden = true;
  brake.setAttribute('aria-pressed', 'false');
  api.onKey((event) => {
    const key = event.key.toLowerCase();
    if (!['l', 'b', 'arrowleft', 'arrowright'].includes(key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === 'l') transfer();
    else if (key === 'b') setBrake();
    else nudge(key === 'arrowleft' ? -1 : 1);
  });
  api.setStatus(
    'Wait for the lander to enter the bright transfer gate, then launch. A precise burn places you above the lunar pad with more fuel.',
  );
  let lastHud = '';
  function render() {
    if (ctx) {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0d1728');
      bg.addColorStop(1, '#1c323c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      stars(ctx);
      if (craft.phase === 'orbit') drawOrbit(ctx, craft);
      else drawSurface(ctx, craft);
    }
    const offset = Math.round(craft.x - pad);
    const hud =
      craft.phase === 'orbit'
        ? 'Parking orbit · ' +
          (Math.abs(orbitError(craft.angle)) <= 0.4
            ? 'Transfer gate open'
            : 'Aligning with transfer gate')
        : `Altitude ${Math.ceil(craft.altitude)} m · ${craft.fall < 0 ? 'Climb' : 'Descent'} ${Math.abs(craft.fall).toFixed(1)} m/s · ${Math.abs(offset) <= padRadius ? 'Over pad' : Math.abs(offset) + ' m ' + (offset < 0 ? 'left' : 'right')} · Fuel ${craft.fuel.toFixed(1)} s`;
    if (hud !== lastHud) {
      api.setHud(hud);
      lastHud = hud;
    }
  }
  render();
  api.frame((dt) => {
    const result = stepFlight(craft, dt);
    if (craft.phase !== 'orbit' && !craft.fuel && !brake.disabled) {
      brake.disabled = true;
      brake.textContent = 'Brake depleted';
      brake.setAttribute('aria-pressed', 'false');
    }
    render();
    if (result) api.finish(result.outcome, result.detail);
  });
}
