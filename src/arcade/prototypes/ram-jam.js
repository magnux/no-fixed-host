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
const patrols = [
  { dock: [416,214], route: [[389,205],[235,190],[162,147],[118,109],[278,93],[364,128]] },
  { dock: [296,60], route: [[287,65],[348,125],[241,169],[146,129],[174,73]] },
  { dock: [28,70], route: [[177,74],[175,124],[297,158],[333,209],[115,202],[86,127]] },
];
const obstacleSites = [[77,102],[153,119],[210,69],[295,100],[328,135],[407,147],[276,198],[117,188],[217,150],[87,210],[395,194]];
const bodyRadius = 6;

function makeObstacles(random) {
  const sites = [...obstacleSites];
  for (let i = sites.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [sites[i], sites[j]] = [sites[j], sites[i]];
  }
  return sites.slice(0, 5).map(([x,y], i) => ({
    x: x + Math.round((random() - .5)*10), y: y + Math.round((random() - .5)*10),
    radius: 9 + Math.floor(random()*4), kind: ['capacitor','fan','coil'][i%3],
  }));
}

export function startMeadow(random = Math.random) {
  return {
    phase: 'ready', time: 0, player: { ...spawn }, target: null, progress: 0, greeted: 0,
    penalty: 0, grace: 0, twittReady: 0, ring: null, message: '', catches: 0,
    stride: 0, facing: 1, path: null, obstacles: makeObstacles(random),
    drones: patrols.map(({dock,route}, i) => ({
      id:i, x:route[0][0], y:route[0][1], dock:{x:dock[0], y:dock[1]}, route,
      waypoint:1, lure:null, mode:'patrol', battery:1-i*.23,
    })),
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

function pointOutside(point, obstacles) {
  contain(point);
  for (const rock of obstacles) {
    const d=distance(point,rock), radius=bodyRadius+rock.radius;
    if (d >= radius) continue;
    const dx=d ? (point.x-rock.x)/d : 1, dy=d ? (point.y-rock.y)/d : 0;
    point.x=rock.x+dx*radius;
    point.y=rock.y+dy*radius;
  }
  contain(point);
}

function moveGround(s, point, dx, dy) {
  const steps=Math.ceil(Math.hypot(dx,dy)/bodyRadius);
  for(let i=0;i<steps;i++) {
    point.x+=dx/steps; point.y+=dy/steps; pointOutside(point,s.obstacles);
  }
}

function clearSegment(a, b, obstacles) {
  const dx=b.x-a.x, dy=b.y-a.y, squared=dx*dx+dy*dy;
  return obstacles.every(o=>{
    const u=squared ? clamp(((o.x-a.x)*dx+(o.y-a.y)*dy)/squared,0,1) : 0;
    return Math.hypot(a.x+u*dx-o.x, a.y+u*dy-o.y) >= o.radius + bodyRadius - .01;
  });
}

// A tap on the far side of scenery follows the shortest clear path around its rim.
function meadowPath(s, goal) {
  const nodes=[s.player,goal];
  for(const o of s.obstacles) {
    for(let i=0;i<8;i++) {
      const r=(o.radius+bodyRadius+1)/Math.cos(Math.PI/8), angle=i*Math.PI/4;
      const p={x:o.x+Math.cos(angle)*r, y:o.y+Math.sin(angle)*r};
      if(p.x>=15 && p.x<=width-15 && p.y>=54 && p.y<=height-22) nodes.push(p);
    }
  }
  const costs=new Array(nodes.length).fill(Infinity), visited=new Set(), previous=[];
  costs[0]=0;
  while(true) {
    let next=-1, best=Infinity;
    for(let i=0;i<nodes.length;i++) if(!visited.has(i) && costs[i]<best) { next=i;best=costs[i]; }
    if(next<0) return [];
    if(next===1) break;
    visited.add(next);
    for(let i=1;i<nodes.length;i++) {
      if(visited.has(i)) continue;
      const cost=best+distance(nodes[next],nodes[i]);
      if(cost<costs[i] && clearSegment(nodes[next],nodes[i],s.obstacles)) { costs[i]=cost;previous[i]=next; }
    }
  }
  const path=[];
  for(let i=1;i!==0;i=previous[i]) path.unshift(nodes[i]);
  return path;
}

function walkTo(s, destination, speed) {
  const goal={x:destination.x,y:destination.y};pointOutside(goal,s.obstacles);
  let next=goal;
  if(!clearSegment(s.player,goal,s.obstacles)) {
    if(!s.path || distance(s.path.goal,goal)>5 || !s.path.via.length) s.path={goal,via:meadowPath(s,goal)};
    next=s.path.via[0];
    if(!next) return;
    if(distance(s.player,next)<=speed) s.path.via.shift();
  } else s.path=null;
  const length=distance(s.player,next);
  if(length>0) {
    const scale=Math.min(1,speed/length);
    moveGround(s,s.player,(next.x-s.player.x)*scale,(next.y-s.player.y)*scale);
  }
}

function updateDrone(drone, time, dt) {
  const drain=1/20, returnSpeed=53;
  if(drone.mode==='charging') {
    drone.battery=Math.min(1, drone.battery+dt/5.5);
    if(drone.battery===1) drone.mode='patrol';
    return;
  }
  drone.battery=Math.max(0,drone.battery-drain*dt);
  // Leave enough charge to get home from this actual position.
  if(drone.mode==='returning' || drone.battery <= distance(drone,drone.dock)/returnSpeed*drain+.055) {
    drone.mode='returning';drone.lure=null;
    if(steer(drone,drone.dock.x,drone.dock.y,dt*returnSpeed)) drone.mode='charging';
    return;
  }
  if(drone.lure && drone.lure.until>time) steer(drone,drone.lure.x,drone.lure.y,dt*53);
  else {drone.lure=null;patrol(drone,drone.route,dt*30);}
}

export function nearestRam(s) {
  let closest = null;
  for (const ram of s.rams) {
    if (ram.happy || ram.charge > 0) continue;
    if (!closest || distance(s.player, ram) < distance(s.player, closest)) closest = ram;
  }
  return closest;
}

export function twitt(s) {
  if (s.phase !== 'playing' || s.penalty > 0 || s.twittReady > 0) return false;
  s.twittReady = 4;
  s.ring = { ...s.player, time: s.time };
  const nearest = s.drones.filter(d => d.mode === 'patrol').sort((a,b) => distance(s.player,a) - distance(s.player,b))[0];
  if (nearest) nearest.lure = { ...s.player, until: s.time + 3.5 };
  let count = 0;
  for (const ram of s.rams) {
    if (ram.happy || distance(s.player, ram) > 95) continue;
    ram.charge = 0;
    ram.patience = Math.max(ram.patience, 12);
    ram.homeX = ram.x; ram.homeY = ram.y;
    count++;
  }
  s.message = `Twitt! ${count} nearby RAM${count === 1 ? '' : 's'} settled. ${nearest ? 'The closest guard heard you.' : 'All three guards are offline.'}`;
  return true;
}

function scatter(s, ram, dt) {
  moveGround(s, ram, ram.vx * dt * 98, ram.vy * dt * 98);
  for (const other of s.rams) {
    if (other === ram || other.happy || ram.bumped.has(other) || distance(other, ram) > 20) continue;
    ram.bumped.add(other);
    moveGround(s, other, ram.vx * 18, ram.vy * 18);
    other.homeX = other.x; other.homeY = other.y;
  }
  if (!ram.bumped.has(s.player) && !s.penalty && distance(s.player, ram) < 15) {
    ram.bumped.add(s.player);
    moveGround(s, s.player, ram.vx * 32, ram.vy * 32);
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
    pointOutside(ram,s.obstacles);
  }
}

export function stepMeadow(s, dt, input = {}) {
  if (s.phase !== 'playing') return;
  dt = Math.min(dt, 60 - s.time);
  s.time += dt;
  s.twittReady = Math.max(0, s.twittReady - dt);
  s.grace = Math.max(0, s.grace - dt);
  for (const drone of s.drones) updateDrone(drone,s.time,dt);

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
      const before={ ...s.player };
      if (length) {
        s.path=null;
        moveGround(s,s.player,dt * 91 * dx / length,dt * 91 * dy / length);
      } else if (input.destination) {
        walkTo(s,input.destination,dt*91);
      }
      s.stride+=distance(before,s.player)*.17;
      if(Math.abs(s.player.x-before.x)>.1) s.facing=Math.sign(s.player.x-before.x);
    }
    if (!s.grace && s.drones.some(d => d.mode === 'patrol' && distance(s.player,d)<13)) {
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

function landscape(ctx,s) {
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
  for(const d of s.drones) {
    const {x,y}=d.dock;
    polygon([[x-12,y],[x-6,y-6],[x+8,y-6],[x+13,y],[x+7,y+5],[x-7,y+5]],'#38525a');
    rect(x-8,y-1,16,2,'#8abbab');rect(x-3,y-3,2,2,'#c5d9bd');rect(x+1,y-3,2,2,'#c5d9bd');
  }
  rect(bin.x - 9, bin.y - 15, 17, 16, '#31585b'); rect(bin.x - 11, bin.y - 17, 21, 3, '#bddbd3');
  for (let i = -5; i <= 5; i += 5) rect(bin.x + i, bin.y - 11, 2, 8, '#9cbeb4');
  rect(0, 238, width, 15, '#243941'); rect(0, 238, width, 1, '#94baac');
  ctx.font = '8px monospace'; ctx.fillStyle = '#c5dbc7'; ctx.fillText('▣  MEADOW.SCR', 7, 249);
  ctx.textAlign = 'right'; ctx.fillText('FLOCK SERVICE  •', 437, 249); ctx.textAlign = 'left';
}

function rect(ctx,x,y,w,h,color) { ctx.fillStyle=color;ctx.fillRect(x,y,w,h); }
function shape(ctx,points,color) {
  ctx.beginPath();for(const [x,y] of points) ctx.lineTo(x,y);
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function shadow(ctx,x,y,r) {
  ctx.fillStyle='#2f6559';ctx.beginPath();ctx.ellipse(x,y,r,r*.35,0,0,Math.PI*2);ctx.fill();
}

function scrap(ctx,o,t) {
  const r=o.radius;
  ctx.save();ctx.translate(o.x,o.y);shadow(ctx,0,0,r+2);
  if(o.kind==='capacitor') {
    for(const [x,y] of [[-4,-2],[4,2]]) {
      rect(ctx,x-4,y-13,8,14,'#345963');rect(ctx,x-3,y-12,2,12,'#75959c');
      rect(ctx,x-4,y-14,8,3,'#bed3bc');rect(ctx,x,y-14,1,3,'#688481');
      rect(ctx,x-3,y-2,6,2,'#263c45');
    }
  } else if(o.kind==='coil') {
    rect(ctx,-r+2,-12,2*r-4,13,'#403649');
    for(let i=0;i<4;i++) {
      const x=-r+2+i*4;rect(ctx,x,-14,3,15,'#b46f5c');rect(ctx,x,-14,3,3,'#efb394');rect(ctx,x,-2,3,3,'#83514e');
    }
    rect(ctx,-r,-2,3,3,'#b8b4a3');rect(ctx,r-2,-2,3,3,'#b8b4a3');
  } else {
    rect(ctx,-r,-r*1.6,r*2,r*1.8,'#283c49');rect(ctx,-r+2,-r*1.6+2,r*2-4,r*1.8-4,'#618482');
    ctx.save();ctx.translate(0,-r*.68);ctx.rotate(t*4+o.x);
    for(let i=0;i<4;i++) {ctx.rotate(Math.PI/2);shape(ctx,[[0,0],[-2,-r*.65],[2,-r*.8],[4,-r*.55]],'#bbd0ab');}
    ctx.restore();rect(ctx,-2,-r*.68-2,4,4,'#344451');
  }
  ctx.restore();
}

function droneSprite(ctx,d,t) {
  const active=d.mode==='patrol', docked=d.mode==='charging';
  const color=active?'#ffc488':docked?'#8ae2ae':'#9fdbfc';
  ctx.save();ctx.translate(d.x,d.y);
  shadow(ctx,0,1,docked?7:11);
  if(active) {
    const sweep=Math.sin(t*3+d.id)*3;
    ctx.save();ctx.globalAlpha=.28;shape(ctx,[[-3,-10],[4,-10],[sweep+10,3],[sweep-10,3]],'#ffbd88');ctx.restore();
  }
  ctx.translate(0,docked?-3:-9-Math.sin(t*6+d.id)*1.3);
  const span=docked?4:3.3+Math.abs(Math.sin(t*40+d.id))*4;
  for(const dx of [-10,10]) {
    rect(ctx,dx-1,-5,2,6,'#344453');rect(ctx,dx-span,-6,span*2,2,'#dfede3');
  }
  shape(ctx,[[-10,-1],[-6,-6],[6,-6],[10,-1],[7,4],[-7,4]],'#393d51');
  rect(ctx,-6,-5,12,3,'#acb0b4');rect(ctx,-4,-1,8,3,color);
  rect(ctx,-5,3,2,2,'#d1ced2');rect(ctx,3,3,2,2,'#d1ced2');
  rect(ctx,-9,-14,16,4,'#233842');rect(ctx,-8,-13,Math.ceil(14*d.battery),2,color);
  if(d.lure) {ctx.fillStyle='#fff6c1';ctx.font='bold 9px monospace';ctx.fillText('♪',9,-9);}
  if(docked) {
    const pulse=(t*10)%8;
    rect(ctx,-9+pulse,6,3,1,'#bdffd9');rect(ctx,5-pulse,7,3,1,'#bdffd9');
  }
  ctx.restore();
}

function ramSprite(ctx,ram,s,jensen=false) {
  const stamp=!jensen && !ram.happy && ram.patience<=4;
  const angle=jensen?s.stride:s.time*(ram.charge?18:stamp?10:2)+ram.gait;
  const hop=Math.round(Math.abs(Math.sin(angle))*(jensen?1.7:ram.charge?3:1));
  ctx.save();ctx.translate(Math.round(ram.x),Math.round(ram.y));shadow(ctx,0,2,15);
  ctx.scale(jensen?s.facing:ram.charge && ram.vx<0?-1:1,1);
  for(const [x,dir] of [[-9,-1],[4,1]]) {
    const stride=Math.round(Math.sin(angle)*dir*(jensen||ram.charge?2:1));
    rect(ctx,x+stride,-3,3,6-hop,'#384251');rect(ctx,x+stride-1,2-hop,4,2,'#d8ceb4');
  }
  ctx.translate(0,-hop);
  // The scalloped contacts, black ICs and key notch form a miniature DIMM.
  shape(ctx,[[-16,-13],[-14,-15],[5,-15],[7,-13],[7,-3],[-1,-3],[-1,-5],[-3,-5],[-3,-3],[-16,-3]],'#23483e');
  rect(ctx,-15,-13,21,8,'#58a774');rect(ctx,-14,-14,17,1,'#94d38e');
  for(let x=-14;x<=4;x+=3) if(x!==-2) rect(ctx,x,-4,2,2,'#f0c477');
  for(const x of [-13,-7,-1]) {rect(ctx,x,-12,4,6,'#284148');rect(ctx,x+1,-11,2,1,'#657674');}
  if(jensen) {
    shape(ctx,[[-15,-14],[-10,-16],[-6,-12],[-1,-15],[4,-13],[4,-5],[-14,-5]],'#20222e');
    shape(ctx,[[-10,-15],[-7,-12],[-10,-8],[-14,-13]],'#444759');
    shape(ctx,[[-3,-15],[-6,-12],[-5,-9],[1,-13]],'#62636e');
    rect(ctx,-7,-10,1,5,'#d7d7cf');rect(ctx,-12,-8,3,1,'#9897a1');
    rect(ctx,-16,-11,4,6,'#31303e');rect(ctx,-15,-6,3,2,'#c5b4a7');
  }
  // Curled horns and an expressive muzzle distinguish these from loose memory cards.
  rect(ctx,3,-15,12,10,'#d9d2bd');rect(ctx,6,-13,11,6,'#444d53');rect(ctx,12,-9,6,4,'#bac5b9');
  rect(ctx,4,-18,6,5,'#8b745e');rect(ctx,4,-19,5,2,'#f2d295');rect(ctx,3,-17,2,4,'#e2ba82');rect(ctx,5,-15,2,2,'#edcd98');
  rect(ctx,12,-17,4,3,'#d3b381');
  if(ram.happy || (jensen && s.target)) {
    rect(ctx,8,-12,3,1,'#b7f5bd');rect(ctx,7,-11,1,1,'#b7f5bd');
  } else {
    rect(ctx,9,-12,2,2,stamp?'#ffae86':'#d7f8d3');
  }
  rect(ctx,16,-8,2,1,'#3c464b');
  if(stamp && s.target!==ram) {ctx.fillStyle='#fff1ae';ctx.font='bold 12px monospace';ctx.fillText('!',7,-23);}
  if(ram.happy) {rect(ctx,-14,-17,3,1,'#c2ffd6');rect(ctx,-12,-18,2,1,'#c2ffd6');}
  ctx.restore();
  if(jensen) {
    const y=ram.y-27+Math.sin(s.time*4)*1.1;
    shape(ctx,[[ram.x-3,y-2],[ram.x+3,y-2],[ram.x,y+2]],'#fff4bd');
    ctx.textAlign='center';ctx.font='bold 7px monospace';ctx.fillStyle='#f9f4d7';ctx.fillText('JENSEN',ram.x,y-4);ctx.textAlign='left';
  }
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
  const actors = [
    ...s.obstacles.map(o => ({y:o.y, draw:()=>scrap(ctx,o,t)})),
    ...s.rams.map(ram => ({y:ram.y, draw:()=>ramSprite(ctx,ram,s)})),
    ...s.drones.map(d => ({y:d.y+3, draw:()=>droneSprite(ctx,d,t)})),
  ];
  if(s.penalty) {
    rect(ctx,s.player.x-9,s.player.y-15,18,11,'#2a2937');
    ctx.fillStyle='#ffd7bc';ctx.font='bold 9px monospace';ctx.fillText(Math.ceil(s.penalty)+'s',s.player.x-5,s.player.y-6);
  } else if(!s.grace || Math.floor(t*8)%2===0) {
    actors.push({y:s.player.y,draw:()=>ramSprite(ctx,s.player,s,true)});
  }
  actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.draw());
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
  canvas.setAttribute('aria-label', 'Jensen wears a black leather jacket. Befriend six memory-stick sheep around the scrap obstacles. Three guard drones change from amber patrol lights to blue return lights and green charging lights.');
  const background = document.createElement('canvas');
  background.width = width; background.height = height;
  landscape(background.getContext('2d'),s);
  const keys = new Set();
  let destination, syncingPointer, toggleSync = false;
  const clear = () => { keys.clear(); syncingPointer = null; toggleSync = false; destination = null; };

  function begin() {
    if (s.phase !== 'ready') return;
    s.phase = 'playing';
    start.hidden = true; sync.disabled = false; whistle.disabled = false;
    api.stage.focus({ preventScroll: true });
    s.message = 'Jensen, meet Dot. Hold Space or Hold to sync for two seconds. Let go to flee.';
    refresh();
  }
  function callFlock() {
    if (!twitt(s)) return;
    api.sfx?.('chirp');
    refresh();
  }
  const start = api.action('Start meadow', begin, { primary: true });
  const sync = api.action('Hold to sync', event => {
    // Assistive technology and Enter can activate once to hold, and again to release.
    if (event.detail === 0) toggleSync = !toggleSync;
  }, { primary: true });
  const whistle = api.action('Twitt (C)', callFlock);
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
    // Resolve taps on the body to the RAM’s moving position.
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
    api.setHud(`${Math.ceil(60-s.time)}s · ${s.greeted}/6 greeted · ${hint} · ${s.drones.filter(d => d.mode === 'patrol').length}/3 guards patrolling`);
    if (s.message) { api.setStatus(s.message); s.message = ''; }
    sync.setAttribute('aria-pressed', String(Boolean(s.target)));
    whistle.disabled = s.phase !== 'playing' || s.penalty > 0 || s.twittReady > 0;
    whistle.textContent = s.twittReady ? `Twitt in ${Math.ceil(s.twittReady)}s` : 'Twitt (C)';
    paint(ctx, background, s, destination);
  }
  api.setStatus('Move Jensen with WASD, arrows or a tap. Hold Space beside a RAM for two seconds. Twitt (C) calms the flock and attracts a guard. Pass drones safely while they return or recharge.');
  refresh();
  api.frame(dt => {
    if (s.phase !== 'playing') return;
    let x = 0, y = 0;
    for (const key of keys) {
      const dir = directions[key];
      if (dir) { x += dir[0]; y += dir[1]; }
    }
    const before = s.greeted;
    const catches = s.catches;
    stepMeadow(s, dt, { x, y, destination, sync: toggleSync || syncingPointer != null || keys.has('Space') });
    if (s.penalty) clear();
    if (s.catches > catches) api.sfx?.('caught');
    if (before !== s.greeted) {
      if (s.phase === 'playing') api.sfx?.('greet');
      toggleSync = false;
      destination = null;
    }
    refresh();
    if (s.phase === 'complete') api.finish('complete', `All six RAMs are wearing your smile. The flock synced in ${Math.ceil(s.time)} seconds. ^-^`);
    else if (s.phase === 'partial') api.finish('partial', `The monitor sleeps. ${s.greeted} of six RAMs carry your greeting into standby.`);
    else if (s.phase === 'failed') api.finish('failed', 'The monitor sleeps. The meadow is still waiting for its first greeting.');
  });
}
