// Beat offsets are relative to each eight-beat weather front at 120 BPM.
const fronts = [
  { name: 'Marine layer', notes: [[0,'A'],[1,'S'],[2,'D'],[3,'F'],[4,'AS'],[5.5,'D'],[7,'DF']] },
  { name: 'Crosswind', notes: [[0,'AF'],[1,'S'],[1.5,'D'],[3,'SF'],[4,'AD'],[5,'F'],[5.5,'S'],[7,'DF']] },
  { name: 'Squall line', notes: [[0,'AS'],[.5,'D'],[1.5,'F'],[2,'SD'],[3.5,'A'],[4,'DF'],[5,'S'],[5.5,'F'],[6.5,'AD'],[7.5,'S']] },
  { name: 'Electrical storm', notes: [[0,'ADF'],[1,'S'],[1.5,'D'],[2.5,'AF'],[3,'SD'],[4,'ASF'],[5,'D'],[5.5,'S'],[6,'AD'],[7,'SDF']] },
];
const keys = 'ASDF';
const bands = ['Wind', 'Rain', 'Cloud', 'Bolt'];
const colors = ['#72efbe','#82d9ff','#ffd985','#ed9ddd'];
const pitches = [293.66, 369.99, 440, 554.37];
const beat = 0.5, leadIn = 4 * beat;
const hitWindow = .115, chordSpread = .075, settle = .035;
const width = 560, height = 310, horizon = 70, receptor = 252;
export const broadcastEnd = leadIn + 32 * beat + .3;
export const broadcastChart = fronts.flatMap((front, section) => front.notes.map(([offset, chord]) => ({
  time: leadIn + (8 * section + offset) * beat,
  lanes: [...chord].map(symbol => keys.indexOf(symbol)),
})));

export function newBroadcast() {
  return { running: false, time: 0, cursor: 0, held: new Set(), attempt: null, hits: 0,
    perfect: 0, combo: 0, best: 0, noise: 0, misses: 0, flash: null };
}

function judge(state, text, note, hit = false, perfect = false) {
  state.flash = { text, time: state.time, lanes: note?.lanes ?? [], hit };
  if (hit) {
    state.hits++;
    if (perfect) state.perfect++;
    state.combo++;
    state.best = Math.max(state.best, state.combo);
  } else {
    state.combo = 0;
    state.misses++;
  }
  state.attempt = null;
  state.cursor++;
}

export function advanceBroadcast(state, dt) {
  if (!state.running) return;
  state.time = Math.min(broadcastEnd, state.time + dt);
  while (state.cursor < broadcastChart.length) {
    const note = broadcastChart[state.cursor], attempt = state.attempt;
    if (attempt?.complete != null && state.time >= attempt.complete + settle) {
      const perfect = attempt.error <= .055;
      judge(state, perfect ? 'Perfect' : 'On air', note, true, perfect);
    } else if (state.time > note.time + hitWindow && attempt?.complete == null) {
      judge(state, attempt ? 'Split chord' : 'Miss', note);
    } else break;
  }
}

export function pressBand(state, lane) {
  if (!state.running || state.held.has(lane)) return;
  state.held.add(lane);
  if (state.time < leadIn - hitWindow || state.cursor >= broadcastChart.length) return;
  const note = broadcastChart[state.cursor], offset = Math.abs(note.time - state.time);
  if (offset > hitWindow && state.attempt?.complete == null) {
    state.noise++;
    state.combo = 0;
    state.flash = { text: 'Static', time: state.time, lanes: [lane], hit: false };
    return;
  }
  const attempt = state.attempt ??= { first: state.time, pressed: new Set(), error: 0, complete: null };
  if (!note.lanes.includes(lane) || state.time - attempt.first > chordSpread || attempt.pressed.has(lane)) {
    judge(state, 'Crossed signal', note);
    return;
  }
  attempt.pressed.add(lane);
  attempt.error = Math.max(attempt.error, offset);
  if (attempt.pressed.size === note.lanes.length) {
    if (!note.lanes.every(band => state.held.has(band))) { judge(state, 'Split chord', note); return; }
    attempt.complete = state.time;
  }
}

export function releaseBand(state, lane) {
  state.held.delete(lane);
}

export function reception(state) {
  const accuracy = Math.max(0, (state.hits - .5 * state.noise) / broadcastChart.length);
  return accuracy >= .8 ? 'complete' : accuracy >= .4 ? 'partial' : 'failed';
}

function path(ctx, points, color, width = 1, fill = false) {
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  if (fill) { ctx.closePath(); ctx.fillStyle=color; ctx.fill(); }
  else { ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke(); }
}
function label(ctx, text, x, y, size, color, align = 'left') {
  ctx.textAlign=align; ctx.fillStyle=color; ctx.font='bold '+size+'px ui-monospace,monospace';
  ctx.fillText(text,x,y);
}
function laneX(lane, y) {
  const span = 15 + (y-horizon)/(receptor-horizon)*98;
  return width/2 + (lane-1.5)*span;
}
function symbol(ctx, lane, x, y, radius, color) {
  // The square, diamond, triangle and circle keep every lane legible in monochrome.
  ctx.fillStyle=color;
  if (lane === 0) ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  if (lane === 1) path(ctx,[[x,y-radius*1.2],[x+radius,y],[x,y+radius*1.2],[x-radius,y]],color,1,true);
  if (lane === 2) path(ctx,[[x,y-radius*1.2],[x+radius*1.2,y+radius],[x-radius*1.2,y+radius]],color,1,true);
  if (lane === 3) { ctx.beginPath();ctx.arc(x,y,radius,0,2*Math.PI);ctx.fill(); }
}
function drawStation(ctx, s) {
  const t = s.time, section = Math.min(3, Math.max(0, Math.floor((t-leadIn)/4)));
  const sky = ctx.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,'#121c37'); sky.addColorStop(.43,'#365363'); sky.addColorStop(.44,'#122931'); sky.addColorStop(1,'#0e1726');
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  if (section <= 1) {
    // Low fog lifts into ribbons of fast, curling wind as the front moves inland.
    for (let i = 0; i < 10; i++) {
      const x = (i * 73 + t * (section ? 31 : 9)) % (width + 60) - 45;
      const y = 48 + (i * 29) % 67;
      ctx.strokeStyle = section ? '#718897' : '#506472';
      ctx.lineWidth = section ? 1 : 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x+13,y-4,x+24,y+2,x+37,y-2);
      if (section && i % 3 === 0) ctx.bezierCurveTo(x+49,y-6,x+40,y-16,x+36,y-9);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 56; i++) {
      const x = (i*103 + t*(section+1)*13) % width;
      const y = 11 + (i*67+t*(section+1)*44)%114;
      path(ctx, [[x,y],[x-3-section,y+6+section]], '#527380');
    }
    if (section === 3) {
      // A distant fork fades slowly behind the ridge, once per measure.
      const age = (t - leadIn) % (4 * beat);
      if (age < .45) {
        const x = Math.floor(t / (4 * beat)) % 2 ? 94 : 410;
        ctx.save();ctx.globalAlpha = .6 * (1 - age / .45);
        path(ctx, [[x,0],[x-9,15],[x-4,19],[x-15,36],[x-10,34],[x-20,53]], '#b7ceeb', 2);
        path(ctx, [[x-4,19],[x+7,27],[x+3,31],[x+11,37]], '#99b3d0');
        ctx.restore();
      }
    }
  }
  const ridge=[[0,111],[49,93],[88,110],[135,77],[190,104],[247,86],[308,103],[352,81],[387,93],[454,65],[515,98],[560,88],[560,145],[0,145]];
  path(ctx,ridge,'#182d39',1,true);
  // Broadcast mast, antenna rings and a signal lamp above the ridge.
  const mast=455;
  path(ctx,[[mast-9,82],[mast,39],[mast+9,82],[mast-9,82],[mast+6,66],[mast-4,59],[mast+2,52]],'#a8c2bc',1.4);
  for(let i=0;i<3;i++) {
    const r=5+(i*7+t*13)%21;
    ctx.strokeStyle='#90cfbc'; ctx.lineWidth=1;
    for(const a of [0,Math.PI]) {ctx.beginPath();ctx.arc(mast,39,r,a-.68,a+.68);ctx.stroke();}
  }
  for(let i=0;i<4;i++) path(ctx,[[laneX(i-.5,horizon),horizon],[laneX(i+.5,horizon),horizon],
    [laneX(i+.5,height),height],[laneX(i-.5,height),height]],i%2?'#1a2838':'#192f39',1,true);
  for(let i=0;i<=4;i++) path(ctx,[[laneX(i-.5,horizon),horizon],[laneX(i-.5,height),height]],'#45606a',1.4);
  const lookAhead=2.25;
  const project=until => horizon + (receptor-horizon)*(1-until/lookAhead)**1.55;
  for(let n=Math.ceil((t-.48)/beat);n<=(t+lookAhead)/beat;n++) {
    const y=project(n*beat-t);
    path(ctx,[[laneX(-.5,y),y],[laneX(3.5,y),y]],n%4?'#364855':'#55716e',n%4?1:2);
  }
  path(ctx,[[laneX(-.5,receptor),receptor],[laneX(3.5,receptor),receptor]],'#9abbc2',2);
  const flash=s.flash, age=flash?t-flash.time:Infinity;
  for(let i=0;i<4;i++) {
    const x=laneX(i,receptor);
    const lit=s.held.has(i) || (flash?.hit && age<.16 && flash.lanes.includes(i));
    ctx.fillStyle=lit?colors[i]:'#263849';ctx.strokeStyle=colors[i];ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x-24,receptor-7,48,14,5);ctx.fill();ctx.stroke();
    label(ctx,keys[i],x,287,18,colors[i],'center');
    label(ctx,bands[i],x,301,10,'#b8ccd1','center');
  }
  for(let i=broadcastChart.length-1;i>=s.cursor;i--) {
    const note=broadcastChart[i], until=note.time-t;
    if(until>lookAhead || until<-.21) continue;
    const y=project(until), r=3+(y-horizon)/(receptor-horizon)*7;
    const xs=note.lanes.map(lane=>laneX(lane,y));
    if(xs.length>1) path(ctx,[[xs[0],y],[xs.at(-1),y]],'#e0d9c2',2+r*.18);
    note.lanes.forEach((lane,index)=>{
      const x=xs[index];ctx.fillStyle=colors[lane];ctx.strokeStyle='#0c1b24';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.roundRect(x-r*2,y-r*.8,4*r,1.6*r,r*.55);ctx.fill();ctx.stroke();
      symbol(ctx,lane,x,y,r*.48,'#1d2c36');
    });
  }
  ctx.fillStyle='#152534';ctx.fillRect(12,10,180,44);
  label(ctx,'NORTH RELAY   FM 88.6',21,25,11,'#8fd4c2');
  label(ctx,fronts[section].name,21,44,17,'#eef1dc');
  if(!s.running || t<leadIn-.15) label(ctx,s.running?String(Math.ceil((leadIn-t)/beat)):'STAND BY',width/2,151,24,'#fff2c1','center');
  else if(flash && age<.45) {
    ctx.save();ctx.globalAlpha=Math.min(1,(.45-age)*8);
    label(ctx,flash.text,width/2,54-age*10,18,flash.hit?'#a9f9ca':'#ffc4b2','center');ctx.restore();
    if(flash.hit && age<.28) for(const lane of flash.lanes) {
      const x=laneX(lane,receptor);ctx.save();ctx.globalAlpha=1-age/.28;
      for(let p=0;p<6;p++) {
        const angle=Math.PI*(1.06+p*.17);
        path(ctx,[[x+Math.cos(angle)*(11+age*78),receptor+Math.sin(angle)*(11+age*78)],
          [x+Math.cos(angle)*(17+age*85),receptor+Math.sin(angle)*(17+age*85)]],colors[lane],2);
      }ctx.restore();
    }
  }
}

export default function mount(api) {
  const s=newBroadcast(), {canvas,ctx}=api.canvas(width,height), radio=api.radio;
  canvas.setAttribute('aria-label','Four incoming weather bands. Play A, S, D, F at the strike line. A horizontal bridge joins notes in a chord.');
  canvas.style.touchAction='none';
  function hud() {
    api.setHud('120 BPM · '+s.hits+'/'+broadcastChart.length+' signals · Combo '+s.combo+' · Best '+s.best);
  }
  function startRound() {
    if(s.running) return;
    s.running=true;api.setMusicMode?.('rhythm'); api.sfx?.('tune');
    if(radio?.enabled) radio.setEnabled(true);
    start.disabled=true;pads.forEach(pad=>pad.disabled=false);
    api.stage.focus({preventScroll:true});
    api.setStatus('Four beats in. Play each shape at the line. Strike bridged notes together.');
  }
  const start=api.action('Tune in', startRound, {primary:true});
  const sources=new Map();
  function down(id,lane) {
    if(!s.running || sources.has(id)) return;
    sources.set(id,lane);
    pressBand(s,lane);
    radio?.tone(pitches[lane],.11,.36,'triangle');
    pads[lane].setAttribute('aria-pressed','true');
    hud();
  }
  function up(id) {
    if(!sources.has(id)) return;
    const lane=sources.get(id);sources.delete(id);
    if(![...sources.values()].includes(lane)) {releaseBand(s,lane);pads[lane].setAttribute('aria-pressed','false');}
  }
  function bindPad(surface, selectLane) {
    surface.addEventListener('pointerdown',e=>{
      if(!s.running || e.button!==0) return;
      const lane=selectLane(e);
      if(lane<0 || lane>3) return;
      e.preventDefault();surface.setPointerCapture(e.pointerId);
      down(e.pointerId,lane);
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture']) surface.addEventListener(name,e=>up(e.pointerId));
  }
  const pads=bands.map((band,lane)=>{
    const pad=api.action(keys[lane]+' · '+band,e=>{
      if(e.detail!==0) return;
      down('action'+lane,lane);up('action'+lane);
    });
    pad.disabled=true;pad.style.touchAction='none';pad.style.borderColor=colors[lane];pad.setAttribute('aria-pressed','false');
    bindPad(pad,()=>lane);return pad;
  });
  bindPad(canvas,e=>{
    const bounds=canvas.getBoundingClientRect();
    const x=(e.clientX-bounds.left)*width/bounds.width;
    const y=(e.clientY-bounds.top)*height/bounds.height;
    if(y<horizon) return -1;
    const span=laneX(1,y)-laneX(0,y);
    return Math.floor((x-laneX(-.5,y))/span);
  });
  const mute=api.action('Radio sound',()=>{radio?.setEnabled(!radio.enabled);labelSound();api.stage.focus({preventScroll:true});});
  function labelSound() {
    mute.textContent=radio?.enabled?'Mute radio':'Enable radio sound';
    mute.setAttribute('aria-pressed',String(Boolean(radio?.enabled)));mute.disabled=!radio;
  }
  api.onKey(e=>{
    const lane=['KeyA','KeyS','KeyD','KeyF'].indexOf(e.code);
    if(lane<0 || !s.running) return;
    e.preventDefault();
    if(!e.repeat) down(e.code,lane);
  });
  const release=e=>up(e.code), clear=()=>{for(const id of [...sources.keys()]) up(id);};
  window.addEventListener('keyup',release);window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',clear);
  api.onCleanup(()=>{window.removeEventListener('keyup',release);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);});
  labelSound();hud();drawStation(ctx,s);
  api.setStatus('A / S / D / F or four touch pads. Notes joined by a bar form a chord. Strike them together when they meet the line.');
  let lastBeat=-1, lastSection=-1;
  api.frame(dt=>{
    if(!s.running) return;
    advanceBroadcast(s,dt);
    const n=Math.floor(s.time/beat), section=Math.floor((s.time-leadIn)/4);
    if(n!==lastBeat) {radio?.tone(n<4?420:n%4?180:270,.05,n<4?.38:.2,'sine');lastBeat=n;}
    if(section>=0 && section<4 && section!==lastSection) {
      lastSection=section;api.setStatus(fronts[section].name+' on air. '+(section===3?'Three-band chords approaching.':'Watch for linked notes.'));
    }
    hud();drawStation(ctx,s);
    if(s.time>=broadcastEnd) {
      const outcome=reception(s);
      const ending={complete:'The coast station answers your call.',partial:'The coast station caught fragments of your message.',failed:'Static swallowed the broadcast.'};
      api.finish(outcome,s.hits+' of '+broadcastChart.length+' signals · '+s.perfect+' perfect · Best combo '+s.best+'. '+ending[outcome]);
    }
  });
}
