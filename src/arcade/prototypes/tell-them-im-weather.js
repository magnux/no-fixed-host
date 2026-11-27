// A forecast plays once on the dial. On the repeat the player transmits in its rests.
const forecasts = [
  { name: 'Coastal fog', north: '10101010', rival: '00000000' },
  { name: 'Falling pressure', north: '11001010', rival: '00000000' },
  { name: 'Crosswind', north: '10011010', rival: '01001001' },
  { name: 'Clearing overnight', north: '10110010', rival: '01010101' },
];
const pitches = [392, 494, 440, 523, 392, 587, 494, 440];
const countIn = 4;
const bar = 8;
const secondsPerBeat = 0.5;
const end = countIn + forecasts.length * bar * 2;

export function newBroadcast() {
  return { running: false, beat: 0, hits: new Set(), errors: new Set() };
}

export function dialAt(beat) {
  if (beat < countIn) return { phase: 'count', round: 0, column: Math.floor(beat) };
  if (beat >= end) return { phase: 'end', round: forecasts.length - 1, column: bar - 1 };
  const position = Math.floor(beat) - countIn;
  return { phase: position % (bar * 2) < bar ? 'listen' : 'reply',
    round: Math.floor(position / (bar * 2)), column: position % bar };
}

export function sendPulse(state) {
  const { phase, round, column } = dialAt(state.beat);
  if (!state.running || phase !== 'reply') return 'Listen';
  const slot = round * bar + column;
  if (state.hits.has(slot)) return 'Received';
  const distance = Math.abs(state.beat % 1 - 0.5);
  if (forecasts[round].north[column] === '1' || distance > 0.33) {
    state.errors.add(slot);
    return distance > 0.33 ? 'Off beat' : 'Over the forecast';
  }
  state.hits.add(slot);
  return 'Received';
}

export function reception(state) {
  const possible = forecasts.reduce((n, f) => n + [...f.north].filter(note => note === '0').length, 0);
  const net = state.hits.size - state.errors.size;
  const outcome = net >= possible * 0.8 ? 'complete' : net >= possible * 0.4 ? 'partial' : 'failed';
  return { possible, outcome };
}

function drawDial(ctx, state) {
  const { round, column, phase } = dialAt(state.beat);
  const f = forecasts[round];
  const elapsed = state.running ? state.beat : 0;
  const ink = '#123039', sky = '#d6e6d4', mint = '#8de5cb', peach = '#ffc097';
  const line = (points, color, width = 1) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  const type = (text, x, y, color, size, weight = 600) => {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px ui-monospace, monospace'; ctx.fillText(text, x, y);
  };
  ctx.fillStyle = ink; ctx.fillRect(0, 0, 512, 310);
  ctx.fillStyle = sky; ctx.fillRect(8, 8, 496, 119);
  ctx.save(); ctx.beginPath(); ctx.rect(8, 8, 496, 119); ctx.clip();
  for (let ridge = 0; ridge < 6; ridge++) {
    const points = [];
    for (let x = -4; x < 528; x += 4) {
      const y = 85 + ridge * 10 + 11 * Math.sin(x / 55 + ridge * .54) + 4 * Math.cos(x / 22 + ridge);
      points.push([x, y]);
    }
    line(points, '#8ab2a6');
  }
  const towerX = 406;
  line([[towerX-17,123],[towerX,36],[towerX+17,123],[towerX-17,123]], ink, 3);
  for (let y = 58; y < 120; y+=13) {
    const span=(y-36)/5;
    line([[towerX-span,y],[towerX+span,y+10],[towerX-span-2,y+10],[towerX+span,y]], ink, 1.5);
  }
  for (let n=0; n<3; n++) {
    const r = 8 + n*10 + (elapsed%1)*5;
    ctx.strokeStyle = '#6b9488'; ctx.lineWidth = 1.5;
    for (const side of [0,Math.PI]) {
      ctx.beginPath();ctx.arc(towerX,36,r,side-.63,side+.63);ctx.stroke();
    }
  }
  ctx.restore();
  type('NORTH RELAY  /  FM 88.6',22,32,ink,15);
  type(f.name,22,64,ink,24,700);
  const label = !state.running ? 'OFF AIR' : {count:'COUNT IN', listen:'LISTEN', reply:'YOUR REPLY', end:'SIGNAL LOGGED'}[phase];
  type(label,19,155,phase==='reply'?peach:mint,18);
  type('120 BPM',418,155,sky,14);
  const x0=74,step=52;
  for (const [i, value] of [...f.north].entries()) {
    const x=x0+i*step;
    const slot=round*bar+i;
    const selected = state.running && phase!=='count' && phase!=='end' && column===i;
    const revealed = !state.running || phase==='reply' || phase==='end' || (phase==='listen' && i<=column);
    ctx.fillStyle=selected?'#385c60':'#1b3d45';ctx.fillRect(x-22,170,44,113);
    type(String(i+1),x-4,188,selected?'#ffffff':'#adc7bd',13);
    if (revealed) {
      if (value==='1') {
        line([[x-12,216],[x-5,216],[x-2,205],[x+2,225],[x+6,213],[x+12,213]],mint,3);
      } else {
        ctx.strokeStyle=peach;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,215,7,0,Math.PI*2);ctx.stroke();
      }
      if (f.rival[i]==='1') line([[x-10,244],[x-4,234],[x+2,246],[x+8,236]],'#e6aadc',2);
    }
    if (state.hits.has(slot)) line([[x-8,267],[x-2,272],[x+9,259]],mint,3);
    else if (state.errors.has(slot)) type('×',x-5,273,peach,18);
  }
  type('FM',16,219,mint,14); type('DX',16,246,'#e6aadc',14); type('YOU',16,271,peach,14);
  if (state.running && (phase==='listen' || phase==='reply')) {
    const cursor=x0+(column+(elapsed%1)-.5)*step;
    line([[cursor,169],[cursor,282]],'#fff1c8',1.6);
  }
  type('FM wave = listen     ○ = tap on the reply',16,302,sky,14);
}

export default function mount(api) {
  const state = newBroadcast();
  const { canvas, ctx } = api.canvas(512,310);
  const radio = api.radio;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Weather receiver. The FM row shows spoken beats as waves and silent beats as rings. A line sweeps across each beat.');
  let previousPhase = '';
  let sounded = -1;
  const start = api.action('Tune in', () => {
    if (state.running) return;
    state.running = true;
    start.disabled = true; tap.disabled = false;
    if (radio?.enabled) radio.setEnabled(true);
    api.stage.focus();
  }, {primary:true});
  function transmit() {
    if (!state.running) return;
    const message = sendPulse(state);
    if (message === 'Listen') return;
    api.setStatus(message === 'Received' ? 'Pulse received.' : message + '. Aim for the centre of an open FM ring.');
    radio?.tone(message==='Received' ? 740 : 128,.09,.36,'sine');
    showHud();
  }
  const tap = api.action('Transmit · Space', e => { if (e.detail === 0) transmit(); });
  tap.disabled = true;
  // Score the press edge on touch instead of waiting for the finger to lift.
  tap.addEventListener('pointerdown', e => { if (e.button===0 && !tap.disabled) transmit(); });
  canvas.addEventListener('pointerdown', e => { if (e.button===0) transmit(); });
  const audioButton = api.action('Radio sound', () => { radio?.setEnabled(!radio.enabled); labelSound(); api.stage.focus({preventScroll:true}); });
  function labelSound() {
    audioButton.textContent = radio?.enabled ? 'Mute radio' : 'Enable radio sound';
    audioButton.setAttribute('aria-pressed', String(Boolean(radio?.enabled)));
    audioButton.disabled = !radio;
  }
  labelSound();
  api.onKey(e => {
    if (e.code !== 'Space' || (e.target.closest?.('button') && e.target !== tap)) return;
    e.preventDefault(); if (!e.repeat) transmit();
  });
  function showHud() {
    const {round}=dialAt(state.beat);
    api.setHud('Forecast ' + (round+1) + '/4 · ' + state.hits.size + ' received · ' + state.errors.size + ' crossed beats');
  }
  function beatTone(n) {
    if (n < 0 || n >= end) return;
    const {phase,round,column}=dialAt(n+.5);
    radio?.tone(phase==='count' ? 330 : 210,.045,phase==='count' ? .45 : .2,'sine');
    if (phase==='count') return;
    if (forecasts[round].north[column]==='1') radio?.tone(pitches[column],.2,.36,'triangle');
    if (forecasts[round].rival[column]==='1') radio?.tone(145,.13,.11,'sawtooth');
  }
  api.setStatus('Listen to the first eight beats. On the repeat, tap the open rings as the dial crosses their centres.');
  showHud(); drawDial(ctx,state);
  api.frame(dt => {
    if (!state.running) return;
    state.beat=Math.min(end,state.beat + dt/secondsPerBeat);
    const {phase,round}=dialAt(state.beat);
    const cue=Math.floor(state.beat-.5);
    if (cue!==sounded) { sounded=cue; beatTone(cue); }
    drawDial(ctx,state);
    if (phase==='end') {
      const {possible,outcome}=reception(state);
      const ending={complete:'A familiar voice answers from beyond the weather band.',partial:'A broken reply comes back through the rain.',failed:'Only the weather made it onto the tape.'};
      api.finish(outcome,state.hits.size+' of '+possible+' pulses received. '+ending[outcome]);
      return;
    }
    if (phase!==previousPhase) {
      const instructions=phase==='count' ? 'Four beats until the forecast.' :
        phase==='listen' ? 'Listen to North Relay. Remember its rests.'+(round>=2?' Ignore the low rival signal on DX.':'') :
        'Your reply. Tap on FM rest beats '+[...forecasts[round].north].flatMap((note,i)=>note==='0'?[i+1]:[]).join(', ')+'.';
      api.setStatus(instructions);
      showHud(); previousPhase=phase;
    }
  });
}
