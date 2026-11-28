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
  [10, 285, 10, 80],
  [10, 80, 29, 40],
  [29, 40, 73, 16],
  [73, 16, 240, 16],
  [240, 16, 274, 31],
  [274, 31, 295, 68],
  [295, 68, 295, 285],
  [10, 285, 82, pivotY],
  [295, 285, 225, pivotY],
];
const outlines = [
  [
    [30, 225],
    [64, 269],
    [40, 260],
  ],
  [
    [274, 225],
    [241, 269],
    [265, 260],
  ],
];
const slings = outlines.flatMap(points => points.map(([x, y], i) => [x, y, ...points[(i + 1) % points.length]]));
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

// Clear outer lanes enter a raised wireform. The far lane returns the ball above the opposite sling.
const orbit = [
  [24, 192],
  [19, 154],
  [21, 101],
  [32, 65],
  [55, 42],
  [93, 29],
  [150, 24],
  [204, 30],
  [244, 46],
  [267, 70],
  [278, 109],
  [276, 155],
  [267, 181],
];
const guideRails = [
  [35, 188, 39, 141],
  [39, 141, 34, 105],
  [270, 188, 265, 141],
  [265, 141, 270, 105],
];
const targets = [
  { x: 96, y: 200 },
  { x: 152, y: 184 },
  { x: 209, y: 200 },
];
const returnPosts = [
  { x: 68, y: 283 },
  { x: 237, y: 283 },
];
const twoPi = Math.PI * 2;

function orbitPoint(t, side) {
  const index = Math.min(orbit.length - 2, Math.floor(t * (orbit.length - 1)));
  const part = t * (orbit.length - 1) - index;
  const a = orbit[index],
    b = orbit[index + 1];
  const x = a[0] + (b[0] - a[0]) * part;
  return { x: side ? 304 - x : x, y: a[1] + (b[1] - a[1]) * part };
}

function award(table, points) {
  table.score += points * (table.surge > 0 ? 2 : 1);
}
function spark(table, x, y, color) {
  table.sparks.push({ x, y, color, life: 0.35 });
}
function activateSurge(table) {
  table.surge = 12;
  table.circuits++;
  table.kickback = true;
  table.message = 'Capacitor bank full! Twelve seconds of double scoring. Kickback armed.';
}
function playOrbit(table, side) {
  table.phase = 'orbit';
  table.orbitSide = side;
  table.orbitTime = 0;
  table.orbits++;
  table.lanes[side] = true;
  award(table, 800);
  spark(table, table.ball.x, table.ball.y, '#8de4e9');
  if (table.lanes.every(Boolean)) {
    table.lanes.fill(false);
    table.kickback = true;
    award(table, 1000);
    table.message = 'Both orbits lit. Outlane kickback armed!';
  } else table.message = (side ? 'East' : 'West') + ' orbit! Shoot the other side to arm a kickback.';
}

export function newTable() {
  return {
    ball: { x: 319, y: 334, vx: 0, vy: 0 },
    phase: 'ready',
    charge: 0,
    plunge: 0,
    power: 0,
    balls: 3,
    lit: [false, false, false],
    hits: [0, 0, 0],
    angles: [restAngle, restAngle],
    held: [false, false],
    pulse: [0, 0],
    saveTime: 0,
    saveUsed: false,
    rampShot: false,
    message: '',
    time: 0,
    score: 0,
    down: [false, false, false],
    circuits: 0,
    surge: 0,
    lanes: [false, false],
    kickback: false,
    orbits: 0,
    orbitTime: 0,
    orbitSide: 0,
    spin: 0,
    spinRate: 0,
    spins: 0,
    slingHits: [0, 0],
    sparks: [],
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
  table.message =
    'Shoot for the three round breakers. Loop either outer lane or drop all three capacitor targets for bonuses.';
}

function drain(table) {
  if (table.saveTime > 0 && !table.saveUsed) {
    table.saveUsed = true;
    table.message = 'Early drain. Ball save returned this ball to the plunger.';
  } else {
    table.balls--;
    table.saveUsed = false;
    table.message = table.balls
      ? 'Ball drained. Your lit breakers stay on. Launch the next ball.'
      : 'All three balls drained.';
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
    const hit = contact(
      ball,
      x,
      pivotY,
      x + sign * Math.cos(angle) * batLength,
      pivotY + Math.sin(angle) * batLength,
      4,
    );
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
  table.time += dt;
  if (table.surge > 0 && table.surge <= dt) table.down.fill(false);
  table.surge = Math.max(0, table.surge - dt);
  table.spin += table.spinRate * dt;
  table.spinRate *= Math.exp(-1.65 * dt);
  for (let i = 0; i < 2; i++) table.slingHits[i] = Math.max(0, table.slingHits[i] - dt);
  for (const burst of table.sparks) burst.life -= dt;
  if (table.sparks[0]?.life <= 0) table.sparks = table.sparks.filter(s => s.life > 0);
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
  if (table.phase === 'orbit') {
    table.orbitTime = Math.min(1, table.orbitTime + dt * 1.55);
    Object.assign(ball, orbitPoint(table.orbitTime, table.orbitSide));
    if (table.orbitTime === 1) {
      table.phase = 'play';
      ball.vx = table.orbitSide ? 108 : -108;
      ball.vy = 145;
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
  if (previousY >= 192 && ball.y < 192 && ball.vy < -90 && (ball.x < 30 || ball.x > 275)) {
    playOrbit(table, Number(ball.x > 150));
    return;
  }
  for (const rail of guideRails) {
    const hit = contact(ball, ...rail, 1.8);
    if (hit) bounce(ball, hit.nx, hit.ny, 0.85);
  }
  for (const [i, sling] of slings.entries()) {
    const hit = contact(ball, ...sling, 2);
    if (hit && bounce(ball, hit.nx, hit.ny, 0.9, 58)) {
      const side = Math.floor(i / 3);
      if (!table.slingHits[side]) {
        award(table, 65);
        spark(table, ball.x, ball.y, '#f4a581');
      }
      table.slingHits[side] = 0.14;
    }
  }
  for (const [i, target] of targets.entries()) {
    if (table.down[i]) continue;
    const hit = contact(ball, target.x - 6, target.y + 1, target.x + 6, target.y - 1, 2);
    if (hit && bounce(ball, hit.nx, hit.ny, 0.82, 15)) {
      table.down[i] = true;
      award(table, 450);
      spark(table, target.x, target.y, '#ffd27a');
      if (table.down.every(Boolean)) activateSurge(table);
    }
  }
  // A spinner is a freely rotating gate. Passing through from either direction drives it.
  if ((previousY - 77) * (ball.y - 77) < 0 && ball.x > 119 && ball.x < 187) {
    table.spins++;
    table.spinRate = clamp(ball.vy / 11, -38, 38);
    award(table, 120);
  }
  for (const post of returnPosts) {
    const hit = contact(ball, post.x - 1, post.y, post.x + 1, post.y, 3);
    if (hit) bounce(ball, hit.nx, hit.ny, 0.86);
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
    if (!table.hits[index]) {
      award(table, table.lit[index] ? 140 : 600);
      spark(table, ball.x, ball.y, bank.color);
    }
    table.hits[index] = 0.22;
    if (!table.lit[index]) {
      table.lit[index] = true;
      table.message = table.lit.every(Boolean)
        ? 'All breakers live! Send a flipper shot up the striped center ramp.'
        : bank.name + ' breaker latched.';
    }
  }
  if (table.rampShot && previousY >= 64 && ball.y < 64 && ball.x > 114 && ball.x < 192) {
    award(table, 3500);
    table.phase = 'ended';
    return 'complete';
  }
  if (ball.y > 350 && ball.vy > 0 && table.kickback) {
    ball.x = 76;
    ball.y = 289;
    ball.vx = 72;
    ball.vy = -340;
    table.kickback = false;
    award(table, 250);
    spark(table, 76, 289, '#9ae4bb');
    table.message = 'Kickback fired! Ball returned to the west flipper.';
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
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
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

function wireform(ctx, table) {
  // The outer return is lifted over the upper playfield. Ties and chasing lamps show its direction.
  const active = table.phase === 'orbit';
  for (const offset of [-2, 2])
    stroke(
      ctx,
      [
        [92, 29 + offset],
        [149, 23 + offset],
        [211, 29 + offset],
      ],
      '#78929a',
      1,
    );

  for (const side of [0, 1]) {
    const sign = side ? -1 : 1;
    const points = orbit.slice(0, 6).map(([x, y]) => [side ? 304 - x : x, y]);
    for (const offset of [-3, 3]) {
      stroke(
        ctx,
        points.map(([x, y]) => [x + offset * sign, y]),
        '#142c35',
        3,
      );
      stroke(
        ctx,
        points.map(([x, y]) => [x + offset * sign, y - 1]),
        table.lanes[side] ? '#c1eeee' : '#718e93',
        1.1,
      );
    }
    for (let j = 0; j < 14; j++) {
      const p = orbitPoint(j / 34, side);
      const lit = (active && table.orbitSide === side) || (j + Math.floor(table.time * 5)) % 7 === 0;
      disc(ctx, p.x + 7 * sign, p.y, lit ? 1.9 : 1.3, lit ? '#b7f6ec' : '#426a6e');
    }
    const x = side ? 280 : 24;
    for (let j = 0; j < 3; j++)
      stroke(
        ctx,
        [
          [x - 4, 212 + j * 5],
          [x, 209 + j * 5],
          [x + 4, 212 + j * 5],
        ],
        table.lanes[side] ? '#8ef3da' : '#579496',
        1.3,
      );
  }
  for (const [ax, ay, bx, by] of guideRails) {
    stroke(
      ctx,
      [
        [ax, ay],
        [bx, by],
      ],
      '#233039',
      5,
    );
    stroke(
      ctx,
      [
        [ax, ay],
        [bx, by],
      ],
      '#9aaab1',
      1.8,
    );
  }
  if (active) {
    const p = orbitPoint(table.orbitTime, table.orbitSide);
    disc(ctx, p.x, p.y, 9, '#8df2ee44');
  }
}

function devices(ctx, table) {
  for (const [i, p] of targets.entries()) {
    const down = table.down[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.13);
    ctx.fillStyle = '#162c31';
    ctx.fillRect(-8, -2, 16, 7);
    ctx.fillStyle = down ? '#665939' : '#edbd6a';
    ctx.fillRect(-7, down ? 2 : -3, 14, down ? 1.6 : 6);
    if (!down)
      stroke(
        ctx,
        [
          [-4, 0],
          [3, 0],
        ],
        '#fff2af',
        1.4,
      );
    disc(ctx, 0, 10, 2.3, down ? '#ffcf69' : '#5b6859');
    ctx.restore();
  }
  lettering(ctx, 'C A P A C I T O R S', 153, 170, 5.8, '#bfae85');
  const vane = 7 * Math.cos(table.spin);
  stroke(
    ctx,
    [
      [138, 77],
      [168, 77],
    ],
    '#c9beb0',
    1.5,
  );
  ctx.fillStyle = table.spinRate > 4 || table.spinRate < -4 ? '#d1fded' : '#6ab9b3';
  ctx.fillRect(145, 77 - Math.abs(vane) / 2, 16, Math.max(1.3, Math.abs(vane)));
  lettering(ctx, 'SPIN', 153, 88, 5.3, '#b4c6ae');
  for (const p of returnPosts) {
    disc(ctx, p.x, p.y, 4.9, '#17252b');
    disc(ctx, p.x, p.y, 3.3, '#b5cabb');
    disc(ctx, p.x - 1, p.y - 1, 1.1, '#f8e6bf');
  }
  lettering(ctx, 'WEST', 27, 219, 5.8, '#95c6c0');
  lettering(ctx, 'EAST', 278, 219, 5.8, '#95c6c0');
  for (const burst of table.sparks) {
    const age = 1 - burst.life / 0.35,
      r = 3 + age * 12;
    for (let i = 0; i < 6; i++) {
      const a = (i * twoPi) / 6;
      stroke(
        ctx,
        [
          [burst.x + r * Math.cos(a), burst.y + r * Math.sin(a)],
          [burst.x + (r + 2.5) * Math.cos(a), burst.y + (r + 2.5) * Math.sin(a)],
        ],
        burst.color,
        1.5,
      );
    }
  }
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
  for (let i = 0; i < 11; i++) {
    const x = 13 + i * 27,
      lit = table.surge > 0 || (i + Math.floor(table.time * 5)) % 7 === 0;
    disc(ctx, x, 9, 2.7, '#19272c');
    disc(ctx, x, 9, lit ? 1.9 : 1.4, lit ? '#f9d289' : '#886b51');
  }
  for (let i = 0; i < 5; i++) {
    const y = 276 + i * 4;
    stroke(
      ctx,
      [
        [115 + i * 3, y],
        [152, y + 8],
        [190 - i * 3, y],
      ],
      table.surge > 0 ? '#d1b471' : '#38585a',
      1,
    );
  }
  const trace = '#335356';
  for (const [i, bank] of banks.entries()) {
    const endX = 112 + i * 40;
    stroke(
      ctx,
      [
        [bank.x, bank.y],
        [bank.x, 172],
        [endX, 190],
        [endX, 212],
      ],
      table.lit[i] ? bank.color : trace,
      2,
    );
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
  // Two engraved turbines spin up as breakers come online.
  for (const x of [80, 225]) {
    const y = 231;
    disc(ctx, x, y, 12, '#12282f');
    disc(ctx, x, y, 10.5, power ? '#467577' : '#35595c');
    disc(ctx, x, y, 8.7, '#1c393f');
    for (let vane = 0; vane < 6; vane++) {
      const angle = (vane * Math.PI) / 3 + (0.12 + 0.8 * power) * table.time;
      stroke(
        ctx,
        [
          [x + 3 * Math.cos(angle), y + 3 * Math.sin(angle)],
          [x + 7 * Math.cos(angle + 0.36), y + 7 * Math.sin(angle + 0.36)],
        ],
        power ? '#8ebeb0' : '#608286',
        1.6,
      );
    }
    disc(ctx, x, y, 2.4, '#c6aa80');
  }
  lettering(ctx, 'B L A C K   S T A R T', 153, 247, 9.5, '#c8d3ba');
  lettering(ctx, 'POWER STATION', 153, 266, 8, '#92b4a9');

  const rampInk = power === 3 ? '#fcdb78' : '#6a8980';
  stroke(
    ctx,
    [
      [109, 67],
      [119, 30],
      [187, 30],
      [197, 67],
    ],
    rampInk,
    2.7,
  );
  for (const y of [56, 63, 70])
    stroke(
      ctx,
      [
        [133, y + 2],
        [153, y - 3],
        [173, y + 2],
      ],
      rampInk,
      2,
    );
  lettering(ctx, 'GENERATOR', 153, 45, 9, power === 3 ? '#fff2ae' : '#a8bbac');
  for (const [ax, ay, bx, by] of rails) {
    stroke(
      ctx,
      [
        [ax, ay],
        [bx, by],
      ],
      '#17272c',
      8,
    );
    stroke(
      ctx,
      [
        [ax, ay],
        [bx, by],
      ],
      '#94b1a0',
      3.4,
    );
  }
  wireform(ctx, table);
  for (const [index, points] of outlines.entries()) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = table.slingHits[index] ? '#fee6a5' : '#b16e56';
    ctx.fill();
    ctx.strokeStyle = '#e4c393';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const [i, bank] of banks.entries()) {
    const live = table.lit[i];
    for (let tooth = 0; tooth < 8; tooth++) {
      const angle = (tooth * Math.PI) / 4;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      stroke(
        ctx,
        [
          [bank.x + dx * (bank.radius + 3), bank.y + dy * (bank.radius + 3)],
          [bank.x + dx * (bank.radius + 5), bank.y + dy * (bank.radius + 5)],
        ],
        live ? bank.color : '#526b68',
        2,
      );
    }
    disc(ctx, bank.x, bank.y + 2, bank.radius + 3, '#0d2026');
    disc(ctx, bank.x, bank.y, bank.radius + 1, table.hits[i] ? '#fff6be' : bank.color);
    disc(ctx, bank.x, bank.y, bank.radius - 3, live ? bank.color : '#293c41');
    lettering(ctx, String.fromCharCode(65 + i), bank.x, bank.y + 4.6, 14, live ? '#1a3436' : bank.color);
    lettering(ctx, bank.name.toUpperCase(), bank.x, bank.y + 32, 9.5, live ? '#faf1cc' : '#c1d2c5');
  }
  for (const [i, bank] of banks.entries()) {
    const glow = ctx.createRadialGradient(bank.x, bank.y, 5, bank.x, bank.y, 30);
    glow.addColorStop(0, table.lit[i] ? bank.color + '50' : bank.color + '18');
    glow.addColorStop(1, bank.color + '00');
    disc(ctx, bank.x, bank.y, 30, glow);
  }
  devices(ctx, table);
  const live = table.surge > 0;
  ctx.fillStyle = live ? '#64583d' : '#142a32';
  ctx.fillRect(110, 249, 86, 10);
  lettering(
    ctx,
    live ? 'SURGE  ×2  ' + Math.ceil(table.surge) : String(table.score).padStart(6, '0'),
    153,
    257,
    8,
    live ? '#ffe1a1' : '#96d8bc',
  );
  lettering(ctx, table.kickback ? 'KICKBACK LIT' : 'KICKBACK', 153, 311, 6.1, table.kickback ? '#a2f2cb' : '#64877f');
  // A separate spring and ball trough keep the number of balls left visible on the table.
  stroke(
    ctx,
    [
      [272, 21],
      [299, 33],
      [329, 62],
      [329, 351],
    ],
    '#718c86',
    3,
  );
  stroke(
    ctx,
    [
      [307, 76],
      [307, 352],
    ],
    '#536d6e',
    2,
  );
  const springTop = 336 + table.charge * 19;
  const spring = [[319, springTop]];
  for (let i = 1; i <= 8; i++) spring.push([319 + (i % 2 ? -6 : 6), springTop + (i * (365 - springTop)) / 9]);
  stroke(ctx, spring, '#efbe80', 2);
  const ball = table.ball;
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? 82 : 225;
    const sign = i === 0 ? 1 : -1;
    const angle = table.angles[i];
    const points = [
      [x, pivotY],
      [x + sign * Math.cos(angle) * batLength, pivotY + Math.sin(angle) * batLength],
    ];
    stroke(ctx, points, '#182932', 13);
    stroke(ctx, points, '#eca071', 9);
    disc(ctx, x, pivotY, 3.3, '#fff0c6');
  }
  lettering(ctx, 'BALL', 36, 360, 8, '#a9bbaf');
  for (let i = 0; i < 3; i++) disc(ctx, 57 + 12 * i, 357, 3.5, i < table.balls ? '#ebd2a3' : '#3e5051');
  const by = ball.y + (table.phase === 'charging' ? table.charge * 19 : 0);
  if (table.phase === 'play' && Math.hypot(ball.vx, ball.vy) > 140) {
    for (let i = 3; i > 0; i--)
      disc(ctx, ball.x - i * ball.vx * 0.007, by - i * ball.vy * 0.007, radius * (1 - i * 0.17), '#b2ebe526');
  }
  disc(ctx, ball.x + 1.4, by + 2, radius + 0.6, '#17232a');
  disc(ctx, ball.x, by, radius, '#a9c8c5');
  disc(ctx, ball.x - 1.6, by - 1.6, radius * 0.55, '#f7f8df');
}

export function tableTouchControl(phase, fraction) {
  if ((phase === 'ready' || phase === 'charging') && fraction > 0.87) return 2;
  return fraction < 0.5 ? 0 : 1;
}

export default function mount(api) {
  const table = newTable();
  const { canvas, ctx } = api.canvas(width * 2, height * 2);
  ctx.scale(2, 2);
  canvas.style.maxWidth = 'min(100%, 25rem, 66dvh)';
  canvas.style.margin = '0 auto';
  canvas.style.touchAction = 'none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Power station pinball. Outer wire orbits lead to opposite return lanes. Three capacitor drop targets start double scoring. Light the three breaker bumpers and flip up the center ramp to win.',
  );
  const pressed = new Map();
  function launch() {
    if (table.phase !== 'ready' && table.phase !== 'charging') return;
    launchBall(table);
    api.sfx?.('plunger');
  }
  function flip(index, pulseDuration) {
    if (table.phase === 'play' && !table.held[index] && !table.pulse[index]) api.sfx?.('flipper');
    table.pulse[index] = pulseDuration;
  }
  function press(id, control) {
    if (pressed.has(id)) return;
    pressed.set(id, control);
    if (control === 2) pullPlunger(table);
    else {
      flip(control, 0.1);
      table.held[control] = true;
    }
  }
  function release(id) {
    const control = pressed.get(id);
    pressed.delete(id);
    if (control === undefined || [...pressed.values()].includes(control)) return;
    if (control === 2) launch();
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
  const plunge = api.action(
    'Plunger',
    event => {
      if (event.detail === 0) launch();
    },
    { primary: true },
  );
  bindPointer(plunge, () => 2);
  const flippers = ['Left flipper', 'Right flipper'].map((label, index) => {
    const button = api.action(label, event => {
      if (event.detail === 0) flip(index, 0.13);
    });
    bindPointer(button, () => index);
    return button;
  });
  bindPointer(canvas, event => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    return tableTouchControl(table.phase, x);
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
    if (table.phase === 'charging') {
      table.phase = 'ready';
      table.charge = 0;
    }
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
    const power = table.phase === 'charging' ? ' · Plunger ' + Math.round((100 * table.charge) / 0.9) + '%' : '';
    const live = banks.filter((_, i) => table.lit[i]).map(bank => bank.name);
    const breakers = live.length ? live.length + '/3 online · ' + live.join(' + ') : '0/3 breaker banks';
    api.setHud(
      table.score.toLocaleString() +
        ' pts · ' +
        breakers +
        ' · ' +
        table.balls +
        (table.balls === 1 ? ' ball left' : ' balls left') +
        power,
    );
    if (table.message) {
      api.setStatus(table.message);
      table.message = '';
    }
    paint(ctx, table);
  }
  api.setStatus(
    'Hold Space or the plunger for power, then release. Flip with ← / → or A / D. On touch, press the left or right half of the table.',
  );
  update();
  const bankCues = ['cooling', 'memory', 'relay'];
  const rang = [false, false, false];
  let previousOrbits = 0,
    previousSurges = 0,
    previousSpins = 0;
  api.frame(dt => {
    const balls = table.balls;
    const outcome = stepTable(table, dt);
    // A bank rings once when its breaker latches, even if the ball keeps bouncing there.
    for (let i = 0; i < bankCues.length; i++) {
      if (table.lit[i] && !rang[i]) {
        api.sfx?.(bankCues[i]);
        rang[i] = true;
      }
    }
    if (table.circuits > previousSurges) api.sfx?.('relay');
    else if (table.orbits > previousOrbits) api.sfx?.('memory');
    else if (table.spins > previousSpins) api.sfx?.('cooling');
    previousSurges = table.circuits;
    previousOrbits = table.orbits;
    previousSpins = table.spins;
    if (!outcome && table.balls < balls) api.sfx?.('drain');
    update();
    if (outcome)
      api.finish(
        outcome,
        outcome === 'complete'
          ? 'Generator spinning. Every window in the facility lights up.'
          : table.lit.filter(Boolean).length + ' of three breaker banks stayed online when the last ball drained.',
      );
  });
}
