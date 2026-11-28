const north = 0, east = 1, south = 2, west = 3;
const dx = [0, 1, 0, -1];
const dy = [-1, 0, 1, 0];
const faces = ['north', 'east', 'south', 'west'];
const samples = [
  {
    edges: [[3,4], [4,1], [1,0], [1,2], [2,5], [4,7], [7,6], [7,8]],
    source: [3,west], probes: [[0,north], [5,east], [6,south], [8,east]],
    finding: 'The four bursts share one pulse. Their different arrival times can be explained by a branching relay.',
  },
  {
    edges: [[4,3], [4,5], [4,1], [1,0], [1,2], [3,6], [6,7], [7,8]],
    source: [3,west], probes: [[2,east], [0,north], [5,east], [8,south]],
    finding: 'Four traces that looked independent are copies. One persistent signal accounts for every observation.',
  },
  {
    edges: [[3,0], [0,1], [1,4], [4,5], [5,2], [4,7], [7,8], [3,6]],
    source: [3,west], probes: [[6,south], [1,north], [2,north], [8,east]],
    finding: 'The last receiver confirms the timestamp of the original transmission.',
  },
];
const span = 82, left = 47, top = 40, width = 340, height = 326;

function neighbor(cell, face) {
  const x = cell % 3 + dx[face], y = Math.floor(cell / 3) + dy[face];
  return x < 0 || x >= 3 || y < 0 || y >= 3 ? -1 : y * 3 + x;
}

export function turnMask(mask, steps = 1) {
  const n = ((steps % 4) + 4) % 4;
  return ((mask << n) | (mask >> (4 - n))) & 15;
}

function transformCell(cell, rotation, reflected) {
  let x = cell % 3, y = Math.floor(cell / 3);
  if (reflected) x = 2 - x;
  for (let i = 0; i < rotation; i++) [x, y] = [2 - y, x];
  return y * 3 + x;
}

export function makePattern(sample, rotation, reflected) {
  const template = samples[sample];
  const transform = cell => transformCell(cell, rotation, reflected);
  function port([cell, face]) {
    const mirroredFace = reflected ? (4 - face) % 4 : face;
    return [transform(cell), (mirroredFace + rotation) % 4];
  }
  const source = port(template.source), probes = template.probes.map(port);
  const masks = Array(9).fill(0);
  for (const [a, b] of template.edges) {
    const u = transform(a), v = transform(b);
    const side = faces.findIndex((_, direction) => neighbor(u, direction) === v);
    masks[u] |= 1 << side;
    masks[v] |= 1 << ((side + 2) % 4);
  }
  for (const [cell, face] of [source, ...probes]) masks[cell] |= 1 << face;
  return { masks, source, probes, finding: template.finding };
}

export function readPattern({ source, probes, masks }) {
  const visited = new Set(), lit = new Set(), leaks = [];
  const [start, edge] = source;
  const queue = masks[start] & (1 << edge) ? [start] : [];
  while (queue.length) {
    const cell = queue.pop();
    if (visited.has(cell)) continue;
    visited.add(cell);
    for (let direction = 0; direction < 4; direction++) {
      if (!(masks[cell] & (1 << direction))) continue;
      if (cell === start && direction === edge) continue;
      const next = neighbor(cell, direction);
      if (next < 0) {
        const probe = probes.findIndex(([c, d]) => c === cell && d === direction);
        if (probe >= 0) lit.add(probe); else leaks.push([cell, direction]);
      } else if (masks[next] & (1 << ((direction + 2) % 4))) queue.push(next);
      else leaks.push([cell, direction]);
    }
  }
  return { visited, lit, leaks, complete: visited.size === 9 && lit.size === probes.length && !leaks.length };
}

export function scramblePattern(model, random = Math.random, target = 6) {
  // Leave the opening trace mostly wired. Later captures lose more of their alignment.
  const order = Array.from({ length: 9 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let changes = 0;
  for (const cell of order) {
    const original = model.masks[cell], alternatives = [];
    for (let n = 1; n < 4; n++) {
      const alternative = turnMask(original, n);
      if (alternative !== original && !alternatives.includes(alternative)) alternatives.push(alternative);
    }
    if (!alternatives.length) continue;
    model.masks[cell] = alternatives[Math.floor(random() * alternatives.length)];
    if (++changes === target) break;
  }
  // A different valid wiring is a win too. Ensure a trial never starts solved.
  if (readPattern(model).complete) model.masks[model.source[0]] = turnMask(model.masks[model.source[0]]);
  return model;
}

const archiveWindow = 100;
const traceCount = 3;

function capture(session) {
  const sample = session.order[session.recorded];
  const rotation = Math.floor(session.random() * 4);
  const reflected = session.random() < .5;
  const puzzle = makePattern(sample, rotation, reflected);
  return scramblePattern(puzzle, session.random, 3 + session.recorded * 2);
}

export function newTraceRun(random = Math.random) {
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const run = { random, order, recorded: 0, remaining: archiveWindow, outcome: null, model: null };
  run.model = capture(run);
  return run;
}

export function tickTrace(run, seconds) {
  if (run.outcome) return;
  run.remaining = Math.max(0, run.remaining - seconds);
  if (run.remaining === 0) run.outcome = run.recorded ? 'partial' : 'failed';
}

export function submitTrace(run) {
  if (run.outcome) return;
  if (!readPattern(run.model).complete) { tickTrace(run, 4); return 'miss'; }
  run.recorded++;
  if (run.recorded === traceCount) run.outcome = 'complete';
  else run.model = capture(run);
  return 'recorded';
}

function draw(ctx, model, reading, selected, markLeaks, time, run) {
  const line = (x, y, x2, y2, color, size = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  };
  function dot(x, y, radius, fill) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill();
  }
  const center = cell => [left + (cell % 3 + .5) * span, top + (Math.floor(cell / 3) + .5) * span];
  const ink = '#c4b7d5', live = '#83e5ce', off = '#756984';
  ctx.fillStyle = '#191724'; ctx.fillRect(0, 0, width, height);
  for (let x = 6; x < width; x += 12) for (let y = 6; y < height; y += 12) {
    ctx.fillStyle = '#353046'; ctx.fillRect(x, y, 1.3, 1.3);
  }
  ctx.lineCap = 'round';
  model.masks.forEach((mask, cell) => {
    const [x, y] = center(cell), alive = reading.visited.has(cell), half = span / 2;
    ctx.fillStyle = alive ? '#1a3438' : '#292537';
    ctx.fillRect(x - half + 1, y - half + 1, span - 2, span - 2);
    for (let d = 0; d < 4; d++) if (mask & (1 << d)) {
      line(x, y, x + dx[d] * half, y + dy[d] * half, alive ? live : off, 6);
      if (alive) {
        const flow = (time * 1.35 + cell * .17) % 1;
        dot(x + dx[d] * flow * half, y + dy[d] * flow * half, 2, '#e3fff2');
      }
    }
    dot(x, y, 8, alive ? live : off);
    dot(x, y, 3, alive ? '#204841' : '#332d41');
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = ink; ctx.textAlign = 'left';
    ctx.fillText(String(cell + 1), x - half + 6, y - half + 13);
    if (cell === selected) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#ffcb77'; ctx.strokeRect(x - half + 3, y - half + 3, span - 6, span - 6);
    }
  });
  function terminal([cell, side], label, active, isSource = false) {
    const [x, y] = center(cell);
    const x1 = x + dx[side] * span / 2, y1 = y + dy[side] * span / 2;
    const x2 = x1 + dx[side] * 15, y2 = y1 + dy[side] * 15;
    const color = isSource ? '#ffcb77' : active ? live : ink;
    line(x1, y1, x2, y2, color, 3);
    dot(x2, y2, 5.5, color);
    if (!active && !isSource) dot(x2, y2, 3, '#191724');
    // Put side labels above their pins to leave the board most of the width on phones.
    ctx.textAlign = 'center'; ctx.font = 'bold 15px monospace'; ctx.fillStyle = color;
    ctx.fillText(label, x2, dy[side] ? y2 + dy[side] * 12 + 5 : y2 - 10);
  }
  const meterColor = run.remaining < 15 ? '#ff937c' : '#83e5ce';
  ctx.fillStyle = '#393145'; ctx.fillRect(left, height - 5, span * 3, 3);
  ctx.fillStyle = meterColor; ctx.fillRect(left, height - 5, span * 3 * run.remaining / archiveWindow, 3);
  terminal(model.source, 'INPUT', true, true);
  model.probes.forEach((port, i) => terminal(port, String.fromCharCode(65 + i), reading.lit.has(i)));
  if (markLeaks) for (const [cell, side] of reading.leaks) {
    const [x, y] = center(cell), px = x + dx[side] * 27, py = y + dy[side] * 27;
    line(px - 3, py - 3, px + 3, py + 3, '#ff937c', 2);
    line(px - 3, py + 3, px + 3, py - 3, '#ff937c', 2);
  }
}

export default function mount(api) {
  const run = newTraceRun();
  const { canvas, ctx } = api.canvas(width, height);
  let selected = run.model.source[0], rotations = 0, markLeaks = false, time = 0;
  let reading, lastPaint = -1, lastSecond = -1;
  function describeCell() {
    const ports = faces.filter((_, d) => run.model.masks[selected] & (1 << d));
    return 'Tile ' + (selected + 1) + ' connects ' + ports.join(', ') + '.';
  }
  function paint() {
    draw(ctx, run.model, reading, selected, markLeaks, time, run);
    lastPaint = time;
  }
  function hud() {
    lastSecond = Math.ceil(run.remaining);
    api.setHud('Trace ' + Math.min(run.recorded + 1, traceCount) + '/3 · Sweep in ' + lastSecond + 's · ' + reading.lit.size + ' / 4 observations · Tile ' + (selected + 1));
  }
  function display() {
    reading = readPattern(run.model);
    hud(); paint();
    canvas.setAttribute('aria-label', 'Observation grid. ' + describeCell() + ' Input at tile ' + (run.model.source[0] + 1) + ' ' + faces[run.model.source[1]] +
      '. Observations ' + run.model.probes.map(([c, d], i) => String.fromCharCode(65 + i) + ' at ' + (c + 1) + ' ' + faces[d]).join(', ') + '.');
    return reading;
  }
  function finish() {
    api.finish(run.outcome, run.outcome === 'complete' ? 'Three traces archived before the receiver erased its buffer. The timing identifies a single source. ' + rotations + ' rotations.' :
      'The receiver swept its buffer. ' + run.recorded + ' of 3 traces were archived.');
  }
  function rotate(amount) {
    if (run.outcome) return;
    run.model.masks[selected] = turnMask(run.model.masks[selected], amount);
    rotations++; markLeaks = false;
    const reading = display();
    api.sfx?.(reading.complete ? 'matched' : 'rotate');
    api.setStatus(reading.complete ? 'All four observations agree. Test your model to record the finding.' : describeCell());
  }
  function select(cell) {
    if (run.outcome || cell < 0) return;
    selected = cell; display(); api.setStatus(describeCell());
  }
  function test() {
    if (run.outcome) return;
    const finding = run.model.finding;
    const result = submitTrace(run);
    if (run.outcome) { display(); finish(); return; }
    if (result === 'recorded') {
      selected = run.model.source[0]; markLeaks = false;
      api.sfx?.('matched');
      api.setStatus('Trace ' + run.recorded + ' archived. ' + finding + ' The next capture is on the board.');
    } else {
      markLeaks = true;
      api.sfx?.('test');
      api.setStatus('Rejected sample costs 4 seconds. Open live leads are marked ×. Connect INPUT through all nine tiles.');
    }
    display();
  }
  function tap(event) {
    const bounds = canvas.getBoundingClientRect();
    const col = Math.floor(((event.clientX - bounds.left) * width / bounds.width - left) / span);
    const row = Math.floor(((event.clientY - bounds.top) * height / bounds.height - top) / span);
    if (!run.outcome && col >= 0 && col < 3 && row >= 0 && row < 3) {
      selected = row * 3 + col; rotate(1);
    }
  }
  canvas.addEventListener('click', tap);
  canvas.style.cursor = 'pointer';
  canvas.style.width = 'min(100%, 26rem)';
  canvas.style.marginInline = 'auto';
  api.action('Previous tile', () => select((selected + 8) % 9));
  api.action('Next tile', () => select((selected + 1) % 9));
  api.action('Rotate ↺', () => rotate(-1));
  api.action('Rotate ↻', () => rotate(1));
  api.action('Test model', test, { primary: true });
  api.onKey(event => {
    if (run.outcome || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key);
    if (direction >= 0) { event.preventDefault(); select(neighbor(selected, direction)); }
    else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); select(Number(event.key) - 1); }
    else if (['q', 'e', 't'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.repeat) return;
      if (event.key.toLowerCase() === 't') test(); else rotate(event.key.toLowerCase() === 'q' ? -1 : 1);
    }
  });
  display();
  api.frame(dt => {
    time += dt;
    tickTrace(run, dt);
    if (Math.ceil(run.remaining) !== lastSecond) hud();
    if (run.outcome) { paint(); finish(); }
    else if (time - lastPaint > 1 / 30) paint();
  });
  api.setStatus('Archive three traces before the receiver sweeps its buffer. Wire INPUT to observations A–D using all nine tiles. Tap a tile to turn it, or select with arrows or 1–9 and rotate with Q/E. When the paths glow, test with T.');
}
