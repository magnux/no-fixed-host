const WIDTH = 570;
const HEIGHT = 272;
const CORE_HP = 7;
const TOWER_COST = 2;
const pads = [[110,81], [112,195], [226,47], [227,217], [314,103], [451,137]];
const padNames = ['North gate', 'South gate', 'North bend', 'South bend', 'Junction', 'Core relay'];
const towerTypes = {
  pulse: { name: 'Pulse', glyph: 'P', color: '#63fff2', reach: 78, cycle: .53 },
  delay: { name: 'Delay', glyph: 'D', color: '#f4ce64', reach: 80, cycle: .86 },
  arc: { name: 'Arc', glyph: 'A', color: '#ff8bdc', reach: 75, cycle: .90 },
};

const trunk = [[302,136], [358,136], [399,95], [458,95], [499,136], [547,136]];
function track(entry) {
  const points = [...entry, ...trunk];
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
const tracks = [
  track([[16,45],[107,45],[147,85],[251,85]]),
  track([[16,227],[107,227],[147,187],[251,187]]),
];
const scout = { hp: 5, speed: 81 };
const hauler = { hp: 16, speed: 62 };

// Times make the scouts arrive in tight groups. Haulers give pulse towers
// a durable target while the other lane keeps moving.
const formations = [
  { name: 'First contact', gates: [['north', 0, 5, .65, scout], ['south', 2.0, 1, 1, scout]] },
  { name: 'Split convoy', gates: [['south', 0, 6, .50, scout], ['north', .6, 2, 1.4, hauler]] },
  { name: 'Switchback', gates: [['north', 0, 4, .90, hauler], ['south', 1.0, 7, .46, scout]] },
  { name: 'Closing circuit', gates: [['north', 0, 5, .62, scout], ['south', 0, 4, .85, hauler], ['north', 3.6, 3, .9, hauler], ['south', 4.0, 8, .28, scout]] },
];
function roster(wave, mirror) {
  const lineup = [];
  for (const [side, start, count, interval, kind] of formations[wave].gates) {
    const lane = (side === 'south' ? 1 : 0) ^ Number(mirror);
    for (let n=0; n<count; n++) lineup.push({ lane, at: start+n*interval, kind });
  }
  return lineup.sort((a,b) => a.at-b.at);
}

export function newPerimeter(mirror = Math.random() >= .5) {
  return { mirror, phase:'build', wave:0, hp:CORE_HP, charge:6, towers:Array(pads.length).fill(null),
    plan:roster(0, mirror), active:[], sparks:[], elapsed:0, sent:0, blocked:0, leaked:0,
    shifted:false, surge:true, outcome:null };
}

export function installTower(state, pad, type) {
  if (state.phase !== 'build' || !Number.isInteger(pad) || !pads[pad] ||
      state.towers[pad] || !Object.hasOwn(towerTypes, type) || state.charge < TOWER_COST) return false;
  state.towers[pad] = { type, builtWave:state.wave, cooldown:0, overdrive:0 };
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
      !Number.isInteger(to) || !pads[to] || state.towers[to] || state.shifted) return false;
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

function place(enemy) {
  const route = tracks[enemy.lane];
  const segment = route.sections.find(s => enemy.dist < s.end) || route.sections.at(-1);
  const offset = Math.min(enemy.dist, route.length) - segment.start;
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
  inRange.sort((a,b) => b.dist - a.dist);
  const first = inRange[0];
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
  if (state.phase !== 'wave') return;
  state.elapsed += dt;
  state.sparks = state.sparks.filter(s => (s.life -= dt) > 0);
  while (state.sent < state.plan.length && state.plan[state.sent].at <= state.elapsed) {
    const { lane, kind } = state.plan[state.sent++];
    state.active.push({ lane, speed:kind.speed, maxHp:kind.hp, hp:kind.hp, dist:0, slow:0, x:0, y:0 });
  }
  for (const enemy of state.active) {
    enemy.dist += dt*enemy.speed*(enemy.slow > 0 ? .48 : 1);
    enemy.slow = Math.max(0, enemy.slow-dt);
    place(enemy);
  }
  for (const [index,tower] of state.towers.entries()) {
    if (!tower) continue;
    const boost = tower.overdrive > 0 ? 2.4 : 1;
    tower.overdrive = Math.max(0, tower.overdrive-dt);
    tower.cooldown = Math.max(0, tower.cooldown-dt*boost);
    if (!tower.cooldown && fire(state, tower, pads[index])) tower.cooldown = towerTypes[tower.type].cycle;
  }
  state.active = state.active.filter(enemy => {
    if (enemy.hp <= 0) { state.blocked++; return false; }
    if (enemy.dist >= tracks[enemy.lane].length) { state.hp--; state.leaked++; return false; }
    return true;
  });
  state.hp = Math.max(0, state.hp);
  if (!state.hp || (state.sent === state.plan.length && !state.active.length && state.wave === 3)) {
    state.outcome = !state.hp ? 'failed' : state.hp >= 4 ? 'complete' : 'partial';
    state.phase = 'ended';
  } else if (state.sent === state.plan.length && !state.active.length) {
    state.wave++;
    state.plan = roster(state.wave, state.mirror);
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
  for (let n=0; n<8; n++) {
    const y=6+n*5;
    line(ctx,[[344,y],[372,y],[389,y+17],[495,y+17],[507,y+29],[555,y+29]],'#192b46',1);
    line(ctx,[[33,252+n*2],[128,252+n*2],[139,241+n*2],[211,241+n*2]],'#243451',1);
  }
  const inletColors=['#46cfed','#ac81f4'];
  for (const [i,route] of tracks.entries()) {
    const points=route.points.slice(0,5);
    line(ctx,points,'#213754',13); line(ctx,points,'#101b34',8); line(ctx,points,inletColors[i],1.8);
  }
  line(ctx,trunk,'#294558',14); line(ctx,trunk,'#111d34',8); line(ctx,trunk,'#6dd5dd',2);
  for (const y of [45,227]) for (let i=0;i<2;i++) {
    const x=32+i*12;
    line(ctx,[[x-3,y-4],[x+2,y],[x-3,y+4]],'#c8f1ff',1.6);
  }
  ctx.textAlign='left'; ctx.font='bold 14px monospace'; ctx.fillStyle='#90dcee';
  ctx.fillText('N',14,34); ctx.fillStyle='#d1a9ff'; ctx.fillText('S',14,250);
  const [sx,sy]=pads[selected];
  const radius=state.towers[selected] ? towerTypes[state.towers[selected].type].reach : 76;
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
      if (tower.overdrive>0) {
        ctx.beginPath(); ctx.arc(x,y,21,0,Math.PI*2); ctx.strokeStyle='#ffe48d'; ctx.stroke();
      }
    }
  }
  const coreColor=state.hp>=4?'#72f8e0':'#ff877c';
  [22,15,8].forEach((r,i) => polygon(ctx,539,136,r,6,Math.PI/6,i===2?coreColor:'#193342',coreColor));
  ctx.fillStyle='#ccf9f2'; ctx.font='bold 12px monospace'; ctx.fillText('CORE',538,173);
  state.sparks.forEach(s => {
    line(ctx,[[s.x,s.y],[s.toX,s.toY]],s.color,2.4);
  });
  for (const e of state.active) {
    const heavy=e.maxHp===hauler.hp, size=heavy?9:6.5;
    const color=heavy?'#ff795e':'#ffb778';
    polygon(ctx,e.x,e.y,size,heavy?6:4,0,'#8f3341',color);
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
  return ['N','S'].map((side,i) => {
    const arrivals = state.plan.filter(unit => unit.lane === i);
    const count = arrivals.filter(unit => unit.kind === scout).length;
    const loads = arrivals.length - count;
    return side+' '+[count && count+' scout'+(count===1?'':'s'), loads && loads+' heavy'].filter(Boolean).join(' + ');
  }).join('  /  ');
}

export default function mount(api) {
  const state = newPerimeter();
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
  const brief = 'Tap a socket or select 1–6. Pulse hits one unit, Delay slows a group, and Arc chains three nearby units.';
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
    canvas.setAttribute('aria-label','Two tracks join before the core. Sockets: '+names+'.');
    buildButtons.forEach(b => { b.hidden=!build; b.disabled=!!tower || state.charge<TOWER_COST || movingFrom!==null; });
    moveButton.hidden=!build;
    const refund=tower?.builtWave===state.wave;
    moveButton.textContent=movingFrom!==null?'Cancel move':refund?'Refund tower':'Move tower';
    moveButton.disabled=movingFrom===null && (!tower || (!refund && (state.shifted || state.towers.every(Boolean))));
    launch.hidden=!build; launch.disabled=movingFrom!==null;
    launch.textContent='Send wave '+(state.wave+1);
    surge.hidden=build; surge.disabled=!tower || !state.surge;
    pace.textContent='Speed ×'+speed;
    api.setHud('Wave '+(state.wave+1)+'/4 · '+waveName()+' · Core '+state.hp+'/'+CORE_HP+' · Charge '+state.charge+
      ' · '+(selected+1)+' '+padNames[selected]+' ('+(tower?towerTypes[tower.type].name:'empty')+')');
    paint(ctx,state,selected);
  }
  function select(index) {
    if (movingFrom!==null) {
      if (!relocateTower(state,movingFrom,index)) {
        api.setStatus('Choose an empty socket to move this tower.'); return;
      }
      movingFrom=null;
    }
    selected=index; update(); api.setStatus(advice());
  }
  function install(type) {
    if (movingFrom!==null || !installTower(state,selected,type)) return;
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
    update(); api.setStatus(advice());
  }
  function boost() {
    if (!overdrive(state,selected)) return;
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
    if (/^[1-6]$/.test(k)) select(Number(k)-1);
    else if (['p','d','a'].includes(k)) install({p:'pulse',d:'delay',a:'arc'}[k]);
    else if (k==='r' && state.phase==='build') adjust();
    else if (k==='g') launchWave();
    else if (k==='b') boost();
    else return;
    event.preventDefault();
  });
  update(); api.setStatus(advice());
  api.frame(dt => {
    if (state.phase!=='wave') return;
    const hp=state.hp;
    // Fixed-size substeps keep accelerated waves consistent with ordinary play.
    let remaining=dt*speed;
    while (remaining>0 && state.phase==='wave') {
      const step=Math.min(remaining,1/60);
      stepPerimeter(state,step); remaining-=step;
    }
    if (state.phase==='ended') {
      update();
      const detail=state.outcome==='failed'?'The core went dark during wave '+(state.wave+1)+'.':'All four waves cleared with '+state.hp+' core integrity.';
      api.finish(state.outcome, detail+' Your towers stopped '+state.blocked+' units.');
    } else if (state.phase==='build') {
      update(); api.setStatus('Wave cleared. +2 charge. '+advice());
    } else if (state.hp!==hp) update();
    else paint(ctx,state,selected);
  });
}
