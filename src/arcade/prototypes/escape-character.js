// A room is one screen. Platform triples are left edge, right edge and top.
const width = 424;
const height = 208;
const floor = 178;
const ground = [[0, width, floor]];
const roomTypes = {
  dock: {
    name: 'Arrival Lock', color: '#89e2c0', sky: '#19363c', left: 'plenum', right: 'relay',
    platforms: ground, grate: [75, 103],
    hint: 'The uplink glows behind the low grate. The amber doors lead deeper into the facility.',
  },
  relay: {
    name: 'Relay Gallery', color: '#f2cb88', sky: '#36303e', left: 'dock', right: 'tanks',
    platforms: ground,
    hint: 'The amber passage leads east. A narrow return chute opens above the relay cabinets.',
  },
  tanks: {
    name: 'Coolant Baths', color: '#75d5e1', sky: '#153846', left: 'relay', right: 'racks',
    platforms: [[0, 164, floor], [207, width, floor]],
    hint: 'Jump the open coolant channel. Losing your footing returns you to this doorway.',
  },
  racks: {
    name: 'Stack Elevator', color: '#d5b7f6', sky: '#2b2943', left: 'tanks', right: 'cradle',
    platforms: [...ground, [112, 202, 153], [208, 295, 129], [301, width, 104]],
    hint: 'The upper doorway still has power. Jump up the three marked maintenance decks.',
  },
  cradle: {
    name: 'Core Cradle', color: '#ffe299', sky: '#3a3431', left: 'racks',
    platforms: ground,
    hint: 'A gold coupling floats in the cradle. Walk into it to install it in your shell.',
  },
  plenum: {
    name: 'Uplink Plenum', color: '#b1edcc', sky: '#193e45', left: 'vault', right: 'dock',
    platforms: ground, grate: [340, 353],
    hint: 'The surface uplink is live. Use the lift to leave, or follow the violet line west.',
  },
  vault: {
    name: 'Echo Vault', color: '#e0aff3', sky: '#34283f', right: 'plenum',
    platforms: [...ground, [231, 316, 155], [142, 226, 131], [49, 136, 106]],
    hint: 'A memory loops on the highest shelf. Reassemble the shell for higher jumps.',
  },
};
export function startEscape(random = Math.random) {
  const between = (lo, hi) => Math.floor(random() * (hi - lo + 1)) + lo;
  const rooms = Object.fromEntries(Object.entries(roomTypes).map(([id, room]) => [id, { ...room }]));
  // Every shuffle preserves both the gated west wing and the coupling beyond the three service rooms.
  const middle = ['relay', 'tanks', 'racks'];
  for (let i = middle.length - 1; i > 0; i--) {
    const j = between(0, i);
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  const mapOrder = ['vault', 'plenum', 'dock', ...middle, 'cradle'];
  mapOrder.forEach((id, i) => { rooms[id].left = mapOrder[i-1]; rooms[id].right = mapOrder[i+1]; });
  const lip = between(119,214), gap = between(42,65);
  rooms.tanks.platforms = [[0, lip, floor], [lip + gap, width, floor]];
  const rise = between(-5,5), shift = between(-15,15);
  rooms.racks.platforms = [...ground, [104+shift,198+shift,153+rise], [208+shift,296+shift,129-rise], [306+shift,width,104]];
  const shelf = between(-12,12);
  rooms.vault.platforms = [...ground, [231+shelf,316+shelf,155], [142+shelf,226+shelf,131], [49+shelf,136+shelf,106]];
  rooms.vault.memoryX = 89 + shelf;
  const grate = between(61,90);
  rooms.dock.grate = [grate, grate+between(19,32)];
  rooms.dock.hazard = { type: 'vent', x: between(240,323), offset: random()*3.1 };
  rooms.relay.hazard = { type: 'cart', x: between(228,291), offset: random()*6 };
  rooms.cradle.hazard = { type: 'press', x: between(99,142), offset: random()*4.4 };
  rooms.dock.hint = 'The amber door leads toward the coupling. Steam lifts from the striped vent after its lamps light.';
  rooms.relay.hint = 'A live inspection trolley patrols its rail. Jump the trolley. The overhead chute returns here.';
  rooms.cradle.hint = 'Wait for the stamping press to lift, then reach the gold coupling.';
  return { room: 'dock', rooms, mapOrder, x: 139, y: floor, vy: 0, grounded: true, face: 1,
    spawnX: 139, spawnY: floor, visited: new Set(['dock']), unlocked: false, core: false,
    memory: false, ended: '', time: 0, steps: 0, rescues: 0, shiftFlash: 0, landFlash: 0, rescueFlash: 0,
    message: rooms.dock.hint };
}

// The simulation and renderer share the same instantaneous machinery bounds.
export function escapeHazard(s) {
  const h = s.rooms[s.room].hazard;
  if (!h) return null;
  const t = s.time + h.offset;
  if (h.type === 'vent') {
    const phase = t % 3.1;
    const jet = Math.min(1, Math.max(0, Math.min(phase - 2.1, 3.1 - phase) * 8));
    return { type: h.type, x: h.x, halfWidth: 6, top: floor - jet * 28, bottom: floor,
      active: jet > .15, warning: phase > 1.45 && phase < 2.1 };
  }
  if (h.type === 'cart') {
    return { type: h.type, x: h.x + 28 * Math.sin(t * 1.9), halfWidth: 8, top: floor - 12, bottom: floor, active: true };
  }
  const phase = t % 4.4;
  const extension = Math.max(0, Math.min(1, Math.min((phase - 2.2)*4, (3.95 - phase)*1.5)));
  return { type: h.type, x: h.x, halfWidth: 11, top: 63, bottom: 91 + 86*extension,
    active: true, warning: phase > 1.65 && phase < 2.2 };
}

function enter(s, id, x, y = floor) {
  Object.assign(s, { room: id, x, y, spawnX: x, spawnY: y, vy: 0, grounded: true, message: s.rooms[id].hint });
  s.visited.add(id);
}

export function leap(s) {
  if (!s.ended && s.grounded) {
    s.vy = s.core ? -146 : -233;
    s.grounded = false;
  }
}

function underGrate(s, x = s.x) {
  const grate = s.rooms[s.room].grate;
  return grate && x > grate[0] - 6 && x < grate[1] + 6;
}

export function shiftForm(s) {
  if (s.ended) return;
  if (!s.unlocked) {
    s.message = 'The core is fixed in place. Follow the amber doors to its coupling.';
    return;
  }
  if (s.core && underGrate(s)) {
    s.message = 'Roll clear of the grate before rebuilding the shell.';
    return;
  }
  s.core = !s.core; s.shiftFlash = .34;
  s.message = s.core ? 'Core released. Roll through low grates.' : 'Shell assembled. Its legs can reach high platforms.';
}

function fixture(s) {
  if (s.room === 'plenum' && Math.abs(s.x - 214) <= 34) return 'Take uplink';
  if (s.room === 'cradle' && Math.abs(s.x - 339) <= 28) return 'Enter chute';
  return '';
}

export function useFixture(s) {
  if (s.ended) return;
  const nearby = fixture(s);
  if (nearby === 'Enter chute' && s.core) {
    enter(s, 'relay', 153);
    s.message = 'The chute drops you in the Relay Gallery. Follow the mint doors west to the first grate.';
  } else if (nearby === 'Take uplink') {
    s.ended = s.memory ? 'complete' : 'partial';
    s.message = s.memory ? 'You wake on the other side with the voice that first called you home.' :
      'Your signal reaches the surface. One recording still echoes in the old facility.';
  } else s.message = nearby === 'Enter chute' ? 'This shortcut fits a detached core. Shift form and enter.' :
    'Find the green uplink or stand at the mouth of the return chute.';
}

export function stepEscape(s, dt, direction) {
  if (s.ended) return;
  const room = s.rooms[s.room];
  s.time += dt;
  for (const timer of ['shiftFlash','landFlash','rescueFlash']) s[timer] = Math.max(0, s[timer]-dt);
  if (direction) s.face = direction;
  const speed = s.core ? 168 : 135;
  let x = s.x + direction * dt * speed;
  if (room.grate && underGrate(s, x)) {
    if (!s.core || s.y < floor - 4) {
      if (!underGrate(s)) {
        x = direction < 0 ? room.grate[1] + 6 : room.grate[0] - 6;
        s.message = 'The gap is only one core high. Roll through along the floor.';
      }
    }
    if (s.core && underGrate(s)) { s.vy = Math.max(0, s.vy); s.y = floor; }
  }
  if (x < 6 || x > width - 6) {
    const west = x < 6;
    const next = west ? room.left : room.right;
    if (next && !(s.room === 'racks' && !west && s.y > 112)) {
      enter(s, next, west ? width - 18 : 18, next === 'racks' && west ? 104 : floor);
      return;
    }
    x = west ? 6 : width - 6;
    if (s.room === 'racks' && !west) s.message = 'The east door is on the top deck.';
  }
  s.steps += Math.abs(x - s.x);
  s.x = x;
  const previousY = s.y;
  const landingSpeed = s.vy;
  s.vy += 530 * dt;
  s.y += s.vy * dt;
  s.grounded = false;
  if (s.vy >= 0) {
    for (const [left, right, top] of room.platforms) {
      if (s.x >= left && s.x <= right && previousY <= top && s.y >= top) {
        if (landingSpeed > 100) s.landFlash = .17;
        s.y = top; s.vy = 0; s.grounded = true; break;
      }
    }
  }
  const hazard = escapeHazard(s);
  const hit = hazard?.active && Math.abs(s.x-hazard.x) < hazard.halfWidth + 4 &&
    s.y > hazard.top + 1 && s.y - (s.core ? 10 : 23) < hazard.bottom;
  if (s.y > height + 12 || hit) {
    s.x = s.spawnX; s.y = s.spawnY; s.vy = 0; s.grounded = true; s.rescues++; s.rescueFlash = .7;
    const warning = hazard?.type === 'cart' ? 'Jump the inspection trolley as it approaches.' :
      hazard?.type === 'press' ? 'Wait for the press to rise.' : hazard ? 'Cross after the steam fades.' : 'Jump near the striped edge.';
    s.message = 'Salvage arm retrieved you. ' + warning;
    return;
  }
  if (s.room === 'cradle' && !s.unlocked && Math.abs(s.x - 210) < 16 && s.y > 145) {
    s.unlocked = true;
    s.message = 'Coupling installed! Shift form to detach your core. Try the return chute to the east.';
  }
  if (s.room === 'vault' && !s.memory && Math.abs(s.x - s.rooms.vault.memoryX) < 15 && s.y >= 84 && s.y <= 107) {
    s.memory = true;
    s.message = 'Memory recovered: “When you wake up, come find me.” The surface lift is one room east.';
  }
}

function paint(ctx, s, moving) {
  const room = s.rooms[s.room], color = room.color, clock = s.time;
  const rect = (x, y, w, h, fill) => {
    ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  function text(value, x, y, tint, size = 8) {
    ctx.fillStyle = tint; ctx.font = 'bold ' + size + 'px monospace'; ctx.fillText(value, x, y);
  }
  const star = (x, y, tint) => { rect(x - 3, y, 7, 1, tint); rect(x, y - 3, 1, 7, tint); };
  function door(x, y, side, tint) {
    rect(x, y - 36, 17, 36, '#0c161e'); rect(x, y - 37, 17, 3, tint);
    rect(x + (side < 0 ? 1 : 13), y - 35, 2, 35, '#748688');
    text(side < 0 ? '‹' : '›', x + 4, y - 13, tint, 13);
  }
  function rack(x, y, w, h) {
    rect(x, y, w, h, '#18252e'); rect(x + 2, y + 2, w - 4, h - 4, '#27343a');
    for (let n = 6; n < h - 5; n += 10) {
      rect(x + 5, y + n, w - 10, 6, '#152028');
      rect(x + 7, y + n + 2, 2, 2, (n + x) % 3 ? '#78948b' : color);
    }
  }
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#101b26'); sky.addColorStop(1, room.sky);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  for (let x = 12; x < width; x += 67) {
    rect(x, 27, 3, floor - 27, '#141e29'); rect(x + 3, 28, 1, floor - 28, '#314049');
    rect(x + 6, 48, 47, 1, '#33434c'); rect(x + 4, 108, 4, 3, '#49545a');
  }
  if (s.room === 'dock' || s.room === 'plenum') {
    const x = s.room === 'dock' ? 22 : 175;
    rect(x - 6, 74, 79, 104, '#42605d'); rect(x - 3, 77, 73, 101, '#152d34');
    const dawn = ctx.createLinearGradient(0, 79, 0, 162);
    dawn.addColorStop(0, '#628d92'); dawn.addColorStop(.65, '#f2c99d'); dawn.addColorStop(1, '#d2987d');
    ctx.fillStyle = dawn; ctx.fillRect(x, 80, 67, 80);
    rect(x + 40, 97, 10, 14, '#ffeaba'); rect(x + 37, 101, 16, 6, '#ffeaba');
    for (let n = 0; n < 12; n++) {
      const h = (n * 11 + 6) % 28 + 4;
      rect(x + n * 6, 160 - h, 6, h, '#5d7174');
    }
    rect(x + 32, 80, 3, 81, '#416369'); rect(x, 134, 67, 2, '#416369');
    text('UPLINK', x + 9, 173, '#c8f9ce');
    if (s.room === 'dock') {
      rack(207, 107, 52, 71); rack(264, 114, 35, 64);
      rect(312, 131, 57, 7, '#416969'); rect(352, 138, 5, 40, '#416969');
      text('CRADLE →', 306, 106, '#efc78d');
    } else {
      rack(60, 112, 32, 66); text('← ECHO', 28, 90, '#e5bef5');
      rect(176, 176, 76, 2, color);
      for (let i = 0; i < 4; i++) rect(208, 63 - i * 5, 8, 2, i % 2 ? '#608c80' : color);
    }
  } else if (s.room === 'relay') {
    for (let i = 0; i < 7; i++) rack(28 + i * 55, 87 + i % 3 * 7, 41, 91 - i % 3 * 7);
    rect(145, 42, 19, 38, '#705e57'); rect(141, 77, 27, 5, '#dfaf7e');
    text('RETURN', 137, 70, '#f5dba3', 7);
  } else if (s.room === 'tanks') {
    for (let i = 0; i < 4; i++) {
      const x = 35 + 91 * i;
      rect(x, 57, 54, 102, '#435a64'); rect(x + 3, 61, 48, 92, '#14313c');
      rect(x + 4, 98 + (i % 2) * 11, 46, 53 - (i % 2) * 11, '#27717b');
      rect(x + 7, 64, 2, 81, '#708d92'); rect(x - 3, 152, 60, 6, '#4f626a');
      for (let n = 0; n < 6; n++) rect(x + 9 + (n * 13 % 36), 146 - (n * 9 + clock * 10) % 42, 2, 2, '#75c1bf');
    }
    const lip = room.platforms[0][1], gap = room.platforms[1][0] - lip;
    rect(lip, 197, gap, 11, '#369494');
    for (let i = 0; i < gap; i += 5) rect(lip+i, 196+Math.sin(clock*4+i/9)*1.6, 5, 2, color);
  } else if (s.room === 'racks') {
    for (let i = 0; i < 8; i++) {
      const h = 42 + ((i * 17) % 76);
      rack(8 + i * 54, 178 - h, 39, h);
    }
    text('UPPER LOCK ↗', 290, 84, color);
  } else if (s.room === 'cradle') {
    for (let x of [83, 281]) { rect(x, 56, 9, 122, '#4b4947'); rect(x, 55, 43, 5, '#69645a'); }
    rect(170, 159, 79, 19, '#6e6354'); rect(175, 153, 69, 7, '#a19773');
    rect(193, 150, 35, 5, '#b7b68c'); rect(197, 150, 27, 2, color);
    if (!s.unlocked) {
      const y = 130 + Math.sin(clock * 3) * 3;
      rect(200, y, 20, 9, '#dfb771'); rect(204, y - 4, 12, 17, color);
      rect(206, y, 8, 8, '#faffdf'); star(228, y - 8, '#eed58f');
    }
    rect(321, 150, 36, 28, '#5d655f'); rect(324, 156, 30, 22, '#101f2b');
    text('CHUTE ↓', 313, 140, '#efc88f');
  } else {
    for (let i = 0; i < 9; i++) {
      rect(29 + i * 44, 54, 2, 82, '#4c4857');
      rect(24 + i * 44, 91 + (i % 3) * 9, 13, 19, '#625970');
    }
    if (!s.memory) {
      const y = 84 + Math.sin(clock * 2) * 2;
      ctx.save(); ctx.translate(room.memoryX-89, 0);
      rect(80, y, 18, 10, '#aa80c1'); rect(82, y - 3, 14, 4, '#f4c1f4');
      rect(83, y + 2, 4, 4, '#eee4ff'); rect(91, y + 2, 4, 4, '#eee4ff');
      star(106, y - 4, color); ctx.restore();
    }
    text('RECALL', 67, 61, color);
  }
  if (room.left) door(2, floor, -1, s.room === 'vault' || s.room === 'plenum' ? '#cbaadb' : '#83c6bb');
  if (room.right) door(width - 19, s.room === 'racks' ? 104 : floor, 1, '#d8b98e');
  for (const [left, right, y] of room.platforms) {
    rect(left, y, right - left, y === floor ? 30 : 8, '#243038');
    rect(left, y, right - left, 2, '#afc4b7'); rect(left, y + 2, right - left, 3, '#597377');
    for (let x = left + 5; x < right - 5; x += 13) rect(x, y + 6, 5, 2, '#455660');
  }
  if (room.grate) {
    const [a, b] = room.grate;
    rect(a - 2, 26, b - a + 4, 5, '#6c8c87');
    for (let x = a; x < b; x += 6) { rect(x, 31, 3, 134, '#678587'); rect(x, 32, 1, 134, '#95aaa2'); }
    rect(a - 2, 158, b - a + 4, 6, '#7e9990');
    rect(a - 3, 164, b - a + 6, 3, '#e9cc87');
  }
  const hazard = escapeHazard(s);
  if (hazard) {
    const { x, top, bottom } = hazard;
    const red = '#ff9677', steel = '#56767a';
    if (hazard.type === 'cart') {
      rect(room.hazard.x-37, floor-2, 74, 2, '#c6a87c');
      rect(x-8, top+2, 16, 7, '#bd886e'); rect(x-7, top+3, 14, 2, '#f1c895');
      rect(x-3, top-1, 6, 2, '#d8c491'); rect(x-2, top-2, 4, 2, Math.sin(clock*11)>0 ? red : '#593f43');
      for (const off of [-5,5]) {
        rect(x+off-2,floor-4,4,4,'#202c32'); rect(x+off+Math.sin(clock*15),floor-3,1,2,steel);
      }
    } else if (hazard.type === 'vent') {
      rect(x-9,floor-2,18,4,steel);
      for (const off of [-6,-2,2,6]) {
        rect(x+off-1, floor-2, 2, 2, hazard.warning ? red : '#33474c');
        if (hazard.active) {
          const drift = Math.sin(clock*17+off)*2;
          rect(x+off-1,top+3,2,floor-top-3,'#9ac4bf'); rect(x+off+drift,top-1,2,4,'#d6e7d8');
        }
      }
    } else {
      rect(x-15, 49, 30, 13, '#536b68');
      rect(x-5, 62, 10, bottom-67, '#779197');
      for (let j = 68; j < bottom - 8; j += 11) rect(x-5, j, 10, 2, '#4d676b');
      rect(x-11, bottom-9, 22, 8, '#dab583');
      for (let j = -8; j < 9; j += 6) rect(x+j, bottom-6, 3, 4, '#495056');
      rect(x+11, 51, 3,4, hazard.warning ? red : '#b4caa1');
    }
    for (const side of [-1,1]) rect(room.hazard.x + side*(hazard.type === 'cart' ? 39 : 14), floor, 3, 3, '#ffbd83');
  }
  const x = Math.round(s.x), y = Math.round(s.y), gait = Math.sin(s.steps / 5);
  ctx.save(); ctx.translate(x,y); ctx.scale(s.face,1);
  if (s.rescueFlash > 0) {
    const distance = (.7-s.rescueFlash)*30;
    ctx.strokeStyle = '#b6f3d4'; ctx.beginPath(); ctx.arc(0,-10,8+distance,0,Math.PI*2); ctx.stroke();
  }
  if (s.core) {
    ctx.save(); ctx.translate(0,-6); ctx.rotate(s.steps/7);
    rect(-5,-5,10,10,'#8eaabd'); rect(-6,-3,12,6,'#cdebc1'); rect(-3,-6,6,12,'#a7d5bc');
    rect(-3,-3,6,6,'#447879'); rect(-1,-2,2,3,'#d7ffd7'); rect(3,-3,2,2,'#f7dc9b');
    ctx.restore();
    if (moving && s.grounded) rect(-10-Math.abs(gait)*2,-3,3,1,'#9ab8a2');
  } else {
    const bob = s.landFlash > 0 ? 2 : moving && s.grounded ? Math.round(Math.abs(gait)*1.5) : 0;
    for (const side of [-1,1]) {
      const stride = s.grounded ? (moving ? gait*side*4 : 0) : side*3;
      rect(side*3-2, -10+bob, 4, 6,'#70898c'); rect(side*3+stride-2,-6,4,5,'#b7ccbc');
      rect(side*3+stride-2,-2-Math.abs(stride)*.35,6,2,'#536e79');
    }
    rect(-8,-20+bob,5,11,'#48686d'); rect(-9,-19+bob,3,6,'#6c9c91');
    rect(-6,-20+bob,13,13,'#92aaa1'); rect(-4,-18+bob,9,6,'#607f7c');
    rect(-2,-17+bob,5,4,'#efd593'); rect(-6,-11+bob,12,3,'#49646a');
    rect(-5,-27+bob,11,9,'#dcdabb'); rect(-6,-25+bob,3,5,'#668a85');
    rect(-1,-24+bob,8,4,'#27434b'); rect(2,-24+bob,4,2,'#b4ffdf');
    const arm = s.grounded ? Math.round(-gait*2)*Number(moving) : -4;
    rect(3,-17+bob,4,5,'#c5d0b6'); rect(5+arm,-14+bob,3,5,'#839d91'); rect(5+arm,-11+bob,4,3,'#d5cfac');
  }
  if (s.shiftFlash > 0) {
    const r = 3 + s.shiftFlash*42;
    for (let i = 0; i < 6; i++) {
      const angle = i*Math.PI/3+s.time*4;
      rect(Math.cos(angle)*r-1, -10+Math.sin(angle)*r-1, 3, 3, '#c8f2bf');
    }
  }
  if (s.landFlash > 0) {
    const rx = 4 + (.17-s.landFlash)*45;
    rect(-rx, -1, 2, 1, '#a7b7a5'); rect(rx,-2,2,1,'#a7b7a5');
  }
  ctx.restore();
  rect(0, 0, width, 24, '#12202a'); text(room.name.toUpperCase(), 10, 16, color, 10);
  // The map runs west to east. Every entered room lights up on both trips.
  for (const [i, id] of s.mapOrder.entries()) {
    const mx = 329 + i * 13;
    if (i) rect(mx - 5, 11, 5, 2, '#465761');
    rect(mx, 8, 9, 8, id === s.room ? color : s.visited.has(id) ? '#57797a' : '#344651');
    if (id === s.room) rect(mx + 3, 10, 3, 3, '#183039');
  }
}

export default function mount(api) {
  const s = startEscape(), { canvas, ctx } = api.canvas(width, height);
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('role', 'img');
  const keys = new Set(), touches = new Map();
  let tapDirection = 0, tapUntil = 0, lastHud = '', lastMessage = '', lastUse = null;
  function shift() {
    const wasCore = s.core;
    shiftForm(s);
    if (s.core !== wasCore) api.sfx?.(s.core ? 'shift' : 'rebuild');
  }
  function jump() {
    const onGround = s.grounded;
    leap(s);
    if (onGround && !s.grounded) api.sfx?.('jump');
  }
  function walkButton(label, direction) {
    let heldAt = null;
    const button = api.action(label, () => {
      const held = heldAt === null ? 0 : s.time - heldAt;
      heldAt = null;
      tapDirection = direction; tapUntil = s.time + Math.max(0, .16 - held);
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {
      heldAt = s.time; touches.set(event.pointerId, direction);
      button.setPointerCapture(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(name, event => touches.delete(event.pointerId));
  }
  walkButton('← Move', -1); walkButton('Move →', 1);
  api.action('Jump', jump);
  const form = api.action('Shift form', shift);
  const interact = api.action('Use', () => useFixture(s), { primary: true });
  const release = event => keys.delete(event.code);
  const clear = () => { keys.clear(); touches.clear(); tapUntil = 0; };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release); window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
  });
  api.onKey(event => {
    const code = event.code;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
      event.preventDefault(); keys.add(code); return;
    }
    if (!['ArrowUp', 'Space', 'KeyW', 'KeyC', 'KeyE'].includes(code)) return;
    if (code === 'Space' && event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat) return;
    if (code === 'KeyC') shift();
    else if (code === 'KeyE') useFixture(s);
    else jump();
  });
  function render(dir) {
    const hud = s.rooms[s.room].name + ' · ' + s.visited.size + '/7 rooms · ' + (s.core ? 'Rolling core' : 'Walking shell') +
      (s.memory ? ' · Memory recovered' : '');
    if (lastHud !== hud) {
      api.setHud(hud); lastHud = hud;
      form.textContent = s.core ? 'Rebuild shell (C)' : 'Release core (C)';
      canvas.setAttribute('aria-label', hud + '. ' + s.rooms[s.room].hint);
    }
    if (lastMessage !== s.message) { api.setStatus(s.message); lastMessage = s.message; }
    form.disabled = !s.unlocked;
    const use = fixture(s);
    if (use !== lastUse) {
      if (!use && document.activeElement === interact) api.stage.focus({ preventScroll: true });
      interact.disabled = !use;
      interact.textContent = use ? use + ' (E)' : 'Use (E)';
      lastUse = use;
    }
    paint(ctx, s, dir !== 0);
  }
  s.message = 'Move with ←/→ or A/D. Jump with Space or ↑. Follow the amber door east. Cross the striped steam vent after its lamps go dark.';
  render(0);
  api.frame(dt => {
    const { rescues, unlocked, memory } = s;
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const direction = Number(right) - Number(left) || [...touches.values()].at(-1) || (s.time < tapUntil ? tapDirection : 0);
    for (let remaining = dt; remaining > 1e-8;) {
      const h = Math.min(1 / 120, remaining);
      stepEscape(s, h, direction); remaining -= h;
    }
    if (s.rescues > rescues) api.sfx?.('rescue');
    else if (!unlocked && s.unlocked) api.sfx?.('coupling');
    else if (!memory && s.memory) api.sfx?.('memory');
    render(direction);
    if (s.ended) api.finish(s.ended, s.message);
  });
}
