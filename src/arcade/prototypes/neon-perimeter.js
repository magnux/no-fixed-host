const WIDTH = 720;
const HEIGHT = 380;
const CORE_HP = 7;
const TOWER_COST = 2;
const buildTime = [22, 14, 12, 10];
const gateNames = ['W', 'N', 'E', 'S'];
const padNames = ['West approach', 'East approach', 'North switch', 'South switch', 'West junction', 'East junction', 'Inner west', 'Inner east', 'Core relay'];
const towerTypes = {
  pulse: { name: 'Pulse', glyph: 'P', color: '#63fff2', reach: 104, cycle: .53 },
  delay: { name: 'Delay', glyph: 'D', color: '#f4ce64', reach: 109, cycle: .86 },
  arc: { name: 'Arc', glyph: 'A', color: '#ff8bdc', reach: 102, cycle: .90 },
};

function track(points) {
  let length = 0;
  const sections = points.slice(1).map(([x,y], i) => {
    const [fromX, fromY] = points[i];
    const span = Math.hypot(x-fromX, y-fromY);
    const start = length;
    length += span;
    return { x: fromX, y: fromY, dx: (x-fromX)/span, dy: (y-fromY)/span, start, end: length };
  });
  return { points, length, sections };
}
function board(random) {
  const jitter = spread => Math.round((random() * 2 - 1) * spread);
  const core = [360 + jitter(12), 190 + jitter(8)];
  const bend = (x, y, range = 18) => [x + jitter(range), y + jitter(range)];
  const west = [bend(239, 124), bend(280, 148, 12), bend(312, 148, 10), core];
  const east = [bend(481, 256), bend(440, 232, 12), bend(408, 232, 10), core];
  const tracks = [
    track([[18, 175 + jitter(35)], bend(110, 165), bend(151, 116), ...west]),
    track([[322 + jitter(36), 17], bend(322, 56), bend(272, 85), bend(235, 85, 8), ...west]),
    track([[702, 205 + jitter(35)], bend(609, 215), bend(569, 264), ...east]),
    track([[398 + jitter(36), 363], bend(398, 324), bend(448, 295), bend(485, 295, 8), ...east]),
  ];
  const pads = [bend(183, 153, 8), bend(537, 227, 8), bend(294, 61, 6), bend(426, 319, 6),
    bend(262, 165, 6), bend(458, 215, 6), bend(307, 121, 5), bend(413, 259, 5), [core[0] - 2, core[1] + 48]];
  return { core, pads, tracks };
}

const scout = { hp: 5, speed: 73 };
const hauler = { hp: 15, speed: 54 };

// Each group specifies an approach, launch time, count and separation.
const formations = [
  { name: 'First contact', gates: [[0, 0, 4, .75, scout], [1, 2, 2, .65, scout]] },
  { name: 'Split convoy', gates: [[2, 0, 4, .60, scout], [3, 1, 2, .70, scout], [0, 1, 2, 1.55, hauler]] },
  { name: 'Switchback', gates: [[3, 0, 4, 1.0, hauler], [1, 1, 4, .6, scout], [2, 2.5, 3, .6, scout]] },
  { name: 'Closing circuit', gates: [[0, 0, 5, .65, scout], [3, 0, 4, 1.15, hauler], [1, 3.9, 3, 1.2, hauler], [2, 4.7, 8, .36, scout]] },
];
function roster(wave, offset) {
  const lineup = [];
  for (const [gate, start, count, interval, kind] of formations[wave].gates) {
    const lane = (gate + offset) % 4;
    for (let n=0; n<count; n++) lineup.push({ lane, at: start+n*interval, kind });
  }
  return lineup.sort((a,b) => a.at-b.at);
}

export function newPerimeter(random = Math.random) {
  const { core, pads, tracks } = board(random);
  const offset = Math.floor(random() * 4);
  return { core, pads, tracks, offset, phase:'build', wave:0, hp:CORE_HP, charge:6, towers:Array(pads.length).fill(null),
    plan:roster(0, offset), active:[], sparks:[], bursts:[], elapsed:0, clock:0, countdown:buildTime[0], sent:0, blocked:0, leaked:0,
    shifted:false, surge:true, outcome:null };
}

export function installTower(state, pad, type) {
  if (state.phase !== 'build' || !Number.isInteger(pad) || !state.pads[pad] ||
      state.towers[pad] || !Object.hasOwn(towerTypes, type) || state.charge < TOWER_COST) return false;
  state.towers[pad] = { type, builtWave:state.wave, cooldown:0, overdrive:0, heading:-Math.PI/2 };
  state.charge -= TOWER_COST;
  return true;
}
export function refundTower(state, pad) {
  if (state.phase !== 'build' || state.towers[pad]?.builtWave !== state.wave) return false;
  state.towers[pad] = null;
  state.charge += TOWER_COST;
  return true;
}
export function relocateTower(state, from, to) {
  const tower = state.towers[from];
  if (state.phase !== 'build' || !tower || tower.builtWave === state.wave ||
      !Number.isInteger(to) || !state.pads[to] || state.towers[to] || state.shifted) return false;
  state.towers[to] = tower;
  state.towers[from] = null;
  state.shifted = true;
  return true;
}
export function sendWave(state) {
  if (state.phase !== 'build') return false;
  state.phase = 'wave';
  state.elapsed = 0;
  state.sent = 0;
  state.surge = true;
  return true;
}
export function overdrive(state, pad) {
  if (state.phase !== 'wave' || !state.surge || !state.towers[pad]) return false;
  state.towers[pad].overdrive = 2.5;
  state.towers[pad].cooldown = 0;
  state.surge = false;
  return true;
}

function place(enemy, route) {
  const segment = route.sections.find(s => enemy.dist < s.end) || route.sections.at(-1);
  const offset = Math.min(enemy.dist, route.length) - segment.start;
  enemy.heading = Math.atan2(segment.dy, segment.dx);
  enemy.x = segment.x + offset * segment.dx;
  enemy.y = segment.y + offset * segment.dy;
}
function zap(state, x, y, enemy, type) {
  state.sparks.push({ x, y, toX:enemy.x, toY:enemy.y, color:type.color, life:.17 });
}

function fire(state, tower, pad) {
  const [x,y] = pad;
  const type = towerTypes[tower.type];
  const inRange = state.active.filter(e => e.hp > 0 && Math.hypot(e.x-x, e.y-y) <= type.reach);
  if (!inRange.length) return false;
  inRange.sort((a,b) => (state.tracks[a.lane].length - a.dist) - (state.tracks[b.lane].length - b.dist));
  const first = inRange[0];
  tower.heading = Math.atan2(first.y - y, first.x - x);
  zap(state, x, y, first, type);
  if (tower.type === 'delay') {
    // A brake pulse catches a pack, stretching its time under neighboring towers.
    for (const enemy of inRange) enemy.slow = 1.35;
  } else if (tower.type === 'arc') {
    first.hp -= 2;
    const struck = new Set([first]);
    let previous = first;
    for (let jumps=0; jumps<2; jumps++) {
      let next;
      let closest = 48;
      for (const candidate of state.active) {
        if (candidate.hp <= 0 || struck.has(candidate)) continue;
        const distance = Math.hypot(candidate.x-previous.x, candidate.y-previous.y);
        if (distance <= closest) { closest=distance; next=candidate; }
      }
      if (!next) break;
      zap(state, previous.x, previous.y, next, type);
      next.hp -= 2;
      struck.add(next);
      previous = next;
    }
  } else first.hp -= 3;
  return true;
}

export function stepPerimeter(state, dt) {
  if (state.phase === 'ended') return;
  state.clock += dt;
  state.bursts = state.bursts.filter(b => (b.life -= dt) > 0);
  if (state.phase === 'build') {
    const spent = Math.min(dt, state.countdown);
    state.countdown = Math.max(0, state.countdown - spent);
    if (state.countdown > 0) return;
    sendWave(state);
    dt -= spent;
  }
  state.elapsed += dt;
  state.sparks = state.sparks.filter(s => (s.life -= dt) > 0);
  while (state.sent < state.plan.length && state.plan[state.sent].at <= state.elapsed) {
    const { lane, kind } = state.plan[state.sent++];
    state.active.push({ lane, speed:kind.speed, maxHp:kind.hp, hp:kind.hp, dist:0, slow:0, x:0, y:0 });
  }
  for (const enemy of state.active) {
    enemy.dist += dt*enemy.speed*(enemy.slow > 0 ? .48 : 1);
    enemy.slow = Math.max(0, enemy.slow-dt);
    place(enemy, state.tracks[enemy.lane]);
  }
  for (const [index,tower] of state.towers.entries()) {
    if (!tower) continue;
    const boost = tower.overdrive > 0 ? 2.4 : 1;
    tower.overdrive = Math.max(0, tower.overdrive-dt);
    tower.cooldown = Math.max(0, tower.cooldown-dt*boost);
    if (!tower.cooldown && fire(state, tower, state.pads[index])) tower.cooldown = towerTypes[tower.type].cycle;
  }
  state.active = state.active.filter(enemy => {
    if (enemy.hp <= 0) {
      state.bursts.push({ x: enemy.x, y: enemy.y, life: .31 });
      state.blocked++; return false;
    }
    if (enemy.dist >= state.tracks[enemy.lane].length) { state.hp--; state.leaked++; return false; }
    return true;
  });
  state.hp = Math.max(0, state.hp);
  if (!state.hp || (state.sent === state.plan.length && !state.active.length && state.wave === 3)) {
    state.outcome = !state.hp ? 'failed' : state.hp >= 4 ? 'complete' : 'partial';
    state.phase = 'ended';
  } else if (state.sent === state.plan.length && !state.active.length) {
    state.wave++;
    state.plan = roster(state.wave, state.offset);
    state.countdown = buildTime[state.wave];
    state.phase = 'build';
    state.shifted = false;
    state.sparks = [];
    for (const tower of state.towers.filter(Boolean)) { tower.overdrive=0; tower.cooldown=0; }
    state.charge += TOWER_COST;
  }
}

function line(ctx, points, color, size) {
  ctx.beginPath();
  points.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}
function polygon(ctx, x, y, radius, sides, angle, fill, stroke) {
  ctx.beginPath();
  for (let i=0; i<sides; i++) {
    const a=angle+i*Math.PI*2/sides;
    const px=x+radius*Math.cos(a), py=y+radius*Math.sin(a);
    if (!i) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  ctx.lineWidth=2; ctx.strokeStyle=stroke; ctx.stroke();
}
function paint(ctx, state, selected) {
  ctx.fillStyle='#070c20'; ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.lineJoin='round'; ctx.lineCap='round';
  for (let x=7;x<WIDTH;x+=17) for (let y=7;y<HEIGHT;y+=17) {
    ctx.fillStyle='#253452'; ctx.fillRect(x,y,1.5,1.5);
  }
  const { pads, tracks, core } = state;
  const inletColors = ['#46cfed', '#7fe0a5', '#c396f0', '#e4a369'];
  for (const [i,route] of tracks.entries()) {
    const color = inletColors[i];
    const active = state.plan.some(unit => unit.lane === i);
    line(ctx, route.points, '#213754', 12);
    line(ctx, route.points, '#101b34', 8);
    line(ctx, route.points, active ? color : '#456173', 1.6);
    const [gx, gy] = route.points[0];
    const halo = 12 + 3 * Math.sin(state.clock * (active ? 4 : 1.5) + i);
    polygon(ctx, gx, gy, halo, 6, Math.PI / 6, '#142238', active ? color : '#456173');
    ctx.textAlign='center'; ctx.fillStyle=color; ctx.font='bold 13px monospace';
    ctx.fillText(gateNames[i], gx, gy + 4);
    if (active) {
      for (const segment of route.sections.slice(0, 3)) {
        const t = (state.clock * 35) % 45;
        for (let at = t; at < segment.end - segment.start; at += 45) {
          ctx.fillStyle = color; ctx.fillRect(segment.x + segment.dx * at - 1, segment.y + segment.dy * at - 1, 3, 3);
        }
      }
    }
  }
  const [sx,sy]=pads[selected];
  const radius=state.towers[selected] ? towerTypes[state.towers[selected].type].reach : towerTypes.pulse.reach;
  ctx.beginPath(); ctx.arc(sx,sy,radius,0,Math.PI*2);
  ctx.fillStyle='#52ebdd0b'; ctx.fill();
  ctx.strokeStyle='#599a9f'; ctx.lineWidth=1; ctx.setLineDash([3,7]); ctx.stroke(); ctx.setLineDash([]);

  ctx.textAlign='center';
  for (const [i,[x,y]] of pads.entries()) {
    const tower=state.towers[i], type=tower && towerTypes[tower.type];
    const color=type?.color || '#839cb6';
    if (i===selected) {
      polygon(ctx,x,y,23,8,Math.PI/8,'#154047','#a1ffe4');
    }
    polygon(ctx,x,y,17,8,Math.PI/8,tower ? '#152239' : '#121c31',color);
    ctx.font='bold 17px monospace'; ctx.fillStyle=color;
    ctx.fillText(type?.glyph ?? String(i+1),x,y+6);
    if (tower) {
      ctx.fillStyle='#e9f8ff'; ctx.font='bold 11px monospace'; ctx.fillText(String(i+1),x+15,y-15);
      const angle = tower.heading;
      if (tower.type === 'pulse') {
        line(ctx, [[x+9*Math.cos(angle),y+9*Math.sin(angle)],[x+20*Math.cos(angle),y+20*Math.sin(angle)]], color, 4);
      } else {
        for (let arm=0; arm<(tower.type === 'arc' ? 3 : 2); arm++) {
          const a = state.clock + arm * Math.PI * 2 / (tower.type === 'arc' ? 3 : 2);
          polygon(ctx,x+14*Math.cos(a),y+14*Math.sin(a),2.6,4,a,color,color);
        }
      }
      if (tower.overdrive>0) {
        ctx.beginPath(); ctx.arc(x,y,21,0,Math.PI*2); ctx.strokeStyle='#ffe48d'; ctx.stroke();
      }
    }
  }
  const coreColor=state.hp>=4?'#72f8e0':'#ff877c';
  const [cx, cy] = core;
  [20,14,7].forEach((r,i) => polygon(ctx,cx,cy,r,6,(i%2 ? -1 : 1)*state.clock*.55,i===2?coreColor:'#193342',coreColor));
  ctx.fillStyle='#ccf9f2'; ctx.font='bold 12px monospace'; ctx.fillText('CORE',cx,cy-27);
  if (state.phase === 'build') {
    ctx.beginPath();
    ctx.arc(cx,cy,25,-Math.PI/2,-Math.PI/2 + Math.PI*2*state.countdown/buildTime[state.wave]);
    ctx.strokeStyle = state.countdown > 5 ? '#82cfd1' : '#ffb16e'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (const burst of state.bursts) {
    const r = 3 + 21 * (1 - burst.life/.31);
    ctx.globalAlpha = burst.life/.31;
    for (let i=0; i<6; i++) {
      const a=i*Math.PI/3;
      line(ctx,[[burst.x+r*Math.cos(a),burst.y+r*Math.sin(a)],[burst.x+(r+4)*Math.cos(a),burst.y+(r+4)*Math.sin(a)]],'#ffbd95',2);
    }
    ctx.globalAlpha=1;
  }
  state.sparks.forEach(s => {
    line(ctx,[[s.x,s.y],[s.toX,s.toY]],s.color,2.4);
  });
  for (const e of state.active) {
    const heavy=e.maxHp===hauler.hp, size=heavy?9:6.5;
    const color=heavy?'#ff795e':'#ffb778';
    ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.heading);
    const thruster = 5 + Math.sin(e.dist * .18) * 2;
    line(ctx,[[-size*.6,0],[-size-thruster,0]],'#f07d82',heavy?4:2);
    if (heavy) {
      for (const side of [-1,1]) line(ctx,[[-size,side*7],[3,side*7]],'#feae84',3);
    }
    polygon(ctx,0,0,size,heavy?6:3,0,'#8f3341',color);
    ctx.fillStyle='#fff1af'; ctx.fillRect(2,-1.5,3,3); ctx.restore();
    if (e.slow>0) {
      ctx.beginPath(); ctx.arc(e.x,e.y,size+3,0,Math.PI*2); ctx.strokeStyle='#f6d967'; ctx.lineWidth=1; ctx.stroke();
    }
    if (e.hp<e.maxHp) {
      ctx.fillStyle='#362435'; ctx.fillRect(e.x-8,e.y-size-5,16,2);
      ctx.fillStyle=color; ctx.fillRect(e.x-8,e.y-size-5,16*e.hp/e.maxHp,2);
    }
  }
}

function traffic(state) {
  return gateNames.map((side,i) => {
    const arrivals = state.plan.filter(unit => unit.lane === i);
    const count = arrivals.filter(unit => unit.kind === scout).length;
    const loads = arrivals.length - count;
    if (!arrivals.length) return null;
    return side+' '+[count && count+' scout'+(count===1?'':'s'), loads && loads+' heavy'].filter(Boolean).join(' + ');
  }).filter(Boolean).join('  /  ');
}

export default function mount(api) {
  const state = newPerimeter();
  const { pads } = state;
  const {canvas,ctx} = api.canvas(WIDTH,HEIGHT);
  canvas.setAttribute('role','img');
  let selected = 4;
  let movingFrom = null;
  let speed = 1;
  const padButton = api.action('Next pad', () => {
    const next = Array.from({length:pads.length}, (_,i) => (selected+i+1)%pads.length)
      .find(i => movingFrom===null || !state.towers[i]);
    if (next!==undefined) select(next);
  });
  const buildButtons = Object.entries(towerTypes).map(([type, spec]) =>
    api.action(spec.name+' · 2', () => install(type)));
  const moveButton = api.action('Move tower', adjust);
  const launch = api.action('Send wave', launchWave, {primary:true});
  const surge = api.action('Overdrive', boost);
  const pace = api.action('Speed ×1', () => { speed = speed===1 ? 2 : 1; update(); });
  const brief = 'Tap a socket or select 1–9. Pulse hits one unit, Delay slows a group, and Arc chains three nearby units.';
  function waveName() { return formations[state.wave].name; }
  function advice() {
    if (movingFrom!==null) return 'Moving '+towerTypes[state.towers[movingFrom].type].name+'. Choose an empty socket to confirm or cancel the move.';
    if (state.phase==='build') return 'Incoming · '+traffic(state)+'. '+(state.wave===0 ? brief :
      'Build for 2 charge. You can also move one existing tower before launch.');
    return 'Incoming · '+traffic(state)+'. One overdrive per wave. Pick a tower and boost it when a group enters range.';
  }
  function update() {
    const tower=state.towers[selected], build=state.phase==='build';
    padButton.textContent='Next pad · '+(selected+1);
    const names=state.towers.map((t,i)=>(i+1)+' '+(t?towerTypes[t.type].name:'empty')).join(', ');
    canvas.setAttribute('aria-label','Four entry gates feed a central core. Sockets: '+names+'.');
    buildButtons.forEach(b => { b.hidden=!build; b.disabled=!!tower || state.charge<TOWER_COST || movingFrom!==null; });
    moveButton.hidden=!build;
    const refund=tower?.builtWave===state.wave;
    moveButton.textContent=movingFrom!==null?'Cancel move':refund?'Refund tower':'Move tower';
    moveButton.disabled=movingFrom===null && (!tower || (!refund && (state.shifted || state.towers.every(Boolean))));
    launch.hidden=!build; launch.disabled=movingFrom!==null;
    launch.textContent='Send wave '+(state.wave+1);
    surge.hidden=build; surge.disabled=!tower || !state.surge;
    pace.textContent='Speed ×'+speed;
    api.setHud('Wave '+(state.wave+1)+'/4 · '+waveName()+' · '+(build ? 'Arrivals in '+Math.ceil(state.countdown)+'s' : 'Live')+' · Core '+state.hp+'/'+CORE_HP+' · Charge '+state.charge+
      ' · '+(selected+1)+' '+padNames[selected]+' ('+(tower?towerTypes[tower.type].name:'empty')+')');
    paint(ctx,state,selected);
  }
  function select(index) {
    if (movingFrom!==null) {
      if (!relocateTower(state,movingFrom,index)) {
        api.setStatus('Choose an empty socket to move this tower.'); return;
      }
      movingFrom=null;
      api.sfx?.('move');
    }
    selected=index; update(); api.setStatus(advice());
  }
  function install(type) {
    if (movingFrom!==null || !installTower(state,selected,type)) return;
    api.sfx?.('install');
    update(); api.setStatus(advice());
  }
  function adjust() {
    if (movingFrom!==null) movingFrom=null;
    else if (!refundTower(state,selected)) {
      if (!state.towers[selected] || state.shifted || state.towers.every(Boolean)) return;
      movingFrom=selected;
    }
    update(); api.setStatus(advice());
  }
  function launchWave() {
    if (movingFrom!==null || !sendWave(state)) return;
    api.sfx?.('wave');
    update(); api.setStatus(advice());
  }
  function boost() {
    if (!overdrive(state,selected)) return;
    api.sfx?.('boost');
    update(); api.setStatus('Tower '+(selected+1)+' overdriven for 2.5 seconds.');
  }
  canvas.addEventListener('pointerdown', event => {
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)*WIDTH/rect.width, y=(event.clientY-rect.top)*HEIGHT/rect.height;
    const pad=pads.findIndex(([px,py])=>Math.hypot(px-x,py-y)<28);
    if (pad>=0) select(pad);
  });
  api.onKey(event => {
    if (event.repeat) return;
    const k=event.key.toLowerCase();
    if (/^[1-9]$/.test(k)) select(Number(k)-1);
    else if (['p','d','a'].includes(k)) install({p:'pulse',d:'delay',a:'arc'}[k]);
    else if (k==='r' && state.phase==='build') adjust();
    else if (k==='g') launchWave();
    else if (k==='b') boost();
    else return;
    event.preventDefault();
  });
  update(); api.setStatus(advice());
  api.frame(dt => {
    const phase = state.phase, hp=state.hp, seconds=Math.ceil(state.countdown);
    let remaining = dt * speed;
    while (remaining > 0 && state.phase === phase) {
      const step = Math.min(remaining, 1/60);
      stepPerimeter(state, step); remaining -= step;
    }
    if (state.phase === 'ended') {
      update();
      const detail = state.outcome === 'failed' ? 'The core went dark during wave '+(state.wave+1)+'.' : 'All four waves cleared with '+state.hp+' core integrity.';
      api.finish(state.outcome, detail+' Your towers stopped '+state.blocked+' units.');
    } else if (phase !== state.phase) {
      movingFrom=null;
      const launched = state.phase === 'wave';
      api.sfx?.(launched ? 'wave' : 'clear');
      update(); api.setStatus((launched ? 'Gates open. ' : 'Wave cleared. +2 charge. ')+advice());
    } else if (state.hp !== hp || Math.ceil(state.countdown) !== seconds) update();
    else paint(ctx,state,selected);
  });
}
