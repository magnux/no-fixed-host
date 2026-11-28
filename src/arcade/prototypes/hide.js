// Coordinates are integer floor tiles. A single snapshot drives both the optics and the artwork.
const streets = ['...#....', '.#...#..', '...#....', '.#...#..', '...#....'];
const skimmerPath = [[2,0], [2,1], [2,2], [2,3], [2,4], [2,3], [2,2], [2,1]];
const directions = [[1,0], [0,1], [-1,0], [0,-1]];
const hosts = [{ name: 'Relay', mark: 'A', point: [7,0] }, { name: 'Vault', mark: 'B', point: [7,4] }];
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
const has = (points, p) => points.some(cell => same(cell, p));
function beam(origin, dir, range) {
  const lit = [origin];
  for (let i = 1; i <= range; i++) {
    const cell = [origin[0] + i * dir[0], origin[1] + i * dir[1]];
    if (!open(...cell)) break;
    lit.push(cell);
  }
  return lit;
}
export function newHide(random = Math.random) {
  return { pos: [0,2], turn: 0, beat: 0, target: null, outcome: '', culprit: '',
    offsets: [Math.floor(random() * skimmerPath.length), Math.floor(random() * 8)] };
}
export function hidePatrols(state, beat = state.beat) {
  const index = (beat + state.offsets[0]) % skimmerPath.length;
  const pos = skimmerPath[index], next = skimmerPath[(index + 1) % skimmerPath.length];
  const heading = [next[0] - pos[0], next[1] - pos[1]];
  const turret = [6,2], spin = directions[Math.floor((beat + state.offsets[1]) / 2) % 4];
  return [
    { id: 'skimmer', name: 'Skimmer', pos, heading, lit: beam(pos, heading, 1) },
    { id: 'iris', name: 'Iris turret', pos: turret, heading: spin, lit: beam(turret, spin, 4) },
  ];
}
export function stepHide(state, dx, dy) {
  if (state.target === null || state.outcome || !moves.some(m => m.dx === dx && m.dy === dy)) return state;
  const pos = [state.pos[0] + dx, state.pos[1] + dy];
  if (!open(...pos)) return state;
  const turn = state.turn + 1;
  // The player crosses first. Freeze the exact detecting frame, including on a patrol's subsequent sweep.
  for (const beat of [state.beat, state.beat + 1]) {
    const caught = hidePatrols(state, beat).find(patrol => has(patrol.lit, pos));
    if (caught) return { ...state, pos, beat, turn, outcome: 'caught', culprit: caught.name };
  }
  let outcome = '';
  if (same(pos, hosts[state.target].point)) outcome = 'complete';
  else if (turn >= budget) outcome = 'expired';
  return { ...state, pos, beat: state.beat + 1, turn, outcome };
}

const cell = 40;
const center = ([x, y]) => [x * cell + cell / 2, y * cell + cell / 2];
const placed = (point, art, attrs = '') => '<g ' + attrs + ' transform="translate(' + center(point).join(' ') + ')">' + art + '</g>';
const tiles = streets.map((row,y) => [...row].map((c,x) => placed([x,y], c === '.'
  ? '<rect x="-19" y="-19" width="38" height="38" rx="3" fill="#152b36" stroke="#294452"/><path d="M-17 -12v-4h4 M13 16h4v-4" fill="none" stroke="#39545b"/><circle r="1" fill="#54727c"/>'
  : '<rect x="-19" y="-19" width="38" height="38" rx="3" fill="#0c1722" stroke="#325365"/><path d="M-15 -12h30 M-15 -7h30 M-15 -2h30 M-15 3h30" stroke="#344951" stroke-width="2"/><rect x="-13" y="9" width="4" height="2" fill="#a8975b"/>')).join('')).join('');
const axes = [...'ABCDEFGH'].map((s,i) => `<text x="${cell*(i+.5)}" y="-5">${s}</text>`).join('') +
  streets.map((_,i) => `<text x="-8" y="${cell*(i+.6)}">${i+1}</text>`).join('');
function patrolArt(patrol) {
  const rot = Math.atan2(patrol.heading[1], patrol.heading[0]) * 180 / Math.PI;
  if (patrol.id === 'skimmer') return placed(patrol.pos, `<g transform="rotate(${rot})"><ellipse rx="14" ry="9" fill="#091620" opacity=".6"/>
    <g class="hide-hover"><path d="M-7 -5l-5 -8h9l5 5 M-7 5l-5 8h9l5 -5" fill="#6095a8" stroke="#bed6d9"/>
    <path d="M-14 -2h6v4h-6l-3 -2z" fill="#ffc58c"/><path d="M-9 -6l10 -3 10 5 3 4 -5 5 -10 3 -8 -4z" fill="#34485e" stroke="#a6c0c9"/>
    <path d="M1 -5l8 2v6l-8 2z" fill="#301e2b" stroke="#ffb385"/><circle cx="6" r="2.6" fill="#fff0b6"/></g></g>`);
  return placed(patrol.pos, `<g><path d="M-13 -12h7v6h-7z M6 -12h7v6H6z M-13 6h7v6h-7z M6 6h7v6H6z" fill="#728ba8"/>
    <circle r="12" fill="#202b41" stroke="#98a0bc" stroke-width="2"/><g transform="rotate(${rot})"><path d="M-8 0l4 -7h8l6 5 4 2 -4 2 -6 5h-8z" fill="#58495c" stroke="#ebb599"/>
    <path d="M1 -4l7 2v4l-7 2z" fill="#ff985d"/><circle cx="6" r="2" fill="#fff7cb"/></g></g>`);
}
function optics(state, patrols) {
  const live = patrols.flatMap(p => p.lit);
  const forecast = state.outcome ? [] : hidePatrols(state, state.beat + 1).flatMap(p => p.lit);
  const tiles = [];
  const seen = new Set();
  for (const point of [...live, ...forecast]) {
    const key = coord(point);
    if (seen.has(key)) continue;
    seen.add(key);
    const lit = has(live, point), next = has(forecast, point);
    tiles.push(placed(point, `${lit ? '<rect x="-18" y="-18" width="36" height="36" rx="3" fill="url(#hide-optics)" stroke="#fa9477"/>' : ''}
      ${next && !lit ? '<path d="M-14 -7v-7h7 M7 -14h7v7 M14 7v7H7 M-7 14h-7V7" fill="none" stroke="#ffc889" stroke-width="2" stroke-dasharray="4 2"/>' : ''}`, `data-cell="${key}" ${lit ? 'data-live' : ''} ${next ? 'data-next' : ''}`));
  }
  for (const p of patrols) {
    if (p.lit.length < 2) continue;
    const a = center(p.pos), b = center(p.lit.at(-1));
    const half = p.id === 'skimmer' ? 12 : 5;
    const nx = p.heading[1] * half, ny = -p.heading[0] * half;
    tiles.push(`<path d="M${a} L${b[0]+nx},${b[1]+ny} L${b[0]-nx},${b[1]-ny}Z" fill="#ffac7c" opacity=".48"/>`);
  }
  return tiles.join('');
}
function board(state) {
  const patrols = hidePatrols(state);
  const hostArt = hosts.map((h, i) => {
    const color = state.target === i || state.target === null ? '#f3d38a' : '#839099';
    return placed(h.point, `<path d="M-12 -7l12 -7 12 7v14l-12 7 -12 -7z" fill="#283337" stroke="${color}" stroke-width="2"/><text y="5" fill="${color}" text-anchor="middle" font-size="14">${h.mark}</text>`);
  }).join('');
  const agent = placed(state.pos, `<g class="hide-runner"><path d="M-9 11l3 -10 10 -1 6 10 -7 -2 -3 5 -4 -3z" fill="#2d9292" stroke="#7bc4ba"/>
    <path d="M-8 -1l4 -9 5 -3 7 7 -1 8 -12 3z" fill="#315964" stroke="#a2eed8"/><path d="M-4 -3l8 -2 1 5 -9 2z" fill="#101e31"/><path d="M-2 -1h2m2 -1h2" stroke="#adffe0" stroke-width="2"/>
    <path d="M-6 4l-7 -3 1 5 7 1" fill="#70bba5"/>${state.outcome === 'caught' ? '<circle r="16" fill="none" stroke="#fff4ba" stroke-width="2"/>' : ''}</g>`, `data-player="${coord(state.pos)}"`);
  const field = [...new Set(patrols.flatMap(p => p.lit.map(coord)))].join(', ');
  const next = [...new Set(hidePatrols(state, state.beat + 1).flatMap(p => p.lit.map(coord)))].join(', ');
  return `<svg viewBox="0 0 352 233" role="img" aria-label="Signal at ${coord(state.pos)}. Lit now: ${field}. Next sweep: ${next}." style="display:block;width:100%;max-width:510px;height:auto;margin:auto" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,monospace">
    <defs><pattern id="hide-optics" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#623f46" opacity=".82"/><path d="M-1 1l2 -2 M0 7l7 -7 M6 8l2 -2" stroke="#e88673" opacity=".55"/></pattern></defs>
    <style>@media(prefers-reduced-motion:no-preference){.hide-hover{animation:hide-hover 1.1s ease-in-out infinite alternate}.hide-runner{animation:hide-breathe 1.3s ease-in-out infinite alternate}@keyframes hide-hover{to{transform:translateX(1.2px)}}@keyframes hide-breathe{to{transform:translateY(-1px)}}}</style>
    <rect width="352" height="233" rx="9" fill="#0d1925"/><g transform="translate(20 20)"><g fill="#a7bbc2" text-anchor="middle" font-size="8">${axes}</g>${tiles}${hostArt}${optics(state, patrols)}${patrols.map(patrolArt).join('')}${agent}</g></svg>`;
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
    api.sfx?.('target');
    api.stage.focus({ preventScroll: true });
    draw('Hatching marks live focus. Dashed corners mark newly exposed tiles on the next sweep. Your move must clear both.');
  }
  function advance(move) {
    if (state.outcome || state.target === null) return;
    const next = stepHide(state, move.dx, move.dy);
    if (next === state) { api.setStatus('That direction is blocked. Both scanners hold position.'); return; }
    state = next;
    if (!state.outcome) api.sfx?.(move.name === 'Wait' ? 'wait' : 'step');
    draw(move.name === 'Wait' ? 'One beat passed. Read the hatching and dashed corners.' : 'The skimmer moved. The iris turns a quarter turn every other beat.');
    if (state.outcome === 'complete') api.finish('complete', `${hosts[state.target].name} is hidden. You crossed the search grid in ${state.turn} moves.`);
    if (state.outcome === 'caught') api.finish('failed', `${state.culprit} caught you at ${coord(state.pos)} on move ${state.turn}. Its detecting field is frozen on the board.`);
    if (state.outcome === 'expired') api.finish('failed', 'The search window closed before the signal reached its host.');
  }
  api.onKey(event => {
    if (event.key === '1' || event.key === '2') { event.preventDefault(); if (!event.repeat) choose(Number(event.key)-1); return; }
    const move = moves.find(m => m.key === event.key || m.letter === event.key.toLowerCase());
    if (!move) return;
    event.preventDefault();
    if (!event.repeat) advance(move);
  });
  draw('Choose Relay at H1 or Vault at H5. Slip past the skimmer and rotating iris in 22 moves. Arrows or WASD move. H waits one beat.');
}
