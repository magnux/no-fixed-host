const charts = [
  ['.#..~...', '..#....#', '..S#..~.', '.#..~#..', '...#...T', '#...~#..'],
  ['..#...#.', '.#S.~..T', '...#.#..', '...~..#.', '.##.....', '....~...'],
  ['...~#...', '.##...#.', '..#.#..T', '..S.~#..', '#..#....', '.....~#.'],
];
const names = { '.': 'open water', '#': 'reef', '~': 'strong current', S: 'shelf', T: 'trench' };
const helm = [
  { name: 'North', key: 'ArrowUp', letter: 'w', dx: 0, dy: -1 },
  { name: 'West', key: 'ArrowLeft', letter: 'a', dx: -1, dy: 0 },
  { name: 'East', key: 'ArrowRight', letter: 'd', dx: 1, dy: 0 },
  { name: 'South', key: 'ArrowDown', letter: 's', dx: 0, dy: 1 },
];
const coord = (x, y) => 'ABCDEFGH'[x] + (y + 1);
const bathymetry = (x,y) => 160 + x*118 + y*23;
const terrainAt = (state, x, y) => charts[state.chart][y]?.[x];
const chartNames = ['Gannet Bank', 'Iris Sound', 'Manta Rift'];
const fullCharge = 15;

function reveal(chart, seen, x, y, radius) {
  const next = new Set(seen);
  charts[chart].forEach((row, j) => [...row].forEach((_, i) => {
    if (Math.abs(i-x)+Math.abs(j-y) <= radius) next.add(coord(i,j));
  }));
  return next;
}

export function newSoundings(chart = Math.floor(Math.random() * charts.length)) {
  return { x: 0, y: 2, charge: fullCharge, chart, seen: reveal(chart, [], 0, 2, 1), track: new Set(['A3']), outcome: '' };
}

export function dive(state, command) {
  if (state.outcome) return state;
  let {x, y, charge, seen, track} = state;
  const here = terrainAt(state,x,y);
  if (command === 'beacon') {
    if (here !== 'S' && here !== 'T') return state;
    return { ...state, outcome: here === 'S' ? 'shelf' : 'trench' };
  }
  if (command === 'ping') {
    if (charge < 2) return state;
    charge -= 2;
    seen = reveal(state.chart, seen, x, y, 3);
  } else {
    const direction = helm.find(m => m.name === command);
    if (!direction) return state;
    x += direction.dx;
    y += direction.dy;
    const tile = terrainAt(state,x,y);
    const cost = tile === '~' ? 2 : 1;
    if (!tile || tile === '#' || charge < cost) return state;
    charge -= cost;
    seen = reveal(state.chart, seen, x, y, 1);
    track = new Set(track).add(coord(x,y));
  }
  const tile = terrainAt(state,x,y);
  const exits = helm.map(m => terrainAt(state,x+m.dx,y+m.dy));
  const stranded = !exits.some(t => t && t !== '#' && charge >= (t === '~' ? 2 : 1));
  const outcome = stranded && tile !== 'S' && tile !== 'T' ? 'empty' : '';
  return { ...state, x, y, charge, seen, track, outcome };
}

function tileArt(tile, x, y, visited) {
  if (tile === '?') return '<rect x="1" y="1" width="28" height="28" fill="url(#sound-fog)" rx="3"/><circle cx="15" cy="15" r="1" fill="#3b5269"/>';
  const blue = ['#154658','#134155','#133b51','#14394b'][(x+Math.floor(y/2))%4];
  const base = `<rect x="1" y="1" width="28" height="28" rx="3" fill="${blue}"/><path d="M1 ${11+y%3}q7 -4 14 0t14 0 M1 ${21-x%3}q8 -4 16 0t12 0" stroke="#6dc7cf" opacity=".14" fill="none"/>`;
  const stamps = {
    '#': '<path d="M3 23L9 13L12 17L17 7L26 23Z" fill="#526a75" stroke="#aac5cc" stroke-width="1.3"/>',
    '~': '<g fill="none" stroke="#8cddde" stroke-width="1.5"><path d="M4 11Q9 6 14 11T25 11 M4 17Q9 12 14 17T25 17"/></g>',
    S: '<path d="M5 20h20l-5-5h-6v-4H8z" fill="#e8b973" stroke="#ffda96"/><text x="18" y="12" font-size="9" fill="#fff3c8">S</text>',
    T: '<path d="M5 9l9 13L25 9M10 9l4 6 5-6" fill="none" stroke="#ceacf9" stroke-width="2"/><text x="18" y="25" font-size="9" fill="#f1ddff">T</text>',
    '.': visited ? '<circle cx="15" cy="15" r="2" fill="#9bded8"/>' : '',
  };
  return base + stamps[tile];
}

function oceanView(state, ping) {
  const water = charts[state.chart];
  let cells = '';
  water.forEach((row, y) => [...row].forEach((tile, x) => {
    const key = coord(x,y);
    cells += `<g transform="translate(${30*x} ${30*y})">${tileArt(state.seen.has(key) ? tile : '?',x,y,state.track.has(key))}</g>`;
  }));
  const {x,y} = state, cx = 30*x+15, cy = 30*y+15;
  const wake = ping ? `<circle cx="${cx}" cy="${cy}" r="83" fill="none" stroke="#87ebe3" stroke-dasharray="3 6" opacity=".5" clip-path="url(#sound-clip)"/>` : '';
  const sonar = `<g transform="translate(${cx} ${cy})"><path d="M-12 -3l-4 -3v12l4-3" fill="#f1bf72"/><path d="M-10 -6h11q9 0 12 6q-3 6-12 6h-11q-3-4 0-12" fill="#ffd37b" stroke="#433e31" stroke-width="1.4"/><path d="M-2 -6v-4h6" fill="none" stroke="#ffd37b" stroke-width="2"/><circle cx="6" cy="-1" r="2" fill="#175464"/></g>`;
  const axes = [...'ABCDEFGH'].map((s,i) => `<text x="${15+30*i}" y="-5">${s}</text>`).join('') +
    water.map((_,i) => `<text x="-9" y="${17+i*30}">${i+1}</text>`).join('');
  const nearby = helm.map(m => m.name+' '+(names[terrainAt(state,x+m.dx,y+m.dy)] || 'chart edge')).join(', ');
  const sites = water.flatMap((row, j) => [...row].flatMap((tile, i) => (tile === 'T' || tile === 'S') && state.seen.has(coord(i,j)) ? [names[tile]+' '+coord(i,j)] : []));
  return `<svg viewBox="0 0 270 208" role="img" aria-label="Sub at ${coord(x,y)}. ${nearby}. Located sites include ${sites.join(', ') || 'no known anchorages'}." style="display:block;width:100%;max-width:415px;height:auto;margin:auto" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,monospace">
    <defs><pattern id="sound-fog" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#111f30"/><path d="M1 6h2" stroke="#203549"/></pattern><clipPath id="sound-clip"><rect width="240" height="180"/></clipPath></defs>
    <rect width="270" height="208" rx="10" fill="#091923"/><g transform="translate(20 18)"><g fill="#b1c9cf" text-anchor="middle" font-size="7">${axes}</g>${cells}${wake}${sonar}</g></svg>`;
}

export default function mount(api) {
  let state = newSoundings();
  for (const m of helm) api.action(m.name, () => act(m.name));
  const ping = api.action('Sonar ping', () => act('ping'));
  const beacon = api.action('Deploy beacon', () => act('beacon'), { primary: true });
  function draw(message, showPing = false) {
    api.stage.innerHTML = oceanView(state, showPing);
    const tile = terrainAt(state,state.x,state.y);
    if (state.charge < 2 && document.activeElement === ping) api.stage.focus({ preventScroll: true });
    ping.disabled = state.charge < 2;
    beacon.disabled = tile !== 'S' && tile !== 'T';
    api.setHud(`${chartNames[state.chart]} · ${coord(state.x,state.y)}   /   ${bathymetry(state.x,state.y)} m   /   Battery ${state.charge} of ${fullCharge}`);
    let briefing = '';
    if (tile === 'S') briefing = ' Shelf reached. Deploy here for quick assembly, or continue east to find the trench.';
    if (tile === 'T') briefing = ' Trench reached. Deploy here for a concealed anchorage.';
    api.setStatus(message + briefing);
  }
  function act(command) {
    if (state.outcome) return;
    const next = dive(state, command);
    if (next === state) {
      if (command === 'beacon') api.setStatus('A beacon needs a shelf (S) or trench (T) anchorage.');
      else if (command === 'ping') api.setStatus('Sonar needs two battery units.');
      else api.setStatus('Passage blocked by reef, chart edge or battery limit. Moving into a current costs two.');
      return;
    }
    state = next;
    draw(command === 'ping' ? 'Sonar charts water within three squares.' : `Hull at ${coord(state.x,state.y)}.`, command === 'ping');
    if (state.outcome === 'shelf') api.finish('complete', `Shelf beacon anchored at ${coord(state.x,state.y)} with ${state.charge} battery. Shallow water enables earlier assembly.`);
    if (state.outcome === 'trench') api.finish('complete', `Trench beacon anchored at ${coord(state.x,state.y)} with ${state.charge} battery. Deep cover conceals the simulated facility.`);
    if (state.outcome === 'empty') api.finish('failed', 'The reserve called the sub home before a beacon could be anchored.');
  }
  api.onKey(event => {
    const key = event.key.toLowerCase();
    const command = key === 'p' ? 'ping' : key === 'b' ? 'beacon' : helm.find(m => m.key === event.key || m.letter === key)?.name;
    if (!command) return;
    event.preventDefault();
    if (!event.repeat) act(command);
  });
  draw('Find the nearby shelf (S) or explore east for the trench (T). Arrows or WASD move for 1 battery. Currents cost 2. P pings for 2. B deploys a beacon.');
}
