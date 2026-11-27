// Local Web Audio keeps the static bundle independent of remote media.
export function createAudio() {
  let context;
  let mix;
  let music;
  let timer;
  let beat = 0;
  let settings;
  let activated = false;
  let radio;

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
    const audible = (radio ? radio.enabled : settings.sound) && !document.hidden && activated;
    const campaignAudible = audible && !radio;
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
    mix.gain.value = campaignAudible ? prefs.uiVolume / 100 : 0;
    music.gain.value = campaignAudible ? prefs.musicVolume / 100 : 0;
    if (audible) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!timer && campaignAudible && prefs.musicVolume > 0) { phrase(); timer = setInterval(phrase, 1900); }
    } else if (context.state === 'running') context.suspend().catch(() => {});
    if (!campaignAudible || !prefs.musicVolume) { clearInterval(timer); timer = null; }
  }
  function activate() { activated = true; if (settings) apply(settings); }
  function click() {
    if (radio || !settings?.sound || !context || document.hidden) return;
    note(mix, 493.88, .085, .12, 'triangle');
  }
  // A rhythm round has its own short tones and needs the normal score to go quiet.
  function openRadio() {
    const session = { enabled: Boolean(settings?.sound && settings.musicVolume) };
    radio = session;
    apply(settings);
    return {
      get enabled() { return session.enabled; },
      setEnabled(enabled) { session.enabled = enabled; activate(); },
      tone(frequency, duration, level, type) {
        if (radio !== session || !session.enabled || !context || document.hidden) return;
        const volume = (settings.musicVolume || 35) / 100;
        note(context.destination, frequency, duration, level * volume, type);
      },
      close() {
        if (radio === session) { radio = null; apply(settings); }
      },
    };
  }
  return { apply, activate, click, openRadio };
}
