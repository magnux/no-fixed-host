// Local Web Audio keeps the static bundle independent of remote media.
export function createAudio() {
  let context;
  let mix;
  let music;
  let timer;
  let beat = 0;
  let settings;
  let activated = false;

  function note(destination, frequency, duration, level, type) {
    const voice = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime;
    voice.type = type;
    voice.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + Math.min(.15, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    voice.connect(envelope).connect(destination);
    voice.start(start);
    voice.stop(start + duration + .02);
    voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
  }
  function phrase() {
    const melody = [146.83, 220, 261.63, 196, 174.61, 261.63, 220, 164.81];
    note(music, melody[beat % melody.length], 2.45, .11, 'sine');
    if (beat % 4 === 0) note(music, beat % 8 === 0 ? 73.42 : 87.31, 4.1, .075, 'sine');
    beat++;
  }
  function apply(prefs) {
    settings = prefs;
    const audible = settings.sound && !document.hidden && activated;
    if (audible && !context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        context = new Ctx();
        mix = context.createGain(); music = context.createGain();
        mix.connect(context.destination); music.connect(context.destination);
      } catch { return; }
    }
    if (!context) return;
    mix.gain.value = audible ? prefs.uiVolume / 100 : 0;
    music.gain.value = audible ? prefs.musicVolume / 100 : 0;
    if (audible) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!timer && prefs.musicVolume > 0) { phrase(); timer = setInterval(phrase, 1900); }
    } else if (context.state === 'running') context.suspend().catch(() => {});
    if (!audible || !prefs.musicVolume) { clearInterval(timer); timer = null; }
  }
  function activate() { activated = true; if (settings) apply(settings); }
  function click() {
    if (!settings?.sound || !context || document.hidden) return;
    note(mix, 493.88, .085, .12, 'triangle');
  }
  return { apply, activate, click };
}
