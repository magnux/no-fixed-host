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
];
