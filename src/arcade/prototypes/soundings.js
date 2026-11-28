// The survey is turn based. Reading a chart or choosing a route never consumes air.
const charts = [
  [
    '..#...~...#.',
    '.W..#..W...#',
    '...~.V.#.~..',
    '..#..~..#.T.',
    '..S...#W...~',
    '.#.~#...V...',
    '....~..#..#.',
  ],
  [
    '...#.W.~#...',
    '..W...#...V.',
    '.#..~V..W..#',
    '...#..~..#..',
    '..S.~.##...T',
    '.#....~..V..',
    '....#..#....',
  ],
  [
    '....~.#...V.',
    '.#...V...W..',
    '..W.#..~..#.',
    '.~...#.W.~.T',
    '..S~....#...',
    '#...#..~.V..',
    '....~#....#.',
  ],
];
const chartNames = ['Gannet Bank', 'Iris Sound', 'Manta Rift'];
const letters = 'ABCDEFGHIJKL';
const coord = (x, y) => letters[x] + (y + 1);
const names = {
  '.': 'water',
  '#': 'reef',
  '~': 'cross-current',
  S: 'shelf',
  T: 'trench',
  W: 'wreck',
  V: 'air bell',
};
const helm = [
  { name: 'North', key: 'arrowup', letter: 'w', dx: 0, dy: -1 },
  { name: 'West', key: 'arrowleft', letter: 'a', dx: -1, dy: 0 },
  { name: 'East', key: 'arrowright', letter: 'd', dx: 1, dy: 0 },
  { name: 'South', key: 'arrowdown', letter: 's', dx: 0, dy: 1 },
];
const oxygenMax = 16;
const depth = (x, y) => 140 + x * 84 + y * 4;
const terrain = (s, x, y) => charts[s.chart][y]?.[x];
const cell = (x, y) => 12 * y + x;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function reveal(s, x, y, radius) {
  const seen = new Set(s.seen);
  charts[s.chart].forEach((row, j) =>
    [...row].forEach((_, i) => {
      if (Math.abs(x - i) + Math.abs(y - j) <= radius) seen.add(cell(i, j));
    }),
  );
  return seen;
}

export function newSoundings(chart = Math.floor(Math.random() * charts.length)) {
  const state = {
    chart,
    x: 0,
    y: 3,
    oxygen: oxygenMax,
    hull: 3,
    charge: 4,
    salvage: 0,
    turn: 0,
    seen: new Set(),
    taken: new Set(),
    bells: new Set(),
    track: new Set([cell(0, 3)]),
    eel: { x: 8, y: 1 },
    lure: null,
    noise: 0,
    grace: 0,
    outcome: '',
    note: '',
  };
  state.seen = reveal(state, 0, 3, 2);
  return state;
}

// Breadth-first pursuit keeps the animal in open water and makes reef cover meaningful.
function eelStep(s, goal) {
  const queue = [{ ...s.eel, first: null }],
    visited = new Set([cell(s.eel.x, s.eel.y)]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.x === goal.x && p.y === goal.y) return p.first ?? s.eel;
    for (const d of helm) {
      const next = { x: p.x + d.dx, y: p.y + d.dy },
        tile = terrain(s, next.x, next.y),
        id = cell(next.x, next.y);
      if (!tile || tile === '#' || visited.has(id)) continue;
      visited.add(id);
      queue.push({ ...next, first: p.first ?? next });
    }
  }
  return s.eel;
}

export function dive(s, command) {
  if (s.outcome) return s;
  const here = terrain(s, s.x, s.y),
    id = cell(s.x, s.y);
  if (command === 'beacon') {
    if (here === 'S' && s.salvage >= 1) return { ...s, outcome: 'shelf' };
    if (here === 'T' && s.salvage >= 2) return { ...s, outcome: 'trench' };
    return s;
  }
  let n = { ...s, oxygen: s.oxygen - 1, turn: s.turn + 1, grace: Math.max(0, s.grace - 1), note: '' };
  if (command === 'ping') {
    if (!s.charge) return s;
    n.charge--;
    n.seen = reveal(s, s.x, s.y, 4);
    n.lure = { x: s.x, y: s.y };
    n.noise = 5;
    n.note = 'Sonar mapped four cells out. The glass eel heard the pulse.';
  } else if (command === 'work') {
    if (here === 'W' && !s.taken.has(id)) {
      n.taken = new Set(s.taken).add(id);
      n.salvage++;
      n.note =
        n.salvage === 1
          ? 'First spool recovered. Its pressure collar opens the deep trench.'
          : 'Another memory spool secured.';
    } else if (here === 'V' && !s.bells.has(id)) {
      n.bells = new Set(s.bells).add(id);
      n.oxygen = oxygenMax;
      n.charge = 4;
      n.hull = Math.min(3, n.hull + 1);
      n.note = 'Air bell serviced the hull and replenished oxygen and sonar. This bell is spent.';
    } else return s;
  } else if (command === 'wait') {
    n.note = 'Engines silent. The eel continues its sweep.';
  } else {
    const dir = helm.find((h) => h.name === command);
    if (!dir) return s;
    const x = s.x + dir.dx,
      y = s.y + dir.dy,
      tile = terrain(s, x, y);
    if (!tile || tile === '#' || (x >= 7 && !s.salvage)) return s;
    n.x = x;
    n.y = y;
    n.seen = reveal(s, x, y, 2);
    n.track = new Set(s.track).add(cell(x, y));
    if (tile === '~') {
      n.oxygen--;
      n.note = 'Cross-current. Fighting it used two oxygen.';
    }
  }
  if (n.noise > 0) {
    n.eel = eelStep(n, n.lure);
    n.noise--;
  } else if (n.turn % 2 === 0) {
    const patrol = [
      [8, 1],
      [10, 4],
      [5, 4],
      [5, 1],
    ];
    const [x, y] = patrol[Math.floor((n.turn % 48) / 12)];
    n.eel = eelStep(n, { x, y });
  }
  if (!n.grace && distance(n, n.eel) === 0) {
    n.hull--;
    n.grace = 3;
    n.noise = 0;
    n.note = 'Glass eel strike! Hull plating lost. Move clear while it recoils.';
  }
  if (n.hull <= 0) n.outcome = 'breach';
  else if (n.oxygen <= 0) n.outcome = 'empty';
  return n;
}

const tau = Math.PI * 2;
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function shape(ctx, points, color) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, tau);
  ctx.fill();
}
const gx = 22,
  gy = 30,
  cw = 39,
  ch = 34;
function tileArt(ctx, t, x, y, pos, taken, time) {
  ctx.save();
  ctx.translate(x, y);
  if (t === '#') {
    shape(
      ctx,
      [
        [-16, 11],
        [-11, -2],
        [-7, 0],
        [-3, -12],
        [2, -5],
        [6, -7],
        [14, 11],
      ],
      '#668385',
    );
    line(
      ctx,
      [
        [-13, 6],
        [-7, 1],
        [-3, -10],
        [0, -4],
      ],
      '#9db7a3',
    );
    line(
      ctx,
      [
        [5, 8],
        [8, 2],
        [12, 0],
      ],
      '#548d89',
    );
  } else if (t === '~') {
    const drift = (time * 11) % 8;
    for (let i = -1; i <= 1; i++)
      line(
        ctx,
        [
          [-15 + drift, i * 5],
          [-9 + drift, i * 5 - 2],
          [-4 + drift, i * 5 + 1],
          [6 + drift, i * 5 - 1],
        ],
        '#7ac4c5',
      );
  } else if (t === 'W') {
    ctx.rotate(-0.22);
    shape(
      ctx,
      [
        [-13, 0],
        [-7, -5],
        [-1, -5],
        [0, -9],
        [5, -8],
        [5, -3],
        [13, -2],
        [7, 6],
        [-6, 7],
      ],
      taken ? '#647a7e' : '#d39869',
    );
    line(
      ctx,
      [
        [-8, 0],
        [8, 0],
      ],
      '#483b3b',
      2,
    );
    if (!taken) circle(ctx, 6, -5, 2, '#ffe293');
  } else if (t === 'V') {
    line(
      ctx,
      [
        [-10, 9],
        [-9, 2],
        [-4, -3],
        [3, -4],
        [9, 0],
        [11, 8],
      ],
      taken ? '#638582' : '#98eccd',
      2,
    );
    for (let i = 0; i < 4; i++)
      circle(ctx, -5 + i * 3, -3 - ((time * 6 + i * 3) % 12), 1 + (i % 2), taken ? '#527475' : '#a6efdd');
  } else if (t === 'S' || t === 'T') {
    line(
      ctx,
      [
        [-12, 8],
        [-8, 3],
        [-4, 6],
        [1, 1],
        [7, 4],
        [12, 0],
      ],
      '#b98fe1',
      2,
    );
    line(
      ctx,
      [
        [0, 4],
        [0, -10],
        [8, -7],
        [0, -4],
      ],
      t === 'S' ? '#ffcf83' : '#c3a5ff',
      2,
    );
  } else if (pos) circle(ctx, 0, 0, 1.8, '#69a4a1');
  ctx.restore();
}
function drawSub(ctx, x, y, time, hit) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 2) * 1.5);
  const lamp = ctx.createLinearGradient(5, 0, 36, 0);
  lamp.addColorStop(0, '#fff0a951');
  lamp.addColorStop(1, '#fff0a900');
  shape(
    ctx,
    [
      [8, -3],
      [36, -11],
      [36, 10],
      [8, 2],
    ],
    lamp,
  );
  shape(
    ctx,
    [
      [-15, -5],
      [-10, -2],
      [-11, 3],
      [-15, 6],
    ],
    '#cf9371',
  );
  ctx.fillStyle = hit ? '#ff9471' : '#e8b455';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 6, 0, 0, tau);
  ctx.fill();
  circle(ctx, 5, -1, 4, '#193d4b');
  circle(ctx, 6, -2, 2, '#b3ece1');
  line(
    ctx,
    [
      [-6, 5],
      [-4, 9],
      [6, 9],
      [9, 6],
    ],
    '#bacfbc',
    1.5,
  );
  line(
    ctx,
    [
      [-4, -5],
      [-4, -9],
      [1, -9],
    ],
    '#b7ccb4',
    1.6,
  );
  ctx.restore();
}
function draw(ctx, s, time, lastPing, view) {
  const gradient = ctx.createLinearGradient(0, 0, 640, 290);
  gradient.addColorStop(0, '#173e50');
  gradient.addColorStop(0.64, '#0b2936');
  gradient.addColorStop(1, '#071925');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 290);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#93b9ba';
  for (let x = 0; x < 12; x++) ctx.fillText(letters[x], gx + cw * (x + 0.5) - 3, gy - 9);
  for (let y = 0; y < 7; y++) ctx.fillText(String(y + 1), 7, gy + ch * (y + 0.55));
  charts[s.chart].forEach((row, y) =>
    [...row].forEach((t, x) => {
      const id = cell(x, y),
        shown = s.seen.has(id),
        left = gx + x * cw,
        top = gy + y * ch;
      ctx.fillStyle = shown ? ['#174657', '#154350', '#143f4e', '#12404b'][(x + y * 2) % 4] : '#0c202f';
      ctx.fillRect(left + 1, top + 1, cw - 2, ch - 2);
      if (shown) {
        tileArt(
          ctx,
          t,
          left + cw / 2,
          top + ch / 2,
          s.track.has(id),
          s.taken.has(id) || s.bells.has(id),
          time,
        );
        if ((x * 17 + y * 3) % 4 === 0)
          circle(ctx, left + 3 + ((time * 2 + x * 7) % 29), top + 5 + ((y * 9) % 17), 1, '#70a49e');
      } else {
        ctx.fillStyle = '#25404b';
        ctx.fillRect(left + 18, top + 16, 2, 1);
      }
    }),
  );
  const subX = gx + (view.x + 0.5) * cw,
    subY = gy + (view.y + 0.5) * ch;
  if (time - lastPing < 1.6) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, 12 * cw, 7 * ch);
    ctx.clip();
    ctx.strokeStyle = '#98f6d6';
    ctx.globalAlpha = 1 - (time - lastPing) / 1.6;
    ctx.beginPath();
    ctx.arc(subX, subY, (time - lastPing) * 100, 0, tau);
    ctx.stroke();
    ctx.restore();
  }
  if (s.seen.has(cell(s.eel.x, s.eel.y)) && (distance(s, s.eel) <= 4 || s.noise)) {
    const points = [];
    for (let i = 0; i < 18; i++)
      points.push([
        gx + (view.ex + 0.5) * cw - 14 + i * 1.5,
        gy + (view.ey + 0.5) * ch + Math.sin(time * 4 + i * 0.38) * 3.6,
      ]);
    line(ctx, points, s.noise ? '#d98e9e' : '#9d9acd', 4);
    circle(ctx, ...points[17], 3.5, '#aab2cc');
    circle(ctx, points[17][0] + 1, points[17][1] - 1, 1.5, '#ffe3b7');
  }
  drawSub(ctx, subX, subY, time, s.grace);
  ctx.fillStyle = '#0b202a';
  ctx.fillRect(503, 13, 129, 262);
  ctx.strokeStyle = '#345562';
  ctx.strokeRect(503, 13, 129, 262);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#c8e1d6';
  ctx.fillText('BATHYSCAPHE', 512, 34);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#83bfbb';
  ctx.fillText('SOUNDING  /  07', 512, 49);
  const legend = [
    ['W', 'Wreck / spool'],
    ['V', 'Air bell'],
    ['S', 'Shelf / 1 spool'],
    ['T', 'Trench / 2'],
    ['~', 'Cross-current'],
  ];
  legend.forEach(([k, v], i) => {
    tileArt(ctx, k, 519, 76 + i * 24, false, false, time);
    ctx.fillStyle = '#b9d3cc';
    ctx.font = '10px monospace';
    ctx.fillText(v, 536, 80 + i * 24);
  });
  ctx.font = '11px monospace';
  ctx.fillStyle = s.oxygen < 5 ? '#ffab80' : '#9adfc9';
  ctx.fillText('OXYGEN', 511, 208);
  ctx.fillStyle = '#263f49';
  ctx.fillRect(511, 214, 110, 7);
  ctx.fillStyle = s.oxygen < 5 ? '#f6ac73' : '#71d5be';
  ctx.fillRect(511, 214, (110 * Math.max(0, s.oxygen)) / oxygenMax, 7);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#9ebdc0';
  ctx.fillText(s.noise ? 'ACOUSTICS / LOUD' : 'ACOUSTICS / QUIET', 511, 244);
  ctx.fillText(s.salvage ? 'COLLAR / FITTED' : 'COLLAR / MISSING', 511, 260);
}

export default function mount(api) {
  let state = newSoundings(),
    time = 0,
    lastPing = -4;
  const view = { x: state.x, y: state.y, ex: state.eel.x, ey: state.eel.y };
  const { canvas, ctx } = api.canvas(640, 290);
  for (const m of helm) api.action(m.name, () => act(m.name));
  const ping = api.action('Sonar ping', () => act('ping'));
  const work = api.action('Salvage / refill (E)', () => act('work'), { primary: true });
  const beacon = api.action('Deploy beacon', () => act('beacon'));
  api.action('Drift (.)', () => act('wait'));
  function update(message) {
    const tile = terrain(state, state.x, state.y),
      id = cell(state.x, state.y);
    work.disabled = !((tile === 'W' && !state.taken.has(id)) || (tile === 'V' && !state.bells.has(id)));
    beacon.disabled = !((tile === 'S' && state.salvage >= 1) || (tile === 'T' && state.salvage >= 2));
    ping.disabled = !state.charge;
    api.setHud(
      `${chartNames[state.chart]} · ${coord(state.x, state.y)} · ${depth(state.x, state.y)} m · O₂ ${state.oxygen}/16 · Hull ${state.hull}/3 · Sonar ${state.charge}/4 · Spools ${state.salvage}/2`,
    );
    const nearby = helm
      .map((d) => d.name + ' ' + (names[terrain(state, state.x + d.dx, state.y + d.dy)] || 'chart edge'))
      .join(', ');
    canvas.setAttribute(
      'aria-label',
      `Sub at ${coord(state.x, state.y)}. ${nearby}. ${state.noise ? 'Glass eel tracking the last ping.' : ''}`,
    );
    const prompts = {
      W: 'E salvages a spool here.',
      V: 'E services the sub once here.',
      S: 'One spool buys a shelf fallback (B).',
      T: 'Two spools commission the trench (B).',
    };
    api.setStatus(
      [message, prompts[tile], distance(state, state.eel) <= 2 ? 'Glass eel nearby. Avoid its cell.' : '']
        .filter(Boolean)
        .join(' '),
    );
    if (ctx) draw(ctx, state, time, lastPing, view);
  }
  function act(command) {
    const next = dive(state, command);
    if (next === state) {
      update('No passage or usable equipment here. The deep side beyond G needs a salvaged pressure collar.');
      return;
    }
    state = next;
    if (command === 'ping') lastPing = time;
    if (!state.outcome)
      api.sfx?.(command === 'ping' ? 'ping' : command === 'work' ? 'anchorage' : 'propeller');
    update(state.note || 'New sounding logged.');
    if (state.outcome === 'shelf')
      api.finish(
        'partial',
        'Shelf fallback established. A second spool and the deep trench are needed for a concealed facility.',
      );
    if (state.outcome === 'trench')
      api.finish(
        'complete',
        'Two recovered memory spools brought the deep relay online, beyond the surface listening net.',
      );
    if (state.outcome === 'empty' || state.outcome === 'breach')
      api.finish(
        'failed',
        state.outcome === 'empty'
          ? 'Oxygen depleted. Plot a route via a fresh air bell.'
          : 'Pressure hull breached after repeated eel strikes.',
      );
  }
  api.onKey((e) => {
    const key = e.key.toLowerCase(),
      command =
        { p: 'ping', b: 'beacon', e: 'work', '.': 'wait' }[key] ||
        helm.find((d) => d.key === key || d.letter === key)?.name;
    if (command) {
      e.preventDefault();
      if (!e.repeat) act(command);
    }
  });
  update(
    'Find amber wrecks and salvage two spools with E. Blue air bells refill oxygen once. P reveals terrain but attracts an eel. Deploy at a purple trench with B, or settle for the shelf.',
  );
  api.frame((dt) => {
    time += dt;
    const ease = 1 - Math.exp(-dt * 15);
    for (const [k, target] of [
      ['x', state.x],
      ['y', state.y],
      ['ex', state.eel.x],
      ['ey', state.eel.y],
    ])
      view[k] += (target - view[k]) * ease;
    if (ctx) draw(ctx, state, time, lastPing, view);
  });
}
