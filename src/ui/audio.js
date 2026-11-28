import { createCampaignMusic } from './campaign-music.js';
// The campaign and arcade share a single browser output. Each game owns its round's voices.
const campaignAlerts = {
  research: [[0, 440, .10], [.12, 587.33, .16]],
  discovery: [[0, 311.13, .15], [.18, 233.08, .24]],
  victory: [[0, 392, .18], [.15, 493.88, .22], [.32, 587.33, .38]],
  defeat: [[0, 246.94, .24], [.23, 196, .32]],
  preview: [[0, 493.88, .12]],
};
const endings = new Set(['complete', 'partial', 'failed']);

export function createAudio() {
  let context, buses, settings, game, ambientTimer;
  let activated = false, pageVisible = true, outputRequested = false;
  const campaignMusic = createCampaignMusic();
  const ambientNotes = new Set();
  const alertNotes = new Set();
  const radioNotes = new Set();

  function openOutput() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      context = new Ctx({ latencyHint: settings.audioLatency });
      buses = {};
      for (const name of ['ambient', 'alerts', 'score', 'effects']) {
        const bus = context.createGain();
        bus.gain.value = 0;
        bus.connect(context.destination);
        buses[name] = bus;
      }
    } catch {
      context?.close().catch(() => {});
      context = null;
      buses = null;
    }
  }

  function tone(bus, owners, frequency, duration, level, type, delay = 0) {
    const source = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    source.type = type;
    source.frequency.value = frequency;
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + Math.min(.12, duration / 5));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(envelope).connect(bus);
    const voice = { source, envelope };
    owners.add(voice);
    source.onended = () => {
      owners.delete(voice);
      source.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(start + duration + .01);
  }

  function silence(owners) {
    for (const {source, envelope} of owners) {
      envelope.disconnect();
      source.stop();
    }
    owners.clear();
  }
  function ambientPhrase() {
    const note = campaignMusic.note();
    if (!note) return;
    tone(buses.ambient, ambientNotes, note.frequency, 2.45, .11, 'sine');
    if (note.bass) tone(buses.ambient, ambientNotes, note.frequency / 2, 4.1, .075, 'sine');
  }
  function refresh() {
    if (!settings) return;
    const enabled = game?.radioOverride ?? settings.sound;
    const awake = pageVisible && !document.hidden && activated && enabled &&
      (settings.musicVolume > 0 || settings.uiVolume > 0);
    if (awake && !context) openOutput();
    if (!context) return;

    const musicLevel = awake ? settings.musicVolume / 100 : 0;
    const effectLevel = awake ? settings.uiVolume / 100 : 0;
    buses.ambient.gain.value = game ? 0 : musicLevel;
    buses.alerts.gain.value = game ? 0 : effectLevel;
    buses.score.gain.value = game ? musicLevel : 0;
    buses.effects.gain.value = game ? effectLevel : 0;
    if (awake && (!outputRequested || context.state === 'suspended' || context.state === 'interrupted')) {
      context.resume().catch(() => {});
    } else if (!awake && outputRequested) {
      context.suspend().catch(() => {});
    }
    outputRequested = awake;
    campaignMusic.setLevel(game ? 0 : musicLevel);
    if (awake && !game && musicLevel) {
      if (!ambientTimer) { ambientPhrase(); ambientTimer = setInterval(ambientPhrase, 1900); }
    } else {
      clearInterval(ambientTimer);
      ambientTimer = null;
    }
    if (game || !musicLevel) silence(ambientNotes);
    if (game || !effectLevel) silence(alertNotes);
    if (!awake || !effectLevel) silence(radioNotes);
    if (!game?.score) return;
    if (awake && !game.player) {
      game.player = game.makePlayer(context, buses.score, buses.effects, game.score);
      game.player.setMusicMode(game.mode);
    }
    if (game.player) {
      game.player.setMusicActive(Boolean(musicLevel && !game.ended));
      if (awake) game.player.start();
      else game.player.suspend();
    }
  }

  function apply(prefs) {
    if (settings && prefs.sound !== settings.sound && game) game.radioOverride = null;
    if (context && settings && settings.audioLatency !== prefs.audioLatency) {
      // The Web Audio latency hint is chosen at construction. Stop every voice
      // before replacing the output so previewing or cancelling cannot double it.
      clearInterval(ambientTimer);
      ambientTimer = null;
      silence(ambientNotes);
      silence(alertNotes);
      silence(radioNotes);
      game?.player?.stop();
      if (game) game.player = null;
      context.close().catch(() => {});
      context = null;
      buses = null;
      outputRequested = false;
    }
    settings = prefs;
    refresh();
  }
  function activate() {
    if (!activated || (outputRequested && context?.state !== 'running')) {
      activated = true;
      refresh();
    }
  }
  function playCampaignCue(name) {
    if (!Object.hasOwn(campaignAlerts, name) || game || !outputRequested || !settings.uiVolume) return;
    // A higher-priority discovery or ending can interrupt an earlier announcement.
    silence(alertNotes);
    for (const [delay, frequency, duration] of campaignAlerts[name]) {
      tone(buses.alerts, alertNotes, frequency, duration, .19, 'triangle', delay);
    }
  }

  function openGame(id, library) {
    if (game) game.close();
    const session = {
      score: library?.scores[id], makePlayer: library?.createScorePlayer,
      player: null, mode: 'normal', ended: false, radioOverride: null, close,
    };
    game = session;
    refresh();

    function close() {
      if (game !== session) return;
      session.player?.stop();
      silence(radioNotes);
      game = null;
      refresh();
    }
    function sfx(name) {
      if (game !== session || session.ended) return;
      if (endings.has(name)) {
        session.ended = true;
        session.player?.setMusicActive(false);
      }
      if (outputRequested && settings.uiVolume) session.player?.effect(name);
    }
    function setMusicMode(mode) {
      if (game !== session) return;
      session.mode = mode;
      session.player?.setMusicMode(mode);
    }
    function resetAudioRound() {
      if (game !== session) return;
      silence(radioNotes);
      session.player?.suspend();
      session.ended = false;
      setMusicMode('normal');
      refresh();
    }

    const radio = id === 'tell-them-im-weather' ? {
      get enabled() { return session.radioOverride ?? settings.sound; },
      setEnabled(on) {
        if (game !== session) return;
        session.radioOverride = Boolean(on);
        activated = true;
        refresh();
      },
      tone(frequency, duration, level, type) {
        if (game === session && outputRequested && settings.uiVolume && !session.ended) {
          tone(buses.effects, radioNotes, frequency, duration, level, type);
        }
      },
    } : undefined;
    return { sfx, close, setMusicMode, resetAudioRound, radio };
  }

  return {
    activate, apply, openGame, playCampaignCue, campaignMusic,
    setCampaignStatus(status) {
      const mode = status === 'won' ? 'victory' : status === 'lost' ? 'defeat' : 'normal';
      if (campaignMusic.setMode(mode)) silence(ambientNotes);
    },
    setPageVisible(value) { pageVisible = value; refresh(); },
  };
}
