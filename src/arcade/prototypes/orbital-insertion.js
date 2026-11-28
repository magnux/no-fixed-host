const TAU = 2 * Math.PI;
const width = 640,
  height = 300,
  pad = 320,
  padRadius = 38;
const earthMu = 120000,
  parkingRadius = 66,
  lunarRadius = 153;
const lunarRate = Math.sqrt(earthMu / lunarRadius ** 3);
const circularSpeed = Math.sqrt(earthMu / parkingRadius);
const transferAxis = (parkingRadius + lunarRadius) / 2;
const transferTime = Math.PI * Math.sqrt(transferAxis ** 3 / earthMu);
const impulse = Math.sqrt(earthMu * (2 / parkingRadius - 1 / transferAxis)) - circularSpeed;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const wrapped = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const gravity = 3.4,
  brakePower = 14.4,
  safeSpeed = 5;
const captureRadius = 10;
const unit = (x, y) => {
  const r = Math.hypot(x, y);
  return { x: x / r, y: y / r };
};

export function startOrbit() {
  return {
    phase: 'orbit',
    px: parkingRadius,
    py: 0,
    dx: 0,
    dy: circularSpeed - 2.4,
    time: 0,
    coast: 0,
    trim: 16,
    x: pad,
    altitude: 100,
    fall: 14,
    vx: 0,
    fuel: 5.4,
    braking: false,
    trail: [],
    trailTime: 0,
    flash: 0,
  };
}

export function moonAt(time) {
  const angle = 2.45 + lunarRate * time;
  return { x: lunarRadius * Math.cos(angle), y: lunarRadius * Math.sin(angle), angle };
}

export function telemetry(c) {
  const r = Math.hypot(c.px, c.py),
    v2 = c.dx * c.dx + c.dy * c.dy;
  const angularMomentum = c.px * c.dy - c.py * c.dx;
  const energy = v2 / 2 - earthMu / r;
  const axis = -earthMu / (2 * energy);
  const eccentricity = Math.sqrt(Math.max(0, 1 + (2 * energy * angularMomentum ** 2) / earthMu ** 2));
  const gate = moonAt(c.time).angle + lunarRate * transferTime - Math.PI;
  const error = wrapped(Math.atan2(c.py, c.px) - gate);
  return {
    r,
    peri: axis * (1 - eccentricity),
    apo: axis * (1 + eccentricity),
    gate,
    error,
    circular: eccentricity < 0.065 && Math.abs(r - parkingRadius) < 6,
  };
}

// Kick–drift–kick keeps a coast stable even when rendering cadence changes.
function coastStep(c, dt) {
  let scale = (-earthMu * dt) / (2 * Math.hypot(c.px, c.py) ** 3);
  c.dx += c.px * scale;
  c.dy += c.py * scale;
  c.px += c.dx * dt;
  c.py += c.dy * dt;
  scale = (-earthMu * dt) / (2 * Math.hypot(c.px, c.py) ** 3);
  c.dx += c.px * scale;
  c.dy += c.py * scale;
}

function burn(c, amount) {
  const v = unit(c.dx, c.dy);
  c.dx += v.x * amount;
  c.dy += v.y * amount;
  c.flash = 0.38;
}

export function trimOrbit(c, direction) {
  if (!['orbit', 'transfer'].includes(c.phase) || c.trim < 1) return false;
  burn(c, direction * 1.2);
  c.trim--;
  return true;
}

export function depart(c) {
  if (c.phase !== 'orbit') return false;
  burn(c, impulse);
  c.phase = 'transfer';
  c.coast = 0;
  return true;
}

function finishFlight(c, outcome, detail) {
  c.phase = outcome === 'failed' ? 'wreck' : 'landed';
  c.braking = false;
  return { outcome, detail };
}

export function nudgeLander(c, direction) {
  if (c.phase === 'descent') c.vx = clamp(c.vx + direction * 2.5, -22, 22);
}

export function toggleBrake(c) {
  if (c.phase !== 'descent' || !c.fuel) return false;
  c.braking = !c.braking;
  return true;
}

export function stoppingHeight(c) {
  if (c.fall <= safeSpeed) return 0;
  return (c.fall ** 2 - safeSpeed ** 2) / (2 * (brakePower - gravity));
}

export function stepFlight(c, dt) {
  if (c.phase === 'wreck' || c.phase === 'landed') return;
  // Limit integrator steps independently of frame rate (also supports fast deterministic simulations).
  for (let remaining = dt; remaining > 1e-9; remaining -= 1 / 120) {
    const h = Math.min(1 / 120, remaining);
    c.time += h;
    c.flash = Math.max(0, c.flash - h);
    if (c.phase === 'orbit' || c.phase === 'transfer') {
      coastStep(c, h);
      c.trailTime += h;
      if (c.trailTime >= 0.095) {
        c.trail.push([c.px, c.py]);
        if (c.trail.length > 75) c.trail.shift();
        c.trailTime = 0;
      }
      const radius = Math.hypot(c.px, c.py);
      if (radius < 29)
        return finishFlight(
          c,
          'failed',
          'Atmospheric entry destroyed the capsule. Raise periapsis with prograde trim.',
        );
      if (c.phase === 'orbit') continue;
      c.coast += h;
      const moon = moonAt(c.time);
      const separation = Math.hypot(moon.x - c.px, moon.y - c.py);
      if (separation < captureRadius) {
        c.phase = 'descent';
        const relativeX = c.dx + lunarRate * moon.y,
          relativeY = c.dy - lunarRate * moon.x;
        c.vx = clamp((relativeX * moon.x + relativeY * moon.y) / lunarRadius, -7, 7);
        c.x = pad + (3 * ((c.px - moon.x) * moon.x + (c.py - moon.y) * moon.y)) / lunarRadius;
        c.fall = 12 + Math.hypot(relativeX, relativeY) * 0.45;
      } else if (c.coast > 1.85 * transferTime || radius > lunarRadius + 43) {
        return finishFlight(
          c,
          'failed',
          'Missed lunar capture. Circularize near 66 first and burn through the moving green departure gate.',
        );
      }
    } else {
      const burning = c.braking ? Math.min(h, c.fuel) : 0;
      c.fuel = Math.max(0, c.fuel - burning);
      if (!c.fuel) c.braking = false;
      const previous = c.fall;
      c.fall += gravity * h - brakePower * burning;
      c.altitude -= ((c.fall + previous) * h) / 2;
      c.x = clamp(c.x + c.vx * h, 12, width - 12);
      if (c.altitude <= 0) {
        c.altitude = 0;
        const velocity = Math.hypot(c.fall, c.vx);
        if (velocity > 8)
          return finishFlight(
            c,
            'failed',
            `Impact at ${velocity.toFixed(1)} m/s. The capsule and its payload were destroyed.`,
          );
        if (Math.abs(c.x - pad) <= padRadius && velocity <= safeSpeed)
          return finishFlight(
            c,
            'complete',
            `Beacon 07 reports a soft landing at ${velocity.toFixed(1)} m/s. Payload intact.`,
          );
        return finishFlight(c, 'partial', 'The capsule survived, but missed the precision landing envelope.');
      }
    }
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
    ctx.lineTo(0, 37 + Math.sin(time * 36) * 7);
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

function drawSurface(ctx, craft, pixelsPerMetre) {
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
  const tickMetres = 10 * Math.ceil(5 / pixelsPerMetre);
  for (let mark = tickMetres; mark * pixelsPerMetre < 214; mark += tickMetres) {
    const y = ground - 13 - mark * pixelsPerMetre;
    ctx.strokeStyle = '#536976';
    ctx.beginPath();
    ctx.moveTo(17, y);
    ctx.lineTo(27, y);
    ctx.stroke();
    ctx.fillStyle = '#9db1b4';
    ctx.fillText(mark + ' m', 33, y + 4);
  }
  const landerY = ground - 13 - craft.altitude * pixelsPerMetre;
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
  ctx.fillRect(69, 21, (88 * craft.fuel) / 5.4, 6);
}

function drawOrbit(ctx, c) {
  const cx = 258,
    cy = 150,
    sx = 1.3,
    sy = 0.8;
  const map = (x, y) => [cx + x * sx, cy + y * sy];
  const o = telemetry(c),
    moon = moonAt(c.time);
  for (const radius of [parkingRadius, lunarRadius]) {
    ctx.strokeStyle = '#375969';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * sx, radius * sy, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#68ecbc';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, parkingRadius * sx, parkingRadius * sy, 0, o.gate - 0.115, o.gate + 0.115);
  ctx.stroke();
  const planet = ctx.createRadialGradient(cx - 11, cy - 12, 1, cx, cy, 28);
  planet.addColorStop(0, '#d0e7c4');
  planet.addColorStop(0.48, '#4e94a0');
  planet.addColorStop(1, '#15394e');
  disc(ctx, cx, cy, 24, planet);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#88af93';
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 11);
  ctx.lineTo(cx - 4, cy - 17);
  ctx.lineTo(cx + 2, cy - 11);
  ctx.lineTo(cx - 6, cy - 7);
  ctx.lineTo(cx - 2, cy + 1);
  ctx.lineTo(cx - 9, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const [mx, my] = map(moon.x, moon.y);
  disc(ctx, mx, my, 10, '#c0c8b9');
  disc(ctx, mx - 3, my - 2, 2.5, '#808b83');
  ctx.strokeStyle = '#a4b5a0';
  ctx.beginPath();
  ctx.arc(mx, my, 14, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#d5ded2';
  ctx.font = '10px monospace';
  ctx.fillText('LUNA', mx + 14, my - 6);
  // Show where a burn here actually goes. The moving Moon intercept marker is one transfer time ahead.
  const projected = { px: c.px, py: c.py, dx: c.dx, dy: c.dy };
  const lookAhead = c.phase === 'orbit' ? transferTime : Math.max(0.4, transferTime - c.coast);
  if (c.phase === 'orbit') burn(projected, impulse);
  ctx.beginPath();
  ctx.moveTo(...map(c.px, c.py));
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#cba675';
  for (let i = 0; i < 84; i++) {
    coastStep(projected, lookAhead / 84);
    ctx.lineTo(...map(projected.px, projected.py));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const future = moonAt(c.time + Math.max(0, transferTime - c.coast));
  const [fx, fy] = map(future.x, future.y);
  ctx.strokeStyle = '#b6c5a3';
  ctx.strokeRect(fx - 4, fy - 4, 8, 8);
  ctx.beginPath();
  c.trail.forEach(([x, y], i) => (i ? ctx.lineTo(...map(x, y)) : ctx.moveTo(...map(x, y))));
  ctx.strokeStyle = '#63aaa9';
  ctx.lineWidth = 2;
  ctx.stroke();
  const [x, y] = map(c.px, c.py);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(c.dy * sy, c.dx * sx) + Math.PI / 2);
  drawLander(ctx, 0, 0, 0.67, c.flash > 0, c.time);
  ctx.restore();
  ctx.fillStyle = '#0c1a24';
  ctx.fillRect(482, 18, 146, 260);
  ctx.strokeStyle = '#31505e';
  ctx.strokeRect(482, 18, 146, 260);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#c7e3d8';
  ctx.fillText('FLIGHT DYNAMICS', 491, 40);
  const items = [
    ['PERIAPSIS', Math.round(o.peri)],
    ['APOAPSIS', Math.round(o.apo)],
    ['GATE OFFSET', Math.round((o.error * 180) / Math.PI) + '°'],
    ['TRIM IMPULSES', c.trim],
  ];
  items.forEach(([label, value], i) => {
    ctx.font = '10px monospace';
    ctx.fillStyle = '#92acae';
    ctx.fillText(label, 492, 65 + i * 39);
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#d9e9dc';
    ctx.fillText(String(value), 492, 83 + i * 39);
  });
  ctx.fillStyle = '#f0be87';
  ctx.font = '10px monospace';
  ctx.fillText('··· PROJECTED PATH', 491, 234);
  ctx.fillStyle = '#aeceb3';
  ctx.fillText('□ LUNAR INTERCEPT', 491, 251);
}

export default function mount(api) {
  const craft = startOrbit(),
    { canvas, ctx } = api.canvas(width, height);
  canvas.setAttribute(
    'aria-label',
    'Live orbital trajectory, moving transfer gate and lunar landing instruments',
  );
  const message = () =>
    api.setStatus(
      'Circularize near radius 66. At the start two prograde trims do it. Burn as the capsule crosses the moving green gate. The dotted path predicts the transfer.',
    );
  function trim(dir) {
    if (trimOrbit(craft, dir)) {
      api.sfx?.('brake');
      render();
    }
  }
  function launch() {
    if (!depart(craft)) return;
    api.sfx?.('transfer');
    burnButton.hidden = true;
    api.stage.focus();
    api.setStatus('Transfer coast. Watch Luna approach. Trim only if the projected path misses lunar orbit.');
    render();
  }
  function brake() {
    if (!toggleBrake(craft)) return;
    api.sfx?.(craft.braking ? 'brake' : 'cutoff');
    render();
  }
  function nudge(dir) {
    nudgeLander(craft, dir);
  }
  const minus = api.action('Retrograde (−)', () => trim(-1)),
    plus = api.action('Prograde (+)', () => trim(1));
  const burnButton = api.action('Transfer burn (L)', launch, { primary: true });
  const left = api.action('Nudge left (←)', () => nudge(-1)),
    brakeButton = api.action('Fire brake (B)', brake, { primary: true }),
    right = api.action('Nudge right (→)', () => nudge(1));
  api.onKey((e) => {
    const k = e.key.toLowerCase();
    const commands = {
      '+': () => trim(1),
      '=': () => trim(1),
      w: () => trim(1),
      '-': () => trim(-1),
      s: () => trim(-1),
      l: launch,
      b: brake,
      arrowleft: () => nudge(-1),
      arrowright: () => nudge(1),
    };
    if (commands[k]) {
      e.preventDefault();
      if (!e.repeat) commands[k]();
    }
  });
  function render() {
    const inSpace =
      ['transfer', 'orbit'].includes(craft.phase) || (craft.phase === 'wreck' && craft.altitude > 0);
    left.hidden = brakeButton.hidden = right.hidden = inSpace;
    plus.hidden = minus.hidden = !inSpace;
    plus.disabled = minus.disabled = craft.trim <= 0;
    brakeButton.disabled = !craft.fuel;
    brakeButton.setAttribute('aria-pressed', String(craft.braking));
    brakeButton.textContent = craft.braking ? 'Cut brake (B)' : 'Fire brake (B)';
    if (ctx) {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#071426');
      bg.addColorStop(1, '#253a46');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      stars(ctx);
      if (inSpace) drawOrbit(ctx, craft);
      else {
        // A long retro burn can send the capsule climbing. Keep its complete ascent in the viewport.
        const pixelsPerMetre = 202 / Math.max(100, craft.altitude);
        drawSurface(ctx, craft, pixelsPerMetre);
        const burnHeight = stoppingHeight(craft);
        const mark = 261 - 13 - pixelsPerMetre * burnHeight;
        ctx.strokeStyle = '#f3a16f';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(128, mark);
        ctx.lineTo(617, mark);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffd09d';
        ctx.font = '11px monospace';
        ctx.fillText('BRAKE FLOOR', 526, mark - 5);
        ctx.fillStyle = craft.braking ? '#ffd883' : '#95aaaf';
        ctx.fillText(craft.braking ? 'RETRO FIRING ▲' : 'ENGINE IDLE', 484, 28);
        if (craft.phase === 'wreck') {
          for (let i = 0; i < 13; i++) {
            const a = Math.PI + (Math.PI * i) / 12;
            disc(
              ctx,
              craft.x + Math.cos(a) * (14 + (i % 3) * 7),
              253 + Math.sin(a) * (19 + (i % 4) * 6),
              4 + (i % 4),
              i % 2 ? '#ff9c50' : '#ffd487',
            );
          }
          ctx.fillStyle = '#ffc79a';
          ctx.fillText('IMPACT / SIGNAL LOST', 450, 53);
        }
      }
    }
    if (inSpace) {
      const o = telemetry(craft);
      api.setHud(
        craft.phase === 'orbit'
          ? `Parking orbit · ${o.circular ? 'Circularized' : 'Trim to circularize'} · ${Math.abs(o.error) < 0.115 ? 'Transfer gate open' : Math.round((o.error * 180) / Math.PI) + '° to gate'} · Peri / apo ${Math.round(o.peri)} / ${Math.round(o.apo)}`
          : `Transfer coast · Luna range ${Math.round(Math.hypot(craft.px - moonAt(craft.time).x, craft.py - moonAt(craft.time).y))} · Trim ${craft.trim}`,
      );
    } else
      api.setHud(
        `Altitude ${Math.ceil(craft.altitude)} m · Vertical ${Math.abs(craft.fall).toFixed(1)} m/s ${craft.fall < 0 ? '↑' : '↓'} · Drift ${Math.abs(craft.vx).toFixed(1)} m/s ${craft.vx < 0 ? '←' : '→'} · Brake floor ${Math.ceil(stoppingHeight(craft))} m · Fuel ${craft.fuel.toFixed(1)} s`,
      );
  }
  render();
  message();
  api.frame((dt) => {
    const before = craft.phase,
      result = stepFlight(craft, dt);
    if (before === 'transfer' && craft.phase === 'descent') {
      api.sfx?.('cutoff');
      api.stage.focus();
      api.setStatus(
        'Capture! Toggle B near the orange brake floor. Left/right trim sideways speed. Below 5 m/s wins, above 8 m/s destroys the capsule.',
      );
    }
    render();
    if (result) api.finish(result.outcome, result.detail);
  });
}
