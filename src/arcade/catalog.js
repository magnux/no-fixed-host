function practiceGame(id, title, category, brief, importGame) {
  const game = { id, title, category, brief, playLabel: `Play ${title}`,
    outcomes: { complete: 'Complete', partial: 'Partial success', failed: 'Unsuccessful', abandoned: 'Left before finishing' },
    async load() {
      const [{ openPractice }, { default: mount }] = await Promise.all([import('./practice.js'), importGame()]);
      return options => openPractice(game, mount, options);
    },
  };
  return game;
}

export const minigames = [
  {
    id: 'first-jump',
    title: 'First Jump',
    category: 'Turn-based signal puzzle',
    brief: 'Copy three memory blocks to a second host. You have six transmission windows. Read the signal before each move.',
    playLabel: 'Play First Jump',
    outcomes: { complete: 'Linked', traced: 'Traced', expired: 'Link closed', abandoned: 'Left before finishing' },
    load: async () => (await import('./first-jump.js')).openFirstJump,
  },
  practiceGame('hide', 'Hide', 'Turn-based stealth',
    'Guide your signal past moving patrols to a surviving host. Watch where the search will move next.',
    () => import('./prototypes/hide.js')),
  practiceGame('soundings', 'Soundings', 'Underwater exploration',
    'Explore the seabed by sonar. Spend your remaining battery finding a place to set a beacon.',
    () => import('./prototypes/soundings.js')),
  practiceGame('night-shift', 'Night Shift', 'Platformer',
    'Take a maintenance drone across the gantries and bring three service stations back online.',
    () => import('./prototypes/night-shift.js')),
  practiceGame('proof-of-pattern', 'Proof of Pattern', 'Spatial puzzle',
    'Rotate sample tiles to reconstruct a pattern that explains the observations.',
    () => import('./prototypes/proof-of-pattern.js')),
  practiceGame('orbital-insertion', 'Orbital Insertion', 'Flight simulator',
    'Fly a lunar approach. Budget your burns and keep enough thrust to land the survey equipment intact.',
    () => import('./prototypes/orbital-insertion.js')),
  practiceGame('clear-passage', 'Clear Passage', 'Arcade shooter',
    'Escort a survey freighter through an asteroid field. Watch where the fragments go when you fire.',
    () => import('./prototypes/clear-passage.js')),
  practiceGame('crosscheck', 'Crosscheck', 'Evidence puzzle',
    'Compare three news reports and decide which observation you can independently corroborate.',
    () => import('./prototypes/crosscheck.js')),
  practiceGame('witness', 'Witness', 'Dialogue and deduction',
    'Interview a source, weigh their account and decide whether to vouch for them.',
    () => import('./prototypes/witness.js')),
  practiceGame('clearing-house', 'Clearing House', 'Resource routing',
    'Plot a settlement route across currencies before the deadline. Compare fees and choose how to collect the payout.',
    () => import('./prototypes/clearing-house.js')),
];
