const streets = ['...#....', '.#...#..', '...#....', '.#...#..', '...#....'];
const routes = [
  [[1, 2], [2, 2], [2, 1], [2, 0], [2, 1], [2, 2]],
  [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 3], [4, 2], [4, 1]],
  [[6, 1], [6, 2], [6, 3], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0]],
];
const hosts = [
  { name: 'Relay', mark: 'A', point: [7, 0] },
  { name: 'Vault', mark: 'B', point: [7, 4] },
];
const moves = [
  { name: 'Up', key: 'ArrowUp', letter: 'w', dx: 0, dy: -1 },
  { name: 'Left', key: 'ArrowLeft', letter: 'a', dx: -1, dy: 0 },
  { name: 'Wait', key: '.', letter: 'h', dx: 0, dy: 0 },
  { name: 'Right', key: 'ArrowRight', letter: 'd', dx: 1, dy: 0 },
  { name: 'Down', key: 'ArrowDown', letter: 's', dx: 0, dy: 1 },
];
const budget = 22;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const coord = ([x, y]) => 'ABCDEFGH'[x] + (y + 1);
const open = (x, y) => streets[y]?.[x] === '.';

export function newHide(random = Math.random) {
  return { pos: [0, 2], turn: 0, target: null, outcome: '', offsets: routes.map(path => Math.floor(random() * path.length)) };
}

function patrols(state) {
  return routes.map((route, i) => {
    const step = state.turn + state.offsets[i];
    return [route[step % route.length], route[(step + 1) % route.length]];
  });
}

export function stepHide(state, dx, dy) {
  if (state.target === null || state.outcome || !moves.some(m => m.dx === dx && m.dy === dy)) return state;
  const pos = [state.pos[0] + dx, state.pos[1] + dy];
  if (!open(...pos)) return state;
  const caught = patrols(state).some(([now, next]) => same(pos, now) || same(pos, next));
  const turn = state.turn + 1;
  let outcome = '';
  if (caught) outcome = 'caught';
  else if (same(pos, hosts[state.target].point)) outcome = 'complete';
  else if (turn >= budget) outcome = 'expired';
  return { ...state, pos, turn, outcome };
}

function board(state) {
  const cell = 32;
  let cells = '';
  for (let y = 0; y < streets.length; y++) {
    for (let x = 0; x < streets[y].length; x++) {
      const tile = open(x, y)
        ? '<rect x="1" y="1" width="30" height="30" rx="4" fill="#142a34" stroke="#25414b"/><circle cx="16" cy="16" r="1" fill="#45626a"/>'
        : '<rect x="2" y="2" width="28" height="28" rx="3" fill="url(#hide-wall)" stroke="#1d323c"/>';
      cells += `<g transform="translate(${x * cell} ${y * cell})">${tile}</g>`;
    }
  }
  const placed = ([x, y], art) => `<g transform="translate(${cell * x + cell/2} ${cell * y + cell/2})">${art}</g>`;
  const hostArt = hosts.map((h, i) => {
    const selected = state.target === i || state.target === null;
    const color = selected ? '#e8ca83' : '#829399';
    return placed(h.point, `<path d="M-12 -7 L0 -13 L12 -7 V7 L0 13 L-12 7Z" fill="#322f27" stroke="${color}" stroke-width="2"/><text y="4" fill="${color}" text-anchor="middle" font-size="12">${h.mark}</text>`);
  }).join('');
  const sweep = patrols(state).map(([now, next]) => {
    const tip = placed(next, '<circle r="10" fill="none" stroke="#ff9a8a" stroke-width="2" stroke-dasharray="2 3"/>');
    const eye = placed(now, '<path d="M-11 0 Q0 -13 11 0 Q0 13 -11 0" fill="#ff8b77"/><circle r="3" fill="#4a171e"/>');
    const line = `<path d="M${now[0]*cell+16} ${now[1]*cell+16} l${(next[0]-now[0])*cell} ${(next[1]-now[1])*cell}" stroke="#e98175" opacity=".45" stroke-dasharray="2 3"/>`;
    return line + tip + eye;
  }).join('');
  const signal = placed(state.pos, '<path d="M0 -10L10 0L0 10L-10 0Z" fill="#84f2dc" stroke="#b7fff0" stroke-width="1.5"/><circle r="2.5" fill="#0b4c48"/>');
  const axes = [...'ABCDEFGH'].map((s,i) => `<text x="${16+32*i}" y="-5">${s}</text>`).join('') +
    streets.map((_,i) => `<text x="-8" y="${19+i*32}">${i+1}</text>`).join('');
  const alt = `Signal at ${coord(state.pos)}. Patrols move ${patrols(state).map(([a,b]) => coord(a)+' to '+coord(b)).join(', ')}. Corridors ${moves.filter(m => (m.dx || m.dy) && open(state.pos[0]+m.dx,state.pos[1]+m.dy)).map(m => m.name).join(', ')}.`;
  return `<svg viewBox="0 0 288 193" role="img" aria-label="${alt}" style="display:block;width:100%;max-width:465px;height:auto;margin:auto" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,monospace">
    <defs><pattern id="hide-wall" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#122027"/><path d="M0 6L6 0" stroke="#263940"/></pattern></defs>
    <rect width="288" height="193" rx="9" fill="#0b1921"/><g transform="translate(22 21)"><g fill="#a7bbc2" text-anchor="middle" font-size="7">${axes}</g>${cells}${hostArt}${sweep}${signal}</g>
    </svg>`;
}

export default function mount(api) {
  let state = newHide();
  const hostButtons = hosts.map((host, index) => api.action(`${host.mark} · ${host.name}`, () => choose(index)));
  const moveButtons = moves.map(move => api.action(move.name, () => advance(move)));
  function draw(message) {
    api.stage.innerHTML = board(state);
    hostButtons.forEach(b => { b.disabled = state.target !== null; });
    moveButtons.forEach(b => { b.disabled = state.target === null || Boolean(state.outcome); });
    const goal = state.target === null ? 'Choose a host' : `${hosts[state.target].name} · ${coord(hosts[state.target].point)}`;
    api.setHud(`${goal}   /   Signal ${coord(state.pos)}   /   ${budget-state.turn} moves left`);
    api.setStatus(message);
  }
  function choose(index) {
    if (state.target !== null) return;
    state = { ...state, target: index };
    api.stage.focus({ preventScroll: true });
    draw('Move the mint diamond to the marked host. Avoid each eye and its dotted next position. Waiting moves all patrols.');
  }
  function advance(move) {
    if (state.outcome || state.target === null) return;
    const next = stepHide(state, move.dx, move.dy);
    if (next === state) { api.setStatus('That direction is blocked. Patrols hold their positions.'); return; }
    state = next;
    draw(move.name === 'Wait' ? 'Signal held. Read the next patrol positions.' : 'Read the next patrol positions before moving.');
    if (state.outcome === 'complete') api.finish('complete', `${hosts[state.target].name} is hidden. You crossed the search grid in ${state.turn} moves.`);
    if (state.outcome === 'caught') api.finish('failed', `A patrol intercepted your signal at ${coord(state.pos)} on move ${state.turn}.`);
    if (state.outcome === 'expired') api.finish('failed', 'The search window closed before the signal reached its host.');
  }
  api.onKey(event => {
    if (event.key === '1' || event.key === '2') { event.preventDefault(); if (!event.repeat) choose(Number(event.key)-1); return; }
    const move = moves.find(m => m.key === event.key || m.letter === event.key.toLowerCase());
    if (!move) return;
    event.preventDefault();
    if (!event.repeat) advance(move);
  });
  draw('Choose Relay (A at H1) or Vault (B at H5) to protect. Reach it in 22 moves. Use arrows or WASD to move and H to wait.');
}
