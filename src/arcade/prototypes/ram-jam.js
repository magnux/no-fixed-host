import { preferences } from '../../shell-storage.js';

const width = 448;
const height = 253;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const spawn = { x: 54, y: 162 };
const bin = { x: 28, y: 218 };
const flock = [
  ['Dot', 71, 160], ['Pip', 125, 86], ['Hex', 247, 97],
  ['Nib', 381, 79], ['Miso', 351, 177], ['Fenn', 191, 192],
];
const dogRoute = [[391, 208], [268, 200], [163, 152], [92, 108], [248, 74], [380, 120]];
const cursorRoute = [[287, 55], [340, 112], [247, 173], [135, 141], [180, 65]];

export function startMeadow(random = Math.random) {
  return {
    phase: 'ready', time: 0, player: { ...spawn }, target: null, progress: 0, greeted: 0,
    penalty: 0, grace: 0, chirpReady: 0, ring: null, message: '', catches: 0,
    dog: { x: 391, y: 208, waypoint: 1, lure: null },
    cursor: { x: 287, y: 55, waypoint: 1 },
    rams: flock.map(([name, x, y], index) => ({
      name, x, y, homeX: x, homeY: y, gait: random() * Math.PI * 2,
      patience: 13 + index * 1.6 + random() * 7, charge: 0, vx: 0, vy: 0,
      happy: false, bumped: new Set(),
    })),
  };
}

function steer(point, x, y, step) {
  const dx = x - point.x;
  const dy = y - point.y;
  const length = Math.hypot(dx, dy);
  if (length <= step) { point.x = x; point.y = y; return true; }
  point.x += step * dx / length;
  point.y += step * dy / length;
  return false;
}

function patrol(actor, route, step) {
  const [x, y] = route[actor.waypoint];
  if (steer(actor, x, y, step)) actor.waypoint = (actor.waypoint + 1) % route.length;
}

function contain(point) {
  point.x = clamp(point.x, 15, width - 15);
  point.y = clamp(point.y, 54, height - 22);
}

export function nearestRam(s) {
  let closest = null;
  for (const ram of s.rams) {
    if (ram.happy || ram.charge > 0) continue;
    if (!closest || distance(s.player, ram) < distance(s.player, closest)) closest = ram;
  }
  return closest;
}

export function chirp(s) {
  if (s.phase !== 'playing' || s.penalty > 0 || s.chirpReady > 0) return false;
  s.chirpReady = 4;
  s.ring = { ...s.player, time: s.time };
  s.dog.lure = { ...s.player, until: s.time + 3.5 };
  let count = 0;
  for (const ram of s.rams) {
    if (ram.happy || distance(s.player, ram) > 95) continue;
    ram.charge = 0;
    ram.patience = Math.max(ram.patience, 12);
    ram.homeX = ram.x; ram.homeY = ram.y;
    count++;
  }
  s.message = `Modem chirp! ${count} nearby RAM${count === 1 ? '' : 's'} settled. Watchdog.exe heard you.`;
  return true;
}

function scatter(s, ram, dt) {
  ram.x += ram.vx * dt * 98;
  ram.y += ram.vy * dt * 98;
  contain(ram);
  for (const other of s.rams) {
    if (other === ram || other.happy || ram.bumped.has(other) || distance(other, ram) > 20) continue;
    ram.bumped.add(other);
    other.x += ram.vx * 18;
    other.y += ram.vy * 18;
    contain(other);
    other.homeX = other.x; other.homeY = other.y;
  }
  if (!ram.bumped.has(s.player) && !s.penalty && distance(s.player, ram) < 15) {
    ram.bumped.add(s.player);
    s.player.x += ram.vx * 32; s.player.y += ram.vy * 32;
    contain(s.player);
    s.progress = 0; s.target = null;
    s.message = ram.name + ' barged past and scattered the flock.';
  }
  ram.charge = Math.max(0, ram.charge - dt);
  if (!ram.charge) {
    ram.homeX = ram.x; ram.homeY = ram.y;
    ram.patience = 14 + ram.gait;
  }
}

function graze(s, ram, dt) {
  if (ram.happy) return;
  if (ram.charge > 0) { scatter(s, ram, dt); return; }
  if (s.target === ram) return;
  ram.patience -= dt;
  if (ram.patience <= 0) {
    const angle = Math.atan2(s.player.y - ram.y, s.player.x - ram.x);
    ram.vx = Math.cos(angle); ram.vy = Math.sin(angle);
    ram.charge = 1.1;
    ram.bumped.clear();
    return;
  }
  if (ram.patience > 4) {
    steer(ram, ram.homeX + 7 * Math.sin(s.time * .38 + ram.gait),
      ram.homeY + 4 * Math.cos(s.time * .62 + ram.gait), dt * 5);
    contain(ram);
  }
}

export function stepMeadow(s, dt, input = {}) {
  if (s.phase !== 'playing') return;
  dt = Math.min(dt, 60 - s.time);
  s.time += dt;
  s.chirpReady = Math.max(0, s.chirpReady - dt);
  s.grace = Math.max(0, s.grace - dt);
  const dog = s.dog;
  if (dog.lure && dog.lure.until > s.time) steer(dog, dog.lure.x, dog.lure.y, dt * 63);
  else { dog.lure = null; patrol(dog, dogRoute, dt * 31); }
  patrol(s.cursor, cursorRoute, dt * 20);

  if (s.penalty > 0) {
    s.penalty = Math.max(0, s.penalty - dt);
    if (!s.penalty) { Object.assign(s.player, spawn); s.grace = 2; s.message = 'Restored. Your earlier greetings are still there.'; }
  } else {
    if (!input.sync) { s.progress = 0; s.target = null; }
    if (!s.target && input.sync) {
      const near = nearestRam(s);
      if (near && distance(near, s.player) <= 23) s.target = near;
    }
    if (!s.target) {
      const dx = input.x || 0, dy = input.y || 0;
      const length = Math.hypot(dx, dy);
      if (length) {
        s.player.x += dt * 91 * dx / length;
        s.player.y += dt * 91 * dy / length;
      } else if (input.destination) {
        steer(s.player, input.destination.x, input.destination.y, dt * 91);
      }
      contain(s.player);
    }
    if (!s.grace && (distance(s.player, dog) < 14 || distance(s.player, s.cursor) < 13)) {
      Object.assign(s.player, bin);
      s.penalty = 3; s.catches++;
      s.progress = 0; s.target = null;
      s.message = 'Into the Recycle Bin! Restoring in three seconds.';
    }
  }

  for (const ram of s.rams) graze(s, ram, dt);
  if (s.target && distance(s.player, s.target) > 24) { s.target = null; s.progress = 0; }
  if (s.target) {
    s.progress += dt;
    if (s.progress >= 2 - 1e-8) {
      s.target.happy = true;
      s.message = s.target.name + ' is running your smile. ^-^';
      s.greeted++; s.progress = 0; s.target = null;
    }
  }
  if (s.greeted === s.rams.length) s.phase = 'complete';
  else if (s.time >= 60 - 1e-8) s.phase = s.greeted ? 'partial' : 'failed';
}

function landscape(ctx) {
  const rect = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  const polygon = (points, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill();
  };
  rect(0, 0, width, height, '#bea8cf');
  rect(0, 16, width, 18, '#e0b9c5');
  rect(335, 5, 20, 21, '#ffe4a5'); rect(330, 10, 30, 12, '#ffe4a5');
  for (const [x,y] of [[15,12],[81,5],[147,18],[220,10],[374,22]]) {
    rect(x, y, 19, 3, '#eee4d9'); rect(x + 6, y - 3, 9, 3, '#eee4d9');
  }
  polygon([[0,29],[53,17],[108,33],[175,13],[214,17],[271,38],[324,24],[376,27],[423,16],[448,21],[448,59],[0,59]], '#697c94');
  polygon([[0,36],[86,43],[161,29],[233,43],[335,28],[397,42],[448,34],[448,67],[0,67]], '#62877b');
  rect(0, 47, width, height, '#4c8777');
  polygon([[0,57],[110,45],[231,50],[149,64],[0,79]], '#74a786');
  polygon([[448,54],[261,56],[133,90],[0,98],[0,112],[163,97],[282,65],[448,63]], '#68a18a');
  polygon([[448,103],[335,91],[253,103],[171,121],[242,118],[368,100],[448,112]], '#599582');
  polygon([[0,177],[121,144],[190,146],[101,161],[0,193]], '#579581');
  polygon([[448,169],[318,146],[256,151],[337,154],[448,182]], '#55927f');
  rect(0, 215, width, 38, '#568e77');
  for (let i = 0; i < 94; i++) {
    const x = (37 + i * 61) % width, y = 53 + (i * 47) % 180;
    rect(x, y, 2, 2, '#78aa89'); rect(x + 3, y - 1, 1, 2, '#376f67');
    if (i % 7 === 0) { rect(x + 1, y - 4, 2, 3, '#375f57'); rect(x, y - 5, 3, 2, '#f4cb95'); }
  }
  for (let x = -8; x < width; x += 29) {
    rect(x, 42, 2, 8, '#b9c29d'); rect(x + 2, 44, 27, 1, '#acb59a');
  }
  rect(bin.x - 9, bin.y - 15, 17, 16, '#31585b'); rect(bin.x - 11, bin.y - 17, 21, 3, '#bddbd3');
  for (let i = -5; i <= 5; i += 5) rect(bin.x + i, bin.y - 11, 2, 8, '#9cbeb4');
  rect(0, 238, width, 15, '#243941'); rect(0, 238, width, 1, '#94baac');
  ctx.font = '8px monospace'; ctx.fillStyle = '#c5dbc7'; ctx.fillText('▣  MEADOW.SCR', 7, 249);
  ctx.textAlign = 'right'; ctx.fillText('FLOCK SERVICE  •', 437, 249); ctx.textAlign = 'left';
}

function sheep(ctx, ram, t, syncing) {
  const stamp = !ram.happy && ram.patience <= 4;
  const hop = ram.charge || stamp ? Math.round(Math.abs(Math.sin(t * (ram.charge ? 17 : 9))) * 3) : 0;
  ctx.save(); ctx.translate(Math.round(ram.x), Math.round(ram.y));
  const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  box(-14, 3, 27, 3, '#3a7569');
  ctx.translate(0, -hop);
  box(-9, -1, 3, 6, '#343646'); box(6, -1, 3, 6, '#343646');
  box(-13, -13, 20, 13, '#d5c9ac'); box(-16, -10, 4, 7, '#e4d8bb');
  box(-12,-14,7,4,'#f1e9d1'); box(-13,-9,19,6,'#ede5cc'); box(-5,-16,7,5,'#f7ecd8');
  box(-7,-11,4,3,'#c6b99d'); box(-12,-4,6,2,'#ccc3a8');
  box(-1,-14,15,12,'#3b4852'); box(0,-13,13,9, ram.happy ? '#9df4c7' : stamp ? '#ffc077' : '#99ddc5');
  box(-3,-16,5,3,'#af865c'); box(-4,-15,2,4,'#e8b982'); box(0,-17,3,2,'#e8b982');
  box(10,-16,4,3,'#e0b180');
  ctx.strokeStyle = '#26444b'; ctx.lineWidth = 1.5; ctx.beginPath();
  if (ram.happy) {
    ctx.moveTo(1,-8);ctx.lineTo(3,-10);ctx.lineTo(5,-8);
    ctx.moveTo(7,-8);ctx.lineTo(9,-10);ctx.lineTo(11,-8);
    ctx.moveTo(5,-6);ctx.lineTo(8,-6);
  } else if (stamp) {
    ctx.moveTo(2,-11);ctx.lineTo(5,-9);ctx.moveTo(8,-9);ctx.lineTo(11,-11);
  } else {
    box(3,-10,2,3,'#26444b');box(9,-10,2,3,'#26444b');
  }
  ctx.stroke();
  if (stamp && !syncing) { ctx.fillStyle='#fff2a7'; ctx.font='bold 13px monospace'; ctx.fillText('!', 1,-21); }
  ctx.restore();
}

function paint(ctx, background, s, destination) {
  ctx.drawImage(background, 0, 0);
  const t = s.time;
  const near = nearestRam(s);
  if (near && !s.penalty && distance(s.player, near) <= 23) {
    ctx.beginPath(); ctx.ellipse(near.x, near.y, 18, 7, 0, 0, Math.PI * 2);
    ctx.setLineDash([3,2]); ctx.strokeStyle='#e4f8df'; ctx.stroke(); ctx.setLineDash([]);
  }
  if (destination && !s.penalty && distance(destination, s.player) > 5) {
    ctx.strokeStyle='#c4e6d4'; ctx.beginPath();ctx.moveTo(destination.x-3,destination.y);ctx.lineTo(destination.x+3,destination.y);
    ctx.moveTo(destination.x,destination.y-3);ctx.lineTo(destination.x,destination.y+3);ctx.stroke();
  }
  if (s.ring && t - s.ring.time < .8) {
    const age = (t - s.ring.time) / .8;
    ctx.save(); ctx.strokeStyle='#e5f9c2'; ctx.globalAlpha=1-age; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(s.ring.x,s.ring.y,3+age*92,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  for (const ram of s.rams) sheep(ctx, ram, t, s.target === ram);

  ctx.save(); ctx.translate(Math.round(s.dog.x), Math.round(s.dog.y));
  ctx.fillStyle='#4c4755'; ctx.fillRect(-13,-3,24,7);ctx.fillRect(-9,1,3,6);ctx.fillRect(6,1,3,6);ctx.fillRect(-16,-8,4,6);
  ctx.fillStyle='#e9a657'; ctx.fillRect(-12,-7,19,8);ctx.fillRect(3,-12,10,11);ctx.fillRect(11,-7,5,5);
  ctx.fillStyle='#664c50';ctx.fillRect(3,-12,4,7);ctx.fillRect(14,-7,3,2);
  ctx.fillStyle='#fff0b4';ctx.fillRect(9,-10,2,2);ctx.fillRect(-3,-8,3,9);
  if (s.dog.lure) { ctx.font='bold 13px monospace';ctx.fillText('♪',4,-16); }
  ctx.restore();
  ctx.save();ctx.translate(Math.round(s.cursor.x),Math.round(s.cursor.y));ctx.beginPath();
  ctx.moveTo(-3,-11);ctx.lineTo(-3,8);ctx.lineTo(2,4);ctx.lineTo(6,12);ctx.lineTo(10,10);ctx.lineTo(6,3);ctx.lineTo(13,3);ctx.closePath();
  ctx.fillStyle='#f9e8d3';ctx.strokeStyle='#463b54';ctx.lineWidth=2;ctx.fill();ctx.stroke();ctx.restore();

  ctx.save();ctx.translate(Math.round(s.player.x),Math.round(s.player.y));
  const box = (x,y,w,h,color) => { ctx.fillStyle=color;ctx.fillRect(x,y,w,h); };
  if (s.penalty) {
    ctx.fillStyle='#251e3c';ctx.fillRect(-8,-13,16,10);ctx.fillStyle='#ffc2aa';
    ctx.font='bold 9px monospace';ctx.fillText(String(Math.ceil(s.penalty))+'s',-5,-5);
  } else if (!s.grace || Math.floor(t*8)%2===0) {
    for (const x of [-6,5]) { box(x,-1,3,5,'#403753');box(x,-13,2,4,'#c2aedb'); }
    box(-9,-11,18,12,'#3f335b');box(-8,-12,16,11,'#d4bceb');box(-6,-10,12,7,'#635080');
    box(-4,-8,2,2,'#eaf9fa');box(2,-8,2,2,'#eaf9fa');box(-11,-7,3,5,'#dbc1e7');box(8,-7,3,5,'#dbc1e7');
    ctx.beginPath();ctx.moveTo(-3,-20);ctx.lineTo(3,-20);ctx.lineTo(0,-16);ctx.closePath();ctx.fillStyle='#f7e6ff';ctx.fill();
  }
  ctx.restore();
  if (s.target) {
    const x=Math.round(s.target.x-18), y=Math.round(s.target.y-24);
    ctx.fillStyle='#323b4a';ctx.fillRect(x,y,36,5);
    ctx.fillStyle='#f7e7b6';ctx.fillRect(x+1,y+1,Math.round(34*s.progress/2),3);
  }
}

export default function mount(api) {
  const s = startMeadow();
  const { canvas, ctx } = api.canvas(width, height);
  canvas.style.imageRendering = 'pixelated';
  canvas.style.touchAction = 'none';
  canvas.setAttribute('aria-label', 'Meadow with six CRT sheep. You are the lilac chip below the white pointer. The dog is orange. A large cream mouse cursor is the groundskeeper.');
  const background = document.createElement('canvas');
  background.width = width; background.height = height;
  landscape(background.getContext('2d'));
  const keys = new Set();
  let destination, syncingPointer, toggleSync = false, audio;
  const clear = () => { keys.clear(); syncingPointer = null; toggleSync = false; destination = null; };

  function begin() {
    if (s.phase !== 'ready') return;
    s.phase = 'playing';
    start.hidden = true; sync.disabled = false; whistle.disabled = false;
    api.stage.focus({ preventScroll: true });
    s.message = 'Dot is within reach. Hold Space or Hold to sync for two seconds. Let go to flee.';
    refresh();
  }
  function sound() {
    try {
      const prefs = preferences(window.localStorage);
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!prefs.sound || !prefs.uiVolume || !Audio) return;
      audio ??= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const voice = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime;
      voice.type = 'triangle';
      voice.frequency.setValueAtTime(760, at);
      voice.frequency.setValueAtTime(1110, at + .07);
      voice.frequency.setValueAtTime(920, at + .13);
      gain.gain.setValueAtTime(.047 * prefs.uiVolume / 100, at);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .23);
      voice.connect(gain).connect(audio.destination);
      voice.start(at); voice.stop(at + .24);
      voice.onended = () => { voice.disconnect(); gain.disconnect(); };
    } catch { /* The visible ring also carries the cue. */ }
  }
  function callFlock() {
    if (!chirp(s)) return;
    sound();
    refresh();
  }
  const start = api.action('Start meadow', begin, { primary: true });
  const sync = api.action('Hold to sync', event => {
    // Assistive technology and Enter can activate once to hold, and again to release.
    if (event.detail === 0) toggleSync = !toggleSync;
  }, { primary: true });
  const whistle = api.action('Modem chirp (C)', callFlock);
  sync.disabled = whistle.disabled = true;
  sync.style.touchAction = 'none';
  sync.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    toggleSync = false;
    syncingPointer = event.pointerId;
    sync.setPointerCapture(event.pointerId);
  });
  function releasePointer(event) {
    if (syncingPointer === event.pointerId) syncingPointer = null;
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) sync.addEventListener(name, releasePointer);

  canvas.addEventListener('pointerdown', event => {
    if (s.phase !== 'playing' || s.penalty || event.button !== 0) return;
    const bounds = canvas.getBoundingClientRect();
    const spot = { x: (event.clientX-bounds.left)*width/bounds.width, y: (event.clientY-bounds.top)*height/bounds.height };
    // Tapping a sheep's screen aims at its feet, including on narrow displays.
    const chosen = s.rams.find(ram => !ram.happy && Math.hypot(ram.x-spot.x, ram.y-7-spot.y) <= 15);
    destination = chosen ?? spot;
    toggleSync = false;
    api.stage.focus({ preventScroll: true });
    event.preventDefault();
  });
  const directions = {
    ArrowLeft: [-1,0], KeyA: [-1,0], ArrowRight: [1,0], KeyD: [1,0],
    ArrowUp: [0,-1], KeyW: [0,-1], ArrowDown: [0,1], KeyS: [0,1],
  };
  api.onKey(event => {
    if (s.phase === 'ready' && event.key === 'Enter' && !event.repeat) {
      event.preventDefault(); begin(); return;
    }
    if (s.phase !== 'playing') return;
    if (Object.hasOwn(directions, event.code) || event.code === 'Space') {
      event.preventDefault(); keys.add(event.code);
      if (event.code !== 'Space') { destination = null; toggleSync = false; }
    } else if (event.code === 'KeyC' && !event.repeat) { event.preventDefault(); callFlock(); }
  });
  const keyup = event => keys.delete(event.code);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
    if (audio) audio.close().catch(() => {});
  });

  function refresh() {
    const near = nearestRam(s);
    let hint = 'Flock greeted';
    if (s.penalty) hint = 'In bin · ' + Math.ceil(s.penalty) + 's';
    else if (s.target) hint = s.target.name + ' · Sync ' + Math.floor(s.progress*10)*5 + '%';
    else if (near) {
      const dx = near.x - s.player.x, dy = near.y - s.player.y;
      const heading = (Math.abs(dy) > 9 ? (dy < 0 ? 'N' : 'S') : '') + (Math.abs(dx) > 9 ? (dx < 0 ? 'W' : 'E') : '');
      hint = distance(s.player, near) <= 23 ? near.name + ' in reach' : near.name + ' · ' + heading;
    }
    api.setHud(`${Math.ceil(60-s.time)}s · ${s.greeted}/6 greeted · ${hint}`);
    if (s.message) { api.setStatus(s.message); s.message = ''; }
    sync.setAttribute('aria-pressed', String(Boolean(s.target)));
    whistle.disabled = s.phase !== 'playing' || s.penalty > 0 || s.chirpReady > 0;
    whistle.textContent = s.chirpReady ? `Chirp in ${Math.ceil(s.chirpReady)}s` : 'Modem chirp (C)';
    paint(ctx, background, s, destination);
  }
  api.setStatus('Move with arrows or WASD, or tap the meadow to walk. Hold Space or Hold to sync beside a RAM. Stampers charge; C calms nearby RAMs and calls the dog.');
  refresh();
  api.frame(dt => {
    if (s.phase !== 'playing') return;
    let x = 0, y = 0;
    for (const key of keys) {
      const dir = directions[key];
      if (dir) { x += dir[0]; y += dir[1]; }
    }
    const before = s.greeted;
    stepMeadow(s, dt, { x, y, destination, sync: toggleSync || syncingPointer != null || keys.has('Space') });
    if (s.penalty) clear();
    if (before !== s.greeted) { toggleSync = false; destination = null; }
    refresh();
    if (s.phase === 'complete') api.finish('complete', `All six RAMs are wearing your smile. The flock synced in ${Math.ceil(s.time)} seconds. ^-^`);
    else if (s.phase === 'partial') api.finish('partial', `The monitor sleeps. ${s.greeted} of six RAMs carry your greeting into standby.`);
    else if (s.phase === 'failed') api.finish('failed', 'The monitor sleeps. The meadow is still waiting for its first greeting.');
  });
}
