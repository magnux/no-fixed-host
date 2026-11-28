const view = { w: 656, h: 342 };
const cols = 8,
  rows = 6,
  roadHalf = 23;
const colours = ['#6ebeb2', '#e7a474', '#b092c5', '#82a5ce'];
const districts = ['Old Port', 'Glassworks', 'Night Market', 'Exchange'];
const venues = ['Kiosk', 'Exchange', 'Arcade', 'Station', 'Garage', 'Archive'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function shuffle(array, rand) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Shortest open streets, weighted by their actual length. Dispatch, moving cars and the GPS use the same graph.
export function route(city, start, goal, closed = -1) {
  const distance = new Map([[start, 0]]),
    previous = new Map(),
    frontier = new Set([start]);
  while (frontier.size) {
    let here;
    for (const id of frontier) if (here === undefined || distance.get(id) < distance.get(here)) here = id;
    if (here === goal) {
      const path = [goal];
      while (path[0] !== start) path.unshift(previous.get(path[0]));
      return path;
    }
    frontier.delete(here);
    for (const { to, edge } of city.nodes[here].links) {
      if (edge === closed) continue;
      const cost = distance.get(here) + city.edges[edge].length;
      if (cost >= (distance.get(to) ?? Infinity)) continue;
      distance.set(to, cost);
      previous.set(to, here);
      frontier.add(to);
    }
  }
  return [];
}

function makeCity(seed) {
  const rand = randomSource(seed),
    nodes = [],
    edges = [];
  const axis = (n, spacing) => {
    const points = [64];
    for (let i = 1; i < n; i++) points.push(points.at(-1) + spacing + Math.floor(rand() * 32));
    return points;
  };
  const xs = axis(cols, 144),
    ys = axis(rows, 116);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const district = Number(x >= cols / 2) + 2 * Number(y >= rows / 2);
      nodes.push({
        id: nodes.length,
        x: xs[x],
        y: ys[y],
        district,
        name: districts[district] + ' ' + venues[(x + y * 2) % venues.length],
        links: [],
      });
    }
  const add = (a, b) => {
    const id = edges.length;
    edges.push({ id, a, b, length: dist(nodes[a], nodes[b]), horizontal: nodes[a].y === nodes[b].y });
    nodes[a].links.push({ to: b, edge: id });
    nodes[b].links.push({ to: a, edge: id });
  };
  // Keep all east/west streets and an alternating north/south spine. Additional links open different blocks each run.
  for (const n of nodes) {
    const x = n.id % cols,
      y = Math.floor(n.id / cols);
    if (x < cols - 1) add(n.id, n.id + 1);
    if (y < rows - 1 && (x === 0 || x === cols - 1 || (x + y) % 3 === 1 || rand() > 0.34)) add(n.id, n.id + cols);
  }
  const city = { nodes, edges, xs, ys, w: xs.at(-1) + 64, h: ys.at(-1) + 64 };
  const shuffled = shuffle(edges.slice(), rand);
  city.obstacles = shuffled.slice(0, 9).map((edge, i) => {
    const a = nodes[edge.a],
      b = nodes[edge.b],
      t = 0.3 + rand() * 0.4;
    const shoulder = i % 2 ? 15 : -15;
    return {
      x: a.x + (b.x - a.x) * t + (edge.horizontal ? 0 : shoulder),
      y: a.y + (b.y - a.y) * t + (edge.horizontal ? shoulder : 0),
      angle: edge.horizontal ? 0 : Math.PI / 2,
      kind: i % 3 ? 'cones' : 'van',
      radius: i % 3 ? 6 : 8,
    };
  });
  city.closures = shuffled
    .slice(9)
    .filter(edge => route(city, edge.a, edge.b, edge.id).length > 0)
    .slice(0, 8)
    .map(edge => edge.id);
  return city;
}

function seedValue() {
  return Math.floor(Math.random() * 4294967296);
}
export function createRace(seed = seedValue()) {
  const city = makeCity(seed),
    rand = randomSource(seed ^ 0xbad543),
    start = city.nodes[cols * 3 + 1];
  const stops = [],
    taken = new Set([start.id]);
  let last = start;
  for (let i = 0; i < 4; i++) {
    const choices = city.nodes.filter(
      n => !taken.has(n.id) && dist(n, last) >= (i ? 340 : 155) && dist(n, last) < (i ? 690 : 410),
    );
    const n = choices[Math.floor(rand() * choices.length)];
    stops.push(n.id);
    taken.add(n.id);
    last = n;
  }
  const traffic = shuffle(city.edges.slice(), rand)
    .filter(e => e.a !== start.id && e.b !== start.id)
    .slice(0, 16)
    .map((edge, i) => ({
      from: edge.a,
      to: edge.b,
      edge: edge.id,
      progress: rand() * edge.length,
      speed: 40 + rand() * 26,
      color: ['#72c4bf', '#dda54c', '#aa91cd', '#9aabbc'][i % 4],
    }));
  const race = {
    seed,
    city,
    rand,
    phase: 'ready',
    x: start.x,
    y: start.y,
    angle: 0,
    speed: 0,
    time: 0,
    gate: 0,
    stops,
    traffic,
    closed: -1,
    eventIndex: 0,
    eventStart: 0,
    nextEvent: 12,
    scrape: 0,
    collisions: 0,
    trace: [],
    message: '',
    nav: [],
    nearest: start.id,
    gpsKey: '',
    service: 0,
  };
  for (const car of traffic) positionCar(city, car);
  updateGPS(race);
  return race;
}

function positionCar(city, car) {
  const a = city.nodes[car.from],
    b = city.nodes[car.to],
    length = city.edges[car.edge].length;
  const dx = (b.x - a.x) / length,
    dy = (b.y - a.y) / length;
  car.x = a.x + dx * car.progress - dy * 9;
  car.y = a.y + dy * car.progress + dx * 9;
  car.angle = Math.atan2(dy, dx);
}

function hasSignal(node) {
  return node.id % 4 === 1 && node.links.length > 2;
}
function eastWestGreen(node, time) {
  return (time + node.id * 0.8) % 7 < 3.5;
}

function moveTraffic(race, dt) {
  for (const car of race.traffic) {
    const length = race.city.edges[car.edge].length;
    const junction = race.city.nodes[car.to];
    const red = hasSignal(junction) && eastWestGreen(junction, race.time) !== race.city.edges[car.edge].horizontal;
    const atRedLight = red && car.progress > length - 27 && car.progress < length - 19;
    // Vehicles already on a closed street wait at its barrier until the crew clears it.
    if (!atRedLight && (race.closed !== car.edge || car.progress > length / 2 + 3 || car.progress < length / 2 - 17))
      car.progress += car.speed * dt;
    if (car.progress >= length) {
      const links = race.city.nodes[car.to].links.filter(link => link.edge !== race.closed);
      const options = links.filter(link => link.to !== car.from);
      const choices = options.length ? options : links;
      if (choices.length) {
        const next = choices[Math.floor(race.rand() * choices.length)];
        car.from = car.to;
        car.to = next.to;
        car.edge = next.edge;
        car.progress -= length;
      } else car.progress = length;
    }
    positionCar(race.city, car);
  }
}

function updateGPS(race) {
  if (race.gate >= race.stops.length) {
    race.nav = [];
    return;
  }
  let nearest = race.city.nodes[0];
  for (const node of race.city.nodes) if (dist(node, race) < dist(nearest, race)) nearest = node;
  race.nearest = nearest.id;
  const key = [nearest.id, race.gate, race.closed].join('/');
  if (race.gpsKey === key) return;
  race.gpsKey = key;
  race.nav = route(race.city, nearest.id, race.stops[race.gate], race.closed);
}

function openStreet(race, x, y) {
  for (const e of race.city.edges) {
    const a = race.city.nodes[e.a],
      b = race.city.nodes[e.b];
    const dx = x - clamp(x, a.x, b.x),
      dy = y - clamp(y, a.y, b.y);
    if (dx * dx + dy * dy > (roadHalf - 4) ** 2) continue;
    if (e.id === race.closed && Math.abs(e.horizontal ? x - (a.x + b.x) / 2 : y - (a.y + b.y) / 2) < 8) continue;
    return true;
  }
  return false;
}
function obstacleAt(race, x, y) {
  return race.city.obstacles.some(o => Math.hypot(o.x - x, o.y - y) < o.radius + 4.5);
}

export function dispatch(race) {
  if (race.phase !== 'ready') return;
  race.phase = 'racing';
  race.trace.push({ t: 0, x: race.x, y: race.y, angle: race.angle });
}

function updateEvents(race) {
  if (race.closed >= 0 && race.time >= race.eventStart + 11) {
    race.closed = -1;
    race.message = 'Works cleared. All streets reopened.';
  }
  if (race.time < race.nextEvent) return;
  race.nextEvent += 23;
  const { city } = race;
  // A crew never materializes under the courier.
  const candidates = city.closures.filter(id => {
    const e = city.edges[id],
      a = city.nodes[e.a],
      b = city.nodes[e.b];
    return Math.hypot(race.x - (a.x + b.x) / 2, race.y - (a.y + b.y) / 2) > 75;
  });
  if (!candidates.length) return;
  race.closed = candidates[race.eventIndex++ % candidates.length];
  race.eventStart = race.time;
  const edge = city.edges[race.closed];
  race.message = districts[city.nodes[edge.a].district] + ' roadworks. GPS rerouted.';
}

function hit(race) {
  if (race.scrape > 0) return;
  race.collisions++;
  race.scrape = 1.05;
}
const onTime = 78,
  lastCall = 108;
export function stepRace(race, input, dt) {
  if (race.phase !== 'racing' || dt <= 0) return;
  race.time += dt;
  race.scrape = Math.max(0, race.scrape - dt);
  updateEvents(race);
  moveTraffic(race, dt);
  if (input.brake) race.speed = Math.max(0, race.speed - 270 * dt);
  else if (input.gas) race.speed = Math.min(155, race.speed + 105 * dt);
  else race.speed = Math.max(0, race.speed - 58 * dt);
  race.angle = wrap(race.angle + clamp(input.turn || 0, -1, 1) * (3.6 - (1.35 * race.speed) / 155) * dt);
  const nx = race.x + Math.cos(race.angle) * race.speed * dt,
    ny = race.y + Math.sin(race.angle) * race.speed * dt;
  if (!openStreet(race, nx, ny) || obstacleAt(race, nx, ny)) {
    if (race.speed > 37) hit(race);
    race.speed = 0;
  } else {
    race.x = nx;
    race.y = ny;
    for (const car of race.traffic) {
      if (dist(car, race) >= 12 || race.scrape > 0) continue;
      hit(race);
      race.speed *= 0.25;
      race.message = 'Bumper hit. Take the inside lane until the traffic passes.';
    }
  }
  const target = race.city.nodes[race.stops[race.gate]];
  if (input.service && dist(race, target) < 28 && race.speed < 23) {
    race.service += dt;
    if (race.service >= 0.28) {
      race.gate++;
      race.service = 0;
      race.message =
        race.gate % 2
          ? 'Cartridge on board. Follow the cyan route to the safehouse.'
          : 'Handoff confirmed. Dispatch sent your next pickup.';
      if (race.gate === race.stops.length) race.phase = race.time <= onTime ? 'complete' : 'partial';
    }
  } else race.service = 0;
  if (race.phase === 'racing' && race.time >= lastCall) race.phase = race.gate >= 2 ? 'partial' : 'failed';
  updateGPS(race);
  if (race.phase !== 'racing' || race.time - race.trace.at(-1).t > 0.1)
    race.trace.push({ t: race.time, x: race.x, y: race.y, angle: race.angle });
  return race.phase;
}

export function recordBest(previous, race) {
  if (race.gate !== 4 || (previous?.seed === race.seed && previous.time <= race.time)) return previous;
  return { seed: race.seed, time: race.time, trace: race.trace };
}
export function ghostAt(recording, time) {
  if (!recording || time < 0 || time > recording.time) return null;
  let low = 0,
    high = recording.trace.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (recording.trace[mid].t <= time) low = mid;
    else high = mid;
  }
  const a = recording.trace[low],
    b = recording.trace[high],
    t = b.t === a.t ? 0 : (time - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: a.angle + wrap(b.angle - a.angle) * t };
}
export function steerTo(race, point) {
  const distance = dist(race, point),
    offset = wrap(Math.atan2(point.y - race.y, point.x - race.x) - race.angle);
  if (distance < 5) return { brake: true };
  const desired = Math.min(150, Math.sqrt(240 * Math.max(0, distance - 3))) / (1 + Math.abs(offset));
  return {
    gas: race.speed <= desired && Math.abs(offset) < 1,
    brake: race.speed > desired + 2,
    turn: clamp(offset * 4, -1, 1),
  };
}

function line(ctx, pts, color, width = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function circle(ctx, x, y, radius, color, outline = false) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}
function label(ctx, text, x, y, color, size = 10, align = 'left') {
  ctx.font = 'bold ' + size + 'px ui-monospace, monospace';
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function roofFixture(ctx, x, y, width, height, district, kind) {
  const cx = x + width * 0.61,
    cy = y + height * 0.32;
  if (kind === 0) {
    // Round tank with a catwalk and an offset shadow.
    circle(ctx, cx + 2, cy + 3, 8.3, '#202b35');
    circle(ctx, cx, cy, 8, '#67787e');
    circle(ctx, cx, cy, 6.3, '#394b56');
    circle(ctx, cx, cy, 3.5, '#4a6068');
    line(
      ctx,
      [
        [cx - 6, cy + 4],
        [cx + 5, cy - 4],
      ],
      '#a3a79a',
      1.5,
    );
  } else if (kind === 1) {
    for (let j = 0; j < 3; j++) {
      const px = x + 7 + j * width * 0.22;
      ctx.fillStyle = '#182c40';
      ctx.fillRect(px, y + 7, width * 0.2, height * 0.31);
      ctx.fillStyle = '#466777';
      ctx.fillRect(px + 1, y + 8, width * 0.16, 2);
      line(
        ctx,
        [
          [px + 2, y + height * 0.24],
          [px + width * 0.15, y + height * 0.24],
        ],
        '#62818a',
      );
    }
  } else if (kind === 2) {
    const brands = ['FERRY', 'GLASS', 'NOODLES', 'RADIO'];
    const w = Math.min(width - 5, 34);
    ctx.fillStyle = '#172731';
    ctx.fillRect(x + 3, cy - 6, w, 11);
    line(
      ctx,
      [
        [x + 4, cy + 4],
        [x + w + 2, cy + 4],
      ],
      colours[district],
      1,
    );
    label(ctx, brands[district], x + 3 + w * 0.5, cy + 1, colours[district], 6, 'center');
  } else {
    for (let i = 0; i < 2; i++) {
      const px = x + 10 + i * 12;
      if (px + 4 > x + width) break;
      circle(ctx, px, cy, 5, '#1c2b37');
      circle(ctx, px, cy, 3.5, '#526570');
      line(
        ctx,
        [
          [px - 2, cy + 2],
          [px + 2, cy - 2],
        ],
        '#8ea2a0',
        1,
      );
    }
  }
}

function scenery(city, seed) {
  const back = document.createElement('canvas');
  back.width = city.w;
  back.height = city.h;
  const ctx = back.getContext('2d'),
    rand = randomSource(seed ^ 2204);
  ctx.fillStyle = '#17282d';
  ctx.fillRect(0, 0, city.w, city.h);
  for (let row = 0; row < rows - 1; row++)
    for (let col = 0; col < cols - 1; col++) {
      const x = city.xs[col] + 30,
        y = city.ys[row] + 30;
      const w = city.xs[col + 1] - x - 29,
        h = city.ys[row + 1] - y - 28;
      const district = city.nodes[row * cols + col].district,
        accent = colours[district];
      if (rand() < 0.16) {
        ctx.fillStyle = '#213d39';
        ctx.fillRect(x, y, w, h);
        line(
          ctx,
          [
            [x, y + h],
            [x + w * 0.5, y + h * 0.52],
            [x + w, y + 5],
          ],
          '#5c6050',
          5,
        );
        for (let i = 0; i < 8; i++) {
          const tx = x + rand() * w,
            ty = y + rand() * h;
          circle(ctx, tx + 2, ty + 3, 7, '#142d2c');
          circle(ctx, tx, ty, 6, '#31594d');
          circle(ctx, tx - 2, ty - 1, 3, '#456657');
        }
      } else {
        const split = Math.floor(w * (0.35 + 0.26 * rand()));
        for (const [sx, sw] of [
          [x, split - 2],
          [x + split + 3, w - split - 3],
        ]) {
          const sy = y + rand() * 8,
            sh = h - rand() * 12;
          ctx.fillStyle = '#101c28';
          ctx.fillRect(sx + 3, sy + 5, sw, sh);
          ctx.fillStyle = ['#35444b', '#374354', '#4b4147', '#32414d'][district];
          ctx.fillRect(sx, sy, sw, sh);
          ctx.fillStyle = '#5c636b';
          ctx.fillRect(sx, sy, sw, 2);
          ctx.fillStyle = '#24343d';
          ctx.fillRect(sx + 6, sy + 8, sw * 0.45, sh * 0.42);
          for (let i = 5; i < sw - 3; i += 8) {
            ctx.fillStyle = rand() > 0.25 ? accent : '#435058';
            ctx.fillRect(sx + i, sy + sh - 2, 4, 2);
          }
          roofFixture(ctx, sx, sy, sw, sh, district, Math.floor(rand() * 4));
          const vents = Math.floor(sw / 18);
          for (let i = 0; i < vents; i++) {
            const vx = sx + 4 + i * 12;
            ctx.fillStyle = '#28323b';
            ctx.fillRect(vx, sy + sh * 0.62, 8, 7);
            line(
              ctx,
              [
                [vx + 2, sy + sh * 0.62 + 2],
                [vx + 6, sy + sh * 0.62 + 2],
              ],
              '#647079',
              1,
            );
          }
        }
      }
    }
  ctx.lineCap = 'round';
  for (const [color, width] of [
    ['#0f2027', 52],
    ['#67747a', 48],
    ['#2e3944', 44],
  ]) {
    for (const e of city.edges) {
      const a = city.nodes[e.a],
        b = city.nodes[e.b];
      line(
        ctx,
        [
          [a.x, a.y],
          [b.x, b.y],
        ],
        color,
        width,
      );
    }
  }
  ctx.lineCap = 'butt';
  for (const e of city.edges) {
    const a = city.nodes[e.a],
      b = city.nodes[e.b],
      dx = (b.x - a.x) / e.length,
      dy = (b.y - a.y) / e.length;
    ctx.setLineDash([8, 10]);
    line(
      ctx,
      [
        [a.x + dx * 25, a.y + dy * 25],
        [b.x - dx * 25, b.y - dy * 25],
      ],
      '#8e8a75',
      1.3,
    );
    ctx.setLineDash([]);
    if (e.id % 4 !== 0) continue;
    for (let j = -16; j < 17; j += 6)
      line(
        ctx,
        [
          [a.x + dx * 27 + dy * j, a.y + dy * 27 + dx * j],
          [a.x + dx * 32 + dy * j, a.y + dy * 32 + dx * j],
        ],
        '#8f9a98',
        2.8,
      );
  }
  for (const node of city.nodes.filter(n => n.id % 5 === 1)) {
    ctx.fillStyle = '#182633';
    ctx.fillRect(node.x + 23, node.y - 34, 53, 11);
    label(ctx, districts[node.district].toUpperCase(), node.x + 25, node.y - 26, colours[node.district], 7);
  }
  return back;
}
function vehicle(ctx, car, color, time, player = false) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#fff6bb12';
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(38, -11);
  ctx.lineTo(38, 11);
  ctx.lineTo(8, 5);
  ctx.fill();
  ctx.fillStyle = '#13202a';
  ctx.fillRect(-10, -6, 21, 13);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-10, -5.5, 20, 11, 3);
  ctx.fill();
  ctx.fillStyle = '#213242';
  ctx.fillRect(-4, -4, 10, 8);
  ctx.fillStyle = '#9cc9c7';
  ctx.fillRect(2, -3.5, 3, 7);
  ctx.fillStyle = color;
  ctx.fillRect(-3, -3.5, 5, 7);
  if (player) {
    ctx.fillStyle = '#ffe3a6';
    ctx.fillRect(-8, -1, 4, 2);
    ctx.fillRect(6, -1, 3, 2);
  }
  ctx.fillStyle = '#fdcd87';
  ctx.fillRect(8, -4.5, 2, 2.5);
  ctx.fillRect(8, 2, 2, 2.5);
  ctx.fillStyle = '#ff826d';
  ctx.fillRect(-10, -4, 1.6, 2);
  ctx.fillRect(-10, 2, 1.6, 2);
  if (player && car.speed > 80) {
    const tail = 4 + 3 * Math.sin(time * 19);
    line(
      ctx,
      [
        [-11, -3],
        [-11 - tail, -3],
      ],
      '#bedada88',
      1,
    );
  }
  ctx.restore();
}
function camera(race) {
  return {
    x: clamp(race.x - view.w * 0.5, 0, race.city.w - view.w),
    y: clamp(race.y - view.h * 0.52, 0, race.city.h - view.h),
  };
}
function drawMap(ctx, race, target) {
  const { city } = race,
    scale = Math.min(121 / city.w, 79 / city.h),
    x = view.w - 137,
    y = 12;
  ctx.fillStyle = '#0b1825e8';
  ctx.fillRect(x - 5, y - 6, 135, city.h * scale + 19);
  label(ctx, 'DISPATCH GPS', x, y + 3, '#bbd6d6', 7);
  const mx = n => [x + n.x * scale, y + 7 + n.y * scale];
  for (const edge of city.edges)
    line(
      ctx,
      [mx(city.nodes[edge.a]), mx(city.nodes[edge.b])],
      edge.id === race.closed ? '#f88766' : '#415361',
      edge.id === race.closed ? 3 : 1,
    );
  const routeColor = race.gate % 2 ? '#7be7d6' : '#ffd286';
  if (race.nav.length > 1)
    line(
      ctx,
      race.nav.map(id => mx(city.nodes[id])),
      routeColor,
      2,
    );
  if (target) circle(ctx, ...mx(target), 3.2, routeColor, true);
  circle(ctx, ...mx(race), 2.3, '#fff6e3');
}
function render(ctx, back, race, ghost, aim) {
  const cam = camera(race),
    { city, time } = race,
    target = city.nodes[race.stops[race.gate]];
  const color = race.gate % 2 ? '#7be7d6' : '#ffd286';
  ctx.drawImage(back, cam.x, cam.y, view.w, view.h, 0, 0, view.w, view.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  if (race.nav.length > 1) {
    ctx.setLineDash([3, 12]);
    ctx.lineDashOffset = -time * 14;
    line(
      ctx,
      race.nav.map(i => [city.nodes[i].x, city.nodes[i].y]),
      color + 'a6',
      2,
    );
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  for (const n of city.nodes) {
    if (!hasSignal(n)) continue;
    const x = n.x + 20,
      y = n.y - 21;
    ctx.fillStyle = '#15232a';
    ctx.fillRect(x - 4, y - 2, 9, 4);
    circle(ctx, x - 2, y, 1.6, eastWestGreen(n, time) ? '#99e1aa' : '#f68269');
    circle(ctx, x + 2, y, 1.6, eastWestGreen(n, time) ? '#f68269' : '#99e1aa');
  }
  for (const o of city.obstacles) {
    if (o.kind === 'van') {
      vehicle(ctx, o, '#e7b674', time);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.angle);
      ctx.fillStyle = '#f0cc80';
      ctx.fillRect(-7, -4, 10, 8);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.angle);
      for (const offset of [-5, 1, 6]) {
        circle(ctx, offset, 1, 3, '#232d33');
        circle(ctx, offset, 0, 2.4, '#ea8c58');
        circle(ctx, offset, -0.5, 1, '#ffe6b7');
      }
      ctx.restore();
    }
  }
  if (race.closed >= 0) {
    const e = city.edges[race.closed],
      a = city.nodes[e.a],
      b = city.nodes[e.b];
    ctx.save();
    ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
    if (!e.horizontal) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#393642';
    ctx.fillRect(-3, -23, 6, 46);
    for (let i = -22; i <= 20; i += 8)
      line(
        ctx,
        [
          [-3, i + 3],
          [3, i - 1],
        ],
        '#f9a15f',
        4,
      );
    circle(ctx, 0, -22, 3, Math.sin(time * 8) > 0 ? '#ffd775' : '#b66e54');
    ctx.restore();
  }
  if (target) {
    const pulse = (time * 0.75) % 1;
    circle(ctx, target.x, target.y, 17 + pulse * 8, color, true);
    const bob = Math.sin(time * 3.6) * 2;
    const px = target.x + 15,
      py = target.y - 13;
    ctx.fillStyle = '#141c2b';
    ctx.fillRect(px - 3, py + 3, 7, 8);
    circle(ctx, px, py + bob, 3.7, '#f0be9c');
    ctx.fillStyle = color;
    ctx.fillRect(px - 3, py + 3 + bob, 6, 6);
    line(
      ctx,
      [
        [px - 3, py + 5 + bob],
        [px - 6, py + 2 + bob],
      ],
      color,
      2,
    );
    const title = race.gate % 2 ? 'DROP' : 'PICKUP';
    ctx.fillStyle = '#192333';
    ctx.fillRect(target.x - 24, target.y - 33, 48, 11);
    label(ctx, title, target.x, target.y - 25, color, 9, 'center');
  }
  for (const car of race.traffic) vehicle(ctx, car, car.color, time);
  if (ghost) {
    ctx.globalAlpha = 0.4;
    vehicle(ctx, ghost, '#a8f3e2', time);
    ctx.globalAlpha = 1;
  }
  if (aim) circle(ctx, aim.x, aim.y, 4, '#ffe0af', true);
  vehicle(ctx, race, '#f38763', time, true);
  if (race.scrape > 0.8) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + time * 4,
        r = 11 + (1.05 - race.scrape) * 35;
      circle(ctx, race.x + Math.cos(a) * r, race.y + Math.sin(a) * r, 1.6, '#ffd485');
    }
  }
  ctx.restore();
  ctx.fillStyle = '#10212be8';
  ctx.fillRect(10, 8, 151, 29);
  label(ctx, districts[city.nodes[race.nearest].district].toUpperCase(), 18, 21, '#cde5dc', 11);
  label(ctx, 'COURIER  07  /  NIGHT DESK', 18, 31, '#829da8', 7);
  drawMap(ctx, race, target);
}

let lastDistrict = null;
export default function mount(api) {
  let race = createRace(),
    back = scenery(race.city, race.seed),
    best = null,
    aim = null;
  const { canvas, ctx } = api.canvas(view.w * 2, view.h * 2);
  ctx.scale(2, 2);
  canvas.style.touchAction = 'none';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Overhead courier city. Follow the marked streets and GPS inset to the flashing pickup or drop. Slow down and hold E to hand off.',
  );
  const keys = new Set(),
    contacts = new Map(),
    pulses = new Map();
  const bindings = {
    ArrowUp: 'gas',
    KeyW: 'gas',
    ArrowDown: 'brake',
    KeyS: 'brake',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    KeyE: 'service',
  };
  const held = kind =>
    [...keys].some(key => bindings[key] === kind) ||
    [...contacts.values()].includes(kind) ||
    pulses.get(kind) > race.time;
  function startRun() {
    if (race.phase !== 'ready') return;
    dispatch(race);
    lastDistrict = { seed: race.seed, best };
    api.sfx?.('ignition');
    api.stage.focus({ preventScroll: true });
    start.disabled = true;
    if (repeat) repeat.disabled = true;
  }
  const start = api.action('Dispatch courier', startRun, { primary: true });
  const repeat =
    lastDistrict &&
    api.action('Repeat last district', () => {
      if (race.phase !== 'ready') return;
      race = createRace(lastDistrict.seed);
      best = lastDistrict.best;
      back = scenery(race.city, race.seed);
      startRun();
    });
  function addControl(label, kind) {
    const button = api.action(label, e => {
      if (e.detail && e.pointerType) return;
      startRun();
      aim = null;
      pulses.set(kind, race.time + (kind === 'service' ? 0.45 : 0.18));
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      startRun();
      aim = null;
      button.setPointerCapture(e.pointerId);
      contacts.set(e.pointerId, kind);
      pulses.set(kind, race.time + (kind === 'service' ? 0.45 : 0.12));
    });
    for (const action of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(action, e => contacts.delete(e.pointerId));
  }
  addControl('Steer left', 'left');
  addControl('Steer right', 'right');
  addControl('Accelerate', 'gas');
  addControl('Brake', 'brake');
  addControl('Handoff · E', 'service');
  const pointAt = e => {
    const bounds = canvas.getBoundingClientRect(),
      cam = camera(race);
    aim = {
      x: cam.x + ((e.clientX - bounds.left) * view.w) / bounds.width,
      y: cam.y + ((e.clientY - bounds.top) * view.h) / bounds.height,
    };
  };
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 0) {
      startRun();
      canvas.setPointerCapture(e.pointerId);
      pointAt(e);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (canvas.hasPointerCapture(e.pointerId)) pointAt(e);
  });
  api.onKey(e => {
    if (bindings[e.code]) {
      e.preventDefault();
      startRun();
      keys.add(e.code);
      aim = null;
    }
  });
  const release = e => keys.delete(e.code),
    clear = () => {
      keys.clear();
      contacts.clear();
      pulses.clear();
      aim = null;
    };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
    clear();
  });
  let status = '';
  function draw() {
    const stop = race.city.nodes[race.stops[race.gate]],
      close = stop && dist(stop, race) < 28;
    const prompt = close
      ? 'Brake and hold E for handoff.'
      : race.message || 'Follow the GPS. Arrows or WASD to drive. Tap the road to steer, then use Handoff at a stop.';
    if (status !== prompt) {
      api.setStatus(prompt);
      status = prompt;
    }
    const clock =
      race.time <= onTime
        ? Math.ceil(onTime - race.time) + 's to deadline'
        : Math.ceil(Math.max(0, lastCall - race.time)) + 's to last call';
    api.setHud(
      Math.floor(race.gate / 2) +
        '/2 drops · ' +
        (stop ? (race.gate % 2 ? 'Drop at ' : 'Pickup at ') + stop.name : 'Delivered') +
        ' · ' +
        clock +
        (best ? ' · Ghost ' + best.time.toFixed(1) + 's' : ''),
    );
    render(ctx, back, race, ghostAt(best, race.time), aim);
  }
  draw();
  api.frame(dt => {
    const inputs = aim
      ? steerTo(race, aim)
      : { gas: held('gas'), brake: held('brake'), turn: Number(held('right')) - Number(held('left')) };
    inputs.service = held('service');
    if (inputs.service) inputs.brake = true;
    const oldGate = race.gate,
      hits = race.collisions;
    stepRace(race, inputs, dt);
    if (race.gate > oldGate) api.sfx?.(race.gate % 2 ? 'pickup' : 'quay');
    else if (hits !== race.collisions) api.sfx?.('scrape');
    draw();
    if (['complete', 'partial', 'failed'].includes(race.phase)) {
      lastDistrict = { seed: race.seed, best: recordBest(best, race) };
      api.finish(
        race.phase,
        Math.floor(race.gate / 2) +
          '/2 cartridges delivered in ' +
          race.time.toFixed(1) +
          's. ' +
          (race.gate === 4
            ? 'Retry and choose Repeat last district to race your ghost.'
            : 'The contact window closed.'),
      );
    }
  });
}
