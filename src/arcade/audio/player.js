// All times sent to Web Audio are on the AudioContext clock. The JS timer only
// fills a short window ahead of it, so frame rate and input speed don't set tempo.
const lookahead = 0.15;
const intervalMs = 50;
const maxMusicVoices = 24;
const maxEffectVoices = 9;
const silence = 0.00001;
const noiseBuffers = new WeakMap();
const endings = {
  complete: [[0, 69, 69, .11, 'triangle', .16], [.10, 73, 73, .11, 'triangle', .14], [.20, 76, 76, .22, 'sine', .19]],
  partial: [[0, 69, 69, .10, 'triangle', .15], [.12, 71, 71, .17, 'sine', .15]],
  failed: [[0, 64, 62, .14, 'triangle', .14], [.14, 60, 57, .20, 'sine', .15]],
};
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

function noiseBuffer(context) {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = buffer.getChannelData(0);
    // Separate noise generation from the game's random sequence.
    let seed = 2713;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

function playVoice(context, bus, playing, wave, start, duration, from, to, gain, attack = .012, release = .08) {
  if (gain <= 0 || duration <= 0) return;
  const source = wave === 'noise' ? context.createBufferSource() : context.createOscillator();
  const envelope = context.createGain();
  let filter;
  let pitch;
  if (wave === 'noise') {
    source.buffer = noiseBuffer(context);
    source.loop = true;
    filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = .65;
    source.connect(filter).connect(envelope);
    pitch = filter.frequency;
  } else {
    source.type = wave;
    source.connect(envelope);
    pitch = source.frequency;
  }
  const end = start + duration;
  pitch.setValueAtTime(hz(from), start);
  if (to !== from) pitch.exponentialRampToValueAtTime(hz(to), end);
  const level = Math.max(silence, Math.min(.26, gain));
  const rise = Math.min(duration * .4, Math.max(.004, attack));
  const fall = Math.min(duration * .55, Math.max(.012, release));
  envelope.gain.setValueAtTime(silence, start);
  envelope.gain.exponentialRampToValueAtTime(level, start + rise);
  envelope.gain.setValueAtTime(level, end - fall);
  envelope.gain.exponentialRampToValueAtTime(silence, end);
  envelope.connect(bus);

  function disconnect() {
    source.onended = null;
    source.disconnect();
    filter?.disconnect();
    envelope.disconnect();
    playing.delete(cancel);
  }
  function cancel() {
    disconnect();
    source.stop(context.currentTime);
  }
  source.onended = disconnect;
  playing.add(cancel);
  source.start(start);
  source.stop(end + .003);
}

function silenceVoices(playing) {
  for (const cancel of playing) cancel();
}

export function createScorePlayer(context, musicBus, effectsBus, score) {
  const beat = 60 / score.bpm;
  const loop = score.beats * beat;
  const notes = score.voices.flatMap(voice => voice.notes.map(([offset, pitch, length]) => ({
    offset: offset * beat, pitch, duration: length * beat, voice,
  }))).sort((a, b) => a.offset - b.offset);
  const music = new Set();
  const effects = new Set();
  const lastEffect = new Map();
  let active = false;
  let stopped = false;
  let musicActive = true;
  let mode = 'normal';
  let epoch = 0;
  let phase = 0;
  let scheduledUntil = 0;
  let timer = null;

  function schedule() {
    if (!active || !musicActive || context.state === 'closed') return;
    const now = context.currentTime;
    const from = Math.max(now, scheduledUntil);
    const through = now + lookahead;
    const firstLoop = Math.max(0, Math.floor((from - epoch) / loop));
    const lastLoop = Math.floor((through - epoch) / loop);
    for (let index = firstLoop; index <= lastLoop; index++) {
      const origin = epoch + index * loop;
      for (const note of notes) {
        const when = origin + note.offset;
        if (when >= through) break;
        if (when < from || music.size >= maxMusicVoices) continue;
        const { voice, pitch, duration } = note;
        const gain = voice.gain * (mode === 'rhythm' ? .23 : .9);
        playVoice(context, musicBus, music, voice.wave, when, duration, pitch, pitch, gain, voice.attack, voice.release);
      }
    }
    scheduledUntil = through;
  }

  function armMusic() {
    if (!active || !musicActive || timer !== null || notes.length === 0) return;
    scheduledUntil = context.currentTime;
    schedule();
    timer = setInterval(schedule, intervalMs);
  }

  function clearMusic() {
    clearInterval(timer);
    timer = null;
    silenceVoices(music);
  }

  function start() {
    if (active || stopped || context.state === 'closed') return;
    active = true;
    epoch = context.currentTime + .015 - phase;
    armMusic();
  }

  function suspend() {
    if (!active) return;
    phase = Math.max(0, context.currentTime - epoch) % loop;
    active = false;
    clearMusic();
    silenceVoices(effects);
    lastEffect.clear();
  }

  function setMusicActive(enabled) {
    if (stopped || enabled === musicActive) return;
    musicActive = enabled;
    if (enabled) armMusic();
    else clearMusic();
  }

  function setMusicMode(next) {
    if (stopped) return;
    mode = next === 'rhythm' ? 'rhythm' : 'normal';
    phase = 0;
    epoch = context.currentTime + .015;
    clearMusic();
    armMusic();
  }

  function effect(name) {
    if (!active || stopped || context.state === 'closed') return false;
    const cue = score.effects?.[name] ?? endings[name];
    if (!Array.isArray(cue) || !cue.length) return false;
    const now = context.currentTime;
    if (now - (lastEffect.get(name) ?? -Infinity) < .105) return false;
    if (Object.hasOwn(endings, name)) silenceVoices(effects);
    if (effects.size + cue.length > maxEffectVoices) return false;
    lastEffect.set(name, now);
    for (const [offset, from, to, duration, wave, gain] of cue) {
      playVoice(context, effectsBus, effects, wave, now + .004 + offset, duration, from, to, gain);
    }
    return true;
  }

  function stop() {
    suspend();
    stopped = true;
  }
  return { start, suspend, stop, setMusicActive, setMusicMode, effect };
}
