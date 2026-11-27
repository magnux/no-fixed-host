// Each measure uses [beat, MIDI note, length in beats]. Parts share a downbeat,
// so an instrument can leave several measures open for the others to answer.
function measures(length, ...parts) {
  return parts.flatMap((part, index) => part.map(([beat, midi, duration]) =>
    [index * length + beat, midi, duration]));
}

const bassRest = [[0, 38, .7], [2.5, 45, .35], [3, 41, .42]];
const crossing = [[0, 53, .42], [1.5, 60, .32], [2, 63, .42], [3.66, 60, .22]];
const nightHats = [[.66, 87, .07], [1.66, 82, .06], [2.66, 87, .07], [3.66, 84, .08]];
const proofSubject = [[0, 60, .42], [.5, 67, .4], [1.5, 64, .63], [2.5, 69, .45]];

function transpose(notes, semitones) {
  return notes.map(([beat, pitch, duration]) => [beat, pitch + semitones, duration]);
}

function repeatBar(length, measure, count) {
  return measures(length, ...Array(count).fill(measure));
}

// A clipped Dorian bass divides the circuit into 3 + 3 + 2 eighth notes.
const neonBass = [[0,38,.52],[1.5,50,.4],[3,45,.48]];
const neonCall = [[.5,69,.42],[1.5,72,.6],[2.75,67,.33],[3.5,65,.35]];
const neonAnswer = [[0,64,1.1],[1.75,67,.36],[2.5,69,1.1]];

// The courier melody picks up before the downbeat and hangs over the backbeat.
const roadBass = [[0,45,.65],[1.5,52,.38],[2,57,.65],[3.5,55,.35]];
const roadUp = [[.75,64,.45],[1.5,66,.3],[2,69,.9],[3.5,71,.32]];
const roadDown = [[0,73,.8],[1.5,71,.45],[2.5,69,.95]];
const skank = [[.66,69,.15],[.66,73,.15],[2.66,69,.15],[2.66,73,.15]];

// Three beats per measure; breakers and flippers occupy the space between strikes.
const coils = [[0,40,1.5],[2,47,.55]];
const strike = [[0,59,.5],[.5,64,.5],[1.5,66,1]];
const returnStrike = [[0,67,.8],[1,64,.6],[2,62,.5]];
const pasture = [[0,48,.72],[1,55,.37],[2,64,.37]];
const skip = [[0,72,.68],[.85,76,.3],[1.45,74,.36],[2,72,.6]];

// Effects are [delay (seconds), starting and ending MIDI pitches, duration (seconds), wave, gain].
export const scores = {
  'first-jump': {
    title: 'Carrier Pigeons', bpm: 98, beats: 24,
    voices: [
      { wave: 'triangle', gain: .16, attack: .014, release: .08,
        notes: measures(3,
          [[0, 64, .7], [1, 67, .32], [1.5, 71, .75]], [[1, 69, .8], [2, 66, .45]],
          [[0, 62, .7], [1, 66, .32], [1.5, 69, .85]], [[1, 67, 1.25]],
          [[0, 64, .6], [1, 67, .38], [1.5, 74, 1]], [[.5, 71, .7], [2, 69, .5]],
          [[0, 67, .7], [1, 66, .45], [2, 62, .65]], [[0, 64, 1.8]]) },
      { wave: 'sine', gain: .21, attack: .05, release: .16,
        notes: measures(3, [[0, 48, 1.6]], [[0, 55, .6], [1.5, 59, .8]], [[0, 50, 1.8]], [[0, 55, 1.7]],
          [[0, 48, 1.8]], [[0, 52, .9], [1.5, 57, .8]], [[0, 55, 1.75]], [[0, 48, 2.25]]) },
      { wave: 'sine', gain: .095, attack: .018, release: .13,
        notes: [[2.3, 79, .23], [5.1, 78, .3], [8.3, 76, .25], [11, 74, .4],
          [14.3, 79, .22], [17.1, 83, .4], [20.3, 78, .25], [22.5, 76, .48]] },
    ],
    effects: {
      transmit: [[0, 73, 79, .072, 'sine', .32], [.085, 82, 82, .08, 'sine', .24]],
      hold: [[0, 54, 49, .085, 'triangle', .21]],
      complete: [[0, 67, 67, .10, 'sine', .35], [.10, 71, 71, .12, 'sine', .3], [.22, 78, 79, .25, 'sine', .32]],
      failed: [[0, 70, 49, .20, 'sawtooth', .12], [.15, 45, 38, .19, 'triangle', .24]],
      partial: [[0, 65, 62, .12, 'sine', .3], [.14, 57, 53, .22, 'triangle', .23]],
    },
  },
  hide: {
    title: 'Soft Soles', bpm: 108, beats: 20,
    voices: [
      { wave: 'triangle', gain: .20, attack: .01, release: .06,
        notes: measures(5, bassRest, [[0, 36, .7], [2.5, 43, .35], [3, 40, .38], [4.5, 45, .22]],
          bassRest, [[0, 43, .65], [1.5, 42, .4], [3, 45, .6], [4, 37, .32]]) },
      { wave: 'sine', gain: .15, attack: .035, release: .11,
        notes: [[1.5, 62, .42], [3.5, 65, .68], [6.5, 64, .35], [8.25, 60, .5],
          [11.5, 62, .42], [13.5, 69, .85], [16.5, 67, .45], [17.25, 65, .35], [18.5, 61, .78]] },
      { wave: 'noise', gain: .055, attack: .004, release: .035,
        notes: [[2, 72, .08], [4.5, 62, .11], [7, 72, .08], [9, 68, .1], [12, 72, .08],
          [14.5, 62, .10], [17, 72, .09], [19.25, 65, .06]] },
    ],
    effects: {
      target: [[0, 58, 62, .10, 'sine', .34], [.12, 69, 69, .12, 'sine', .24]],
      step: [[0, 48, 37, .07, 'triangle', .24]],
      wait: [[0, 60, 57, .08, 'sine', .20], [.1, 52, 52, .05, 'sine', .12]],
    },
  },
  soundings: {
    title: 'Below the Thermocline', bpm: 62, beats: 24,
    voices: [
      { wave: 'sine', gain: .22, attack: .45, release: .4,
        notes: [[0, 38, 4.5], [6, 41, 4.25], [12, 43, 3.6], [16, 45, 1.3], [18, 38, 4.6]] },
      { wave: 'triangle', gain: .11, attack: .35, release: .25,
        notes: [[.5, 57, 3.4], [4.5, 60, 1], [6.75, 64, 2.5], [10, 62, 1.1], [12, 59, 3.6],
          [16.25, 57, .9], [18.75, 60, 2.8], [22, 57, 1.2]] },
      { wave: 'sine', gain: .12, attack: .065, release: .3,
        notes: [[2.75, 69, .82], [3.8, 72, .42], [8, 67, .9], [9.5, 64, .55],
          [14.75, 71, .85], [15.85, 74, .5], [20.5, 69, .85], [21.65, 65, .7]] },
    ],
    effects: {
      ping: [[0, 88, 84, .22, 'sine', .38], [.24, 84, 82, .13, 'sine', .18], [.45, 81, 79, .15, 'sine', .085]],
      propeller: [[0, 43, 49, .11, 'triangle', .19]],
      anchorage: [[0, 63, 65, .13, 'sine', .27], [.16, 70, 72, .22, 'sine', .25]],
    },
  },
  'night-shift': {
    title: 'The Third Rail Swing', bpm: 128, beats: 32,
    voices: [
      { wave: 'triangle', gain: .22, attack: .008, release: .048,
        notes: measures(4, crossing, [[0, 53, .65], [1, 56, .38], [2.66, 58, .28], [3, 60, .55]],
          [[0, 58, .55], [1.5, 65, .35], [2, 68, .45]], [[0, 58, .6], [1, 62, .4], [2, 59, .35], [3, 56, .6]],
          crossing, [[0, 53, .55], [1, 60, .3], [1.66, 62, .24], [2, 63, .7]],
          [[0, 48, .6], [1.5, 55, .35], [2, 58, .4], [3, 52, .55]], [[0, 53, 1.4], [2.66, 48, .3], [3, 51, .48]]) },
      { wave: 'square', gain: .065, attack: .018, release: .06,
        notes: [[.66, 72, .27], [2, 75, .65], [5.66, 77, .27], [6, 75, .42], [7, 72, .55],
          [8.66, 74, .3], [10, 77, .75], [13, 80, .32], [13.66, 77, .27], [14, 74, .9],
          [16.66, 72, .27], [18, 75, .65], [21, 80, .45], [22, 77, .45], [23, 75, .3],
          [24.66, 76, .27], [26, 79, .55], [27, 76, .35], [28, 77, 1.35]] },
      { wave: 'noise', gain: .062, attack: .003, release: .03,
        notes: measures(4, nightHats, [[1, 67, .16], [3, 67, .16]], nightHats, [[1, 67, .16], [3, 67, .12], [3.66, 80, .08]],
          nightHats, [[1, 67, .16], [3, 67, .16]], nightHats, [[1, 67, .16]]) },
    ],
    effects: {
      jump: [[0, 53, 70, .12, 'triangle', .3]],
      calibrate: [[0, 71, 72, .09, 'triangle', .28], [.1, 78, 79, .14, 'sine', .30]],
      fall: [[0, 61, 40, .23, 'triangle', .26], [.19, 47, 34, .1, 'noise', .13]],
    },
  },
  'proof-of-pattern': {
    title: 'Seven Glass Teeth', bpm: 84, beats: 28,
    voices: [
      { wave: 'sine', gain: .19, attack: .014, release: .18,
        notes: measures(3.5, proofSubject, [[0, 64, .48], [1, 71, .4], [1.5, 67, .8], [2.75, 62, .4]],
          proofSubject, [[0, 62, .48], [1, 69, .4], [1.5, 66, .6], [2.75, 71, .38]],
          proofSubject, [[0, 67, .4], [.5, 74, .45], [1.5, 71, .85]],
          [[0, 69, .42], [.5, 72, .45], [1.5, 66, .55], [2.5, 62, .5]], [[0, 64, 1], [1.5, 60, 1.2]]) },
      { wave: 'triangle', gain: .10, attack: .025, release: .10,
        notes: [[2, 55, .8], [5, 59, 1.35], [9, 57, .8], [12, 54, 1.2],
          [16, 55, .8], [19, 59, 1.35], [22.5, 57, 1.4], [25.5, 55, 1.4]] },
    ],
    effects: {
      rotate: [[0, 75, 69, .055, 'triangle', .19]],
      matched: [[0, 76, 76, .075, 'sine', .31], [.09, 83, 83, .16, 'sine', .23]],
      test: [[0, 68, 63, .12, 'triangle', .25], [.135, 61, 59, .1, 'sine', .2]],
    },
  },
  'orbital-insertion': {
    title: 'Earthrise in Slow Motion', bpm: 76, beats: 32,
    voices: [
      { wave: 'triangle', gain: .14, attack: .14, release: .25,
        notes: [[0, 65, 2.2], [3, 67, .68], [4, 72, 2.8], [7, 71, .7], [8, 69, 2.35],
          [11, 67, .65], [12, 64, 2.8], [16, 65, 1.6], [18, 67, 1], [20, 76, 2.6], [23, 74, .65],
          [24, 71, 2.3], [27, 67, .65], [28, 65, 2.9]] },
      { wave: 'sine', gain: .22, attack: .2, release: .27,
        notes: [[0, 41, 3], [4, 48, 3], [8, 45, 3], [12, 40, 3], [16, 41, 3], [20, 48, 3], [24, 43, 3], [28, 41, 3.5]] },
      { wave: 'sine', gain: .105, attack: .03, release: .18,
        notes: [[1.5, 60, .5], [2.5, 64, .48], [5.5, 67, .55], [6.5, 64, .48],
          [9.5, 64, .5], [10.5, 60, .48], [13.5, 59, .5], [14.5, 62, .65],
          [17.5, 60, .5], [18.5, 64, .5], [21.5, 67, .52], [22.5, 71, .55],
          [25.5, 62, .5], [26.5, 66, .5], [29.5, 60, .55], [30.5, 64, .63]] },
    ],
    effects: {
      transfer: [[0, 42, 55, .34, 'noise', .28], [.08, 38, 47, .4, 'sine', .32]],
      brake: [[0, 69, 49, .23, 'noise', .30], [0, 51, 45, .20, 'triangle', .22]],
      cutoff: [[0, 49, 35, .10, 'triangle', .21]],
    },
  },

  'clear-passage': {
    title: 'Ballast and Stars', bpm: 108, beats: 20,
    voices: [
      // Five beats: two short engine strokes followed by a longer coast.
      { wave: 'triangle', gain: .115, notes: measures(5, ...[40,43,38,35].map(root =>
        [[0,root,.7],[1,root+7,.35],[2.5,root+12,.45],[4,root+7,.5]])) },
      { wave: 'sine', gain: .12, attack: .04, release: .095, notes: measures(5, ...[
        [[.5,71,.75],[1.5,67,1.5],[3.5,66,.65]],
        [[0,67,1.3],[1.75,69,.55],[3,74,1.3]],
        [[.5,69,.75],[1.5,66,1.5],[3.5,64,.65]],
        [[0,63,.9],[1.5,66,.45],[2.5,71,1.5]],
      ]) },
      { wave: 'noise', gain: .047, notes: measures(5, ...[0,1,2,3].map(() =>
        [[0,42,.12],[2,77,.1],[3.5,62,.085],[4.5,76,.065]])) },
    ],
    effects: {
      launch: [[0,45,52,.15,'triangle',.22],[.085,59,64,.14,'sine',.2]],
      laser: [[0,83,52,.065,'triangle',.19]],
      cargo: [[0,50,33,.14,'triangle',.24],[.11,44,29,.17,'noise',.19]],
    },
  },
  crosscheck: {
    title: 'Carbon Paper', bpm: 82, beats: 32,
    voices: [
      // A sparse newsroom trio. The offbeat pair falls on the last triplet of the beat.
      { wave: 'triangle', gain: .105, release: .09, notes: measures(4, ...[
        [[0,50,.8],[2,57,.5]], [[0,55,1],[2.67,53,.36]],
        [[0,48,.8],[2,55,.65]], [[0,48,1.2],[3,49,.5]],
        [[0,50,.8],[2,57,.5]], [[0,55,1],[2.67,59,.36]],
        [[0,52,.9],[2,55,.55]], [[0,45,1.35],[3,49,.55]],
      ]) },
      { wave: 'sine', gain: .11, release: .17, notes: measures(4, ...[
        [[.67,65,.85],[2,69,.65]], [[1,67,.85],[2.67,65,.33],[3.33,62,.45]],
        [[0,64,1.5],[2.67,67,.65]], [[1,71,.6],[2,67,1]],
        [[.67,69,.85],[2,72,.65]], [[1,71,.85],[2.67,67,.33],[3.33,65,.45]],
        [[0,64,1.6],[2.67,62,.65]], [[.67,61,.8],[2,64,.65]],
      ]) },
      { wave: 'noise', gain: .026, notes: measures(4, ...Array.from({length:8}, () =>
        [[1,83,.09],[3,80,.13]])) },
    ],
    effects: {
      pin: [[0,85,58,.025,'noise',.16],[.016,77,70,.06,'triangle',.14]],
      unpin: [[0,74,82,.045,'noise',.14]],
      headline: [[0,69,69,.07,'sine',.2],[.065,76,76,.09,'sine',.17]],
    },
  },
  witness: {
    title: 'The Open Receiver', bpm: 68, beats: 24,
    voices: [
      // Two speakers in triple meter. Long silences let the written testimony breathe.
      { wave: 'sine', gain: .105, attack: .095, release: .2, notes: measures(3, ...[
        [[0,50,2.4]], [[.5,57,1.4]], [[0,48,2]], [[1,55,1.5]],
        [[0,46,2.5]], [[.5,53,1.5]], [[0,45,2]], [[1,52,1.5]],
      ]) },
      { wave: 'triangle', gain: .072, attack: .065, release: .2, notes: measures(3, ...[
        [[.5,65,1.4]], [[0,64,.8],[1.5,62,.9]],
        [], [[.5,67,1.8]],
        [[1,65,1.1]], [[.5,60,.8],[1.75,62,.85]],
        [], [[0,61,1.3],[2,64,.65]],
      ]) },
    ],
    effects: {
      question: [[0,57,62,.095,'sine',.18],[.12,69,67,.15,'triangle',.13]],
      followup: [[0,62,65,.075,'sine',.17],[.09,67,69,.1,'sine',.17],[.21,65,64,.14,'triangle',.12]],
    },
  },
  'clearing-house': {
    title: 'Settlement Window', bpm: 102, beats: 24,
    voices: [
      // Three groups of two eighths underneath a syncopated three-beat mallet line.
      { wave: 'triangle', gain: .11, notes: measures(3, ...[48,53,50,55,52,57,50,55].map(root =>
        [[0,root,.48],[1.5,root+7,.43],[2.5,root+12,.23]])) },
      { wave: 'sine', gain: .14, attack: .009, release: .105, notes: measures(3, ...[
        [[.5,76,.35],[1.25,79,.45],[2.25,74,.36]],
        [[0,72,.9],[1.75,69,.65]],
        [[.5,77,.35],[1.25,74,.45],[2.25,69,.36]],
        [[0,71,.65],[1.5,74,.7]],
        [[.5,79,.35],[1.25,83,.45],[2.25,78,.36]],
        [[0,76,.8],[1.5,72,.6]],
        [[.5,74,.5],[1.5,69,.4],[2.25,72,.35]],
        [[0,71,.8],[1.75,67,.65]],
      ]) },
      { wave: 'triangle', gain: .039, notes: measures(3, ...[64,65,65,67,67,69,65,67].map(pitch =>
        [[.75,pitch,.14],[2,pitch+4,.16]])) },
    ],
    effects: {
      transfer: [[0,72,72,.055,'sine',.23],[.05,79,79,.09,'triangle',.17]],
      rush: [[0,69,80,.115,'triangle',.21]],
      undo: [[0,72,65,.09,'sine',.21]],
    },
  },
  'hot-swap': {
    title: 'Two Furnaces', bpm: 138, beats: 32,
    voices: [
      { wave: 'square', gain: .048, release: .035, notes: measures(4, ...[
        [[0,73,.5],[.75,76,.22],[1.25,80,.55],[2.25,78,.26],[3,76,.65]],
        [[0,71,.4],[.75,73,.25],[1.5,76,.45],[2.5,71,.85]],
        [[0,69,.5],[.75,73,.22],[1.25,76,.55],[2.25,74,.26],[3,73,.65]],
        [[0,71,.45],[1,68,.24],[1.5,66,.55],[2.5,68,1]],
        [[0,73,.5],[.75,76,.22],[1.25,80,.55],[2.25,83,.26],[3,81,.65]],
        [[0,78,.4],[.75,76,.25],[1.5,74,.45],[2.5,78,.85]],
        [[0,76,.5],[.75,73,.22],[1.25,71,.55],[2.25,69,.26],[3,68,.65]],
        [[0,66,.45],[1,68,.25],[1.5,71,.55],[2.5,68,.95]],
      ]) },
      { wave: 'triangle', gain: .13, notes: measures(4, ...[49,47,45,44,49,50,45,44].map(root =>
        [[0,root,.65],[1,root+12,.33],[1.75,root+7,.28],[2.5,root,.35],[3.5,root+7,.32]])) },
      { wave: 'noise', gain: .052, notes: measures(4, ...Array.from({length:8}, () =>
        [[0,34,.13],[1,68,.1],[2.5,35,.12],[3,71,.1]])) },
    ],
    effects: {
      jump: [[0,54,76,.105,'square',.1]],
      pulse: [[0,80,55,.058,'triangle',.19]],
      dash: [[0,48,78,.13,'noise',.19],[.016,50,64,.07,'sawtooth',.1]],
      damage: [[0,52,30,.13,'sawtooth',.14]],
      module: [[0,61,61,.085,'square',.12],[.09,68,68,.1,'square',.12],[.19,76,80,.14,'triangle',.19]],
    },
  },
  'escape-character': {
    title: 'The Seventh Room', bpm: 61, beats: 28,
    voices: [
      // A hollow pair of fourths, then a high bell after an uneven seven-beat wait.
      { wave: 'sine', gain: .115, attack: .16, release: .24, notes: measures(7, ...[
        [[0,40,4.8],[5.5,47,1]], [[0,38,4],[5,45,1.3]],
        [[0,36,4.8],[5.5,43,1]], [[0,35,4.5],[5,42,1.4]],
      ]) },
      { wave: 'triangle', gain: .055, attack: .075, release: .2, notes: measures(7, ...[
        [[1,57,2.2],[4,62,1.8]], [[1.5,55,1.5],[4.5,60,1.55]],
        [[1,53,2.2],[4,58,1.8]], [[1.5,54,1.5],[4.5,59,1.55]],
      ]) },
      { wave: 'sine', gain: .095, release: .23, notes: measures(7, ...[
        [[3.5,76,.4],[5,71,.75]], [[2.5,74,.65]],
        [[3.5,72,.4],[5,67,.75]], [[2.5,66,.65],[6,71,.45]],
      ]) },
    ],
    effects: {
      jump: [[0,48,55,.065,'triangle',.14]],
      shift: [[0,47,67,.13,'triangle',.19],[.08,73,73,.095,'sine',.18]],
      rebuild: [[0,71,55,.13,'triangle',.19],[.1,48,48,.09,'sine',.17]],
      coupling: [[0,52,64,.135,'triangle',.18],[.14,71,71,.17,'sine',.21]],
      memory: [[0,64,64,.16,'sine',.2],[.13,71,71,.18,'sine',.18],[.28,78,76,.24,'sine',.16]],
      rescue: [[0,48,39,.16,'triangle',.15]],
    },
  },

  'neon-perimeter': {
    title: 'Switchyard After Dark', bpm: 108, beats: 32,
    voices: [
      { wave: 'triangle', gain: .13, notes: measures(4, neonBass, neonBass, transpose(neonBass, 5), transpose(neonBass, 5),
        transpose(neonBass, 3), transpose(neonBass, 3), transpose(neonBass, 7), [[0,45,.55],[1.5,52,.4],[3,49,.65]]) },
      { wave: 'square', gain: .043, attack: .012, release: .065, notes: measures(4,
        neonCall, neonAnswer, transpose(neonCall, 5), [[0,69,1.3],[2.5,72,.65]],
        [[0,70,.6],[1,69,.5],[2.75,65,.7]], [[.5,67,1],[2,65,.6]],
        [[.5,64,.5],[1.5,67,.6],[3,69,.5]], [[.25,67,.6],[1.5,64,.55],[3,61,.4]]) },
      { wave: 'noise', gain: .027, notes: repeatBar(4, [[1,74,.09],[2.75,82,.045],[3,76,.09]], 8) },
    ],
    effects: {
      install: [[0,55,62,.065,'triangle',.24],[.08,74,74,.09,'sine',.18]],
      move: [[0,74,67,.09,'sine',.22],[.11,67,74,.075,'sine',.18]],
      wave: [[0,42,42,.11,'square',.11],[.15,49,56,.17,'triangle',.21]],
      boost: [[0,43,67,.18,'sawtooth',.095],[.11,67,79,.12,'triangle',.2]],
      clear: [[0,62,62,.09,'sine',.18],[.12,69,69,.12,'sine',.16]],
    },
  },
  'dead-drop-circuit': {
    title: 'Last Tram to the Quay', bpm: 124, beats: 32,
    voices: [
      { wave: 'triangle', gain: .135, notes: measures(4,
        roadBass, roadBass, transpose(roadBass,-2), transpose(roadBass,-2),
        transpose(roadBass,-5), transpose(roadBass,-5), transpose(roadBass,-2),
        [[0,40,.75],[1.5,47,.4],[2.5,52,.55],[3.5,44,.38]]) },
      { wave: 'triangle', gain: .135, attack: .025, release: .1, notes: measures(4,
        roadUp, roadDown, transpose(roadUp,-2), transpose(roadDown,-2),
        [[0,69,1.2],[1.5,66,.4],[2.5,64,.6]], [[.65,62,.55],[1.65,64,.6],[3.5,66,.32]],
        [[0,67,.8],[1,66,.42],[2,62,1.15]], [[.5,64,.65],[1.5,59,.6],[3.5,61,.3]]) },
      { wave: 'sawtooth', gain: .029, notes: measures(4, skank, skank, transpose(skank,-2), transpose(skank,-2),
        transpose(skank,-5), transpose(skank,-5), transpose(skank,-2), transpose(skank,-5)) },
      { wave: 'noise', gain: .032, notes: repeatBar(4, [[1,65,.12],[3,63,.12],[3.66,76,.045]], 8) },
    ],
    effects: {
      ignition: [[0,40,51,.12,'sawtooth',.11],[.14,47,62,.13,'triangle',.23]],
      pickup: [[0,69,69,.065,'triangle',.25],[.075,76,76,.13,'sine',.22]],
      quay: [[0,71,71,.08,'triangle',.23],[.09,78,78,.13,'sine',.2]],
      scrape: [[0,77,48,.105,'noise',.14]],
    },
  },
  'black-start': {
    title: 'Flywheel in Three', bpm: 99, beats: 24,
    voices: [
      { wave: 'sine', gain: .16, attack: .018, notes: measures(3, coils, coils, transpose(coils,3), transpose(coils,3),
        transpose(coils,5), transpose(coils,-2), transpose(coils,7), [[0,43,1],[1.5,42,1.2]]) },
      { wave: 'triangle', gain: .093, release: .15, notes: measures(3, strike, returnStrike, transpose(strike,3),
        [[0,70,.9],[1,67,.6],[2,62,.75]], [[0,69,1.2],[1.75,64,.55]],
        [[0,65,.7],[1.5,62,.8]], [[.5,63,.5],[1.5,66,.8]], [[0,62,1.25],[2,59,.55]]) },
      { wave: 'noise', gain: .024, notes: repeatBar(3, [[0,46,.1],[1.5,72,.055],[2.5,84,.035]], 8) },
    ],
    effects: {
      plunger: [[0,43,63,.11,'triangle',.26],[0,70,41,.08,'noise',.12]],
      flipper: [[0,62,38,.038,'triangle',.19],[0,85,62,.022,'noise',.09]],
      cooling: [[0,72,72,.17,'sine',.32],[.012,84,84,.09,'sine',.085]],
      memory: [[0,76,76,.17,'sine',.32],[.012,88,88,.09,'sine',.085]],
      relay: [[0,79,79,.17,'sine',.32],[.012,91,91,.09,'sine',.085]],
      drain: [[0,56,44,.18,'triangle',.23]],
    },
  },
  'tell-them-im-weather': {
    title: 'The Quiet Carrier', bpm: 120, beats: 32,
    // Long open intervals below the forecast notes leave the station's beat
    // rings, count-in and reply window clear even during the rival broadcast.
    voices: [
      { wave: 'sine', gain: .13, attack: .23, release: .42, notes:
        [[0,43,6.4],[8,38,6.4],[16,40,6.4],[24,38,6.4]] },
      { wave: 'triangle', gain: .061, attack: .15, release: .3, notes:
        [[1,55,2.7],[5,57,1.9],[9,54,2.8],[13,57,1.7],[17,55,2.6],[21,52,1.8],[25,50,2.7],[29,54,1.7]] },
      { wave: 'sine', gain: .045, attack: .25, release: .38, notes:
        [[3,62,3],[11,64,2.6],[19,59,3],[27,57,2.6]] },
    ],
    effects: {
      tune: [[0,54,60,.055,'noise',.1],[.055,62,62,.08,'sine',.15]],
    },
  },
  'ram-jam': {
    title: 'Little CRT Pasture', bpm: 116, beats: 24,
    voices: [
      { wave: 'triangle', gain: .14, notes: measures(3, pasture, pasture, transpose(pasture,5), transpose(pasture,5),
        transpose(pasture,-3), [[0,53,.7],[1,60,.37],[2,65,.37]],
        transpose(pasture,-5), [[0,55,.65],[1,59,.4],[2.5,55,.3]]) },
      { wave: 'sine', gain: .17, attack: .014, release: .08, notes: measures(3, skip,
        [[0,67,1.2],[1.75,69,.4],[2.35,72,.45]], transpose(skip,5), [[0,69,1.1],[1.66,65,.8]],
        [[0,72,.7],[.85,76,.38],[1.5,81,.42],[2.15,79,.6]],
        [[0,77,1.15],[1.7,74,.38],[2.35,72,.42]],
        [[0,71,.7],[1,74,.7],[2,67,.6]], [[0,72,1.6],[2.5,67,.3]]) },
      { wave: 'square', gain: .027, notes: measures(3, [], [[1.5,60,.24],[2,64,.25]], [],
        [[1.5,65,.24],[2,69,.25]], [], [[1.5,60,.24],[2,65,.25]], [], [[1,59,.28],[1.5,62,.38]]) },
    ],
    effects: {
      chirp: [[0,79,79,.072,'triangle',.22],[.07,85,85,.064,'triangle',.21],[.13,82,82,.1,'triangle',.18]],
      greet: [[0,72,74,.07,'triangle',.22],[.08,79,81,.08,'triangle',.2],[.17,84,84,.13,'sine',.2]],
      caught: [[0,69,55,.14,'triangle',.21],[.13,50,40,.14,'triangle',.17]],
    },
  },
};
