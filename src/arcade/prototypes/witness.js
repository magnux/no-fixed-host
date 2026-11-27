import './stories.css';

const decisions = [
  ['vouch', 'Vouch for the account'],
  ['hold', 'Keep the lead private'],
  ['flag', 'Flag the account as altered'],
];

const conversations = [
  {
    title: 'The missing names', name: 'Inez Faro', role: 'Archive assistant',
    record: 'The east archive shut its public doors at 18:00. Its blue returns book was missing the following morning.',
    opening: 'I took the blue book out after closing. The names inside are still legible. I want the families to know it survived.',
    questions: [
      { ask: 'How did you get in after six?', answer: 'I never went back in. I was counting slips at closing, then left through the staff gate with the book.', follow: { ask: 'Can the gate place you there?', answer: 'Here is my exit stub. Staff gate, 18:17. My initials and the blue-book checkout are on the same carbon sheet.', grounded: true } },
      { ask: 'Can you show me a page?', answer: 'Take this rubbing. The torn seal matches the half still attached to the morning inventory. You can put the two halves together.', grounded: true },
      { ask: 'May I identify you as the source?', answer: 'Yes. Use my name if you can stand by the account. The people in the book deserve a chance to come forward.' },
    ],
    verdict: 'vouch',
    results: {
      vouch: 'Inez agrees to go on record. Families can ask the archive for their entries.',
      hold: 'Inez accepts your silence, but the families still have no public lead on the book.',
      flag: 'The archive discredits its own assistant. Inez withdraws her offer to share the pages.',
    },
    reason: 'A staff exit after closing explains the time, and the matching seal independently identifies the book.',
  },
  {
    title: 'A voice from the gallery', name: 'Mara Sen', role: 'Museum night attendant',
    record: 'The north and south galleries share a wall. Their clocks run two minutes apart. Both galleries host a relay cabinet.',
    opening: 'I heard a cabinet warning through the wall. Everyone is blaming the north gallery. Should I put that in writing?',
    questions: [
      { ask: 'Which side of the wall were you on?', answer: 'The loading bay, between the two doors. A speaking tube carries sound from both cabinets into that room.', grounded: true },
      { ask: 'What time did it happen?', answer: 'Just before eleven, by the clock above my stool. They moved it down from one of the galleries.', follow: { ask: 'Did anyone mark which clock it was?', answer: 'I turn the clock around. Both gallery labels are on the back. We cannot place its time against either cabinet log.', grounded: true } },
      { ask: 'Why did you first suspect the north?', answer: 'Someone had chalked NORTH on the wall after my shift. I thought it meant another attendant had seen something.' },
    ],
    verdict: 'hold',
    results: {
      vouch: 'A complaint names the north gallery. Mara cannot substantiate the location she was quoted on.',
      hold: 'Mara agrees to stay in touch. The warning is logged privately while both galleries can still be checked.',
      flag: 'Mara closes the line. Her honest uncertainty has been filed as fabrication.',
    },
    reason: 'The warning is credible, but neither the shared signal nor the clock identifies a gallery.',
  },
  {
    title: 'The borrowed forecast', name: 'Pell', role: 'Weather cooperative relay',
    record: 'The orchard camera was fitted this spring. Its slate has a clipped corner. Last winter’s plate had four square corners.',
    opening: 'Frost is on the orchard glass right now. My packet includes a fresh plate. Please sign it before the morning bulletin goes out.',
    questions: [
      { ask: 'Let me look at the full plate.', answer: 'The crop pulls back. All four corners of the slate are square. A line of winter tally marks still hangs below it.', grounded: true },
      { ask: 'Who assembled the packet?', answer: '“The day editor,” says Pell, although the desk has been vacant since dusk.', follow: { ask: 'Show me the editor’s note.', answer: 'The note reads “Use last winter’s plate until a new one arrives.” Pell has pasted today’s date over the caption.', grounded: true } },
      { ask: 'Why does the bulletin need my signature?', answer: 'A second name makes it travel faster. Pell repeats the request without describing anything outside the glass.' },
    ],
    verdict: 'flag',
    results: {
      vouch: 'The bulletin runs an old winter photograph as today’s observation. Your signature travels with it.',
      hold: 'You keep your signature off the packet. Other desks have yet to hear why the plate is suspect.',
      flag: 'The cooperative withdraws the falsely dated plate and sends someone to check the orchard.',
    },
    reason: 'The old square-cornered plate contradicts its new caption, regardless of the weather outside.',
  },
];

// The interview terminal receives small, indexed-color portraits with each transmission.
const portraits = {
  'Inez Faro': {
    colors: { h: '#382d39', H: '#6d4c52', f: '#e4af83', s: '#bb8067', l: '#ffcf9e', e: '#342c36', g: '#99d5cc', j: '#396866', J: '#6ba89b', t: '#f3d2a0' },
    rows: [
      '........hhhhhhh.........',
      '......hhHHHHHHhhh.......',
      '.....hHHHHHhhHHHHh......',
      '....hHHhHHHHHHHhhHh.....',
      '....hHhhHHHHHHHHhhH.....',
      '....hHHhhhffffhhhhH.....',
      '....hhhhffflllfffsH.....',
      '....hhfeeeeeeeeeeef.....',
      '....hfsgegggeeggges.....',
      '.....ffeggegeegeges.....',
      '.....ssfeeeeffeeees.....',
      '......sffffllffffs......',
      '.......sfffssfffs.......',
      '........sfffeeffs.......',
      '.........sfffffs........',
      '.........ssffss.........',
      '.......jjjssffjj........',
      '.....jjJJjffffjJjj......',
      '...jjJJJJJjssjJJJjjj....',
      '..jJJjjJJJJttJJJJjjJj...',
      '.jJJJjjJJJtJJtJJJjjJJj..',
      '.jjjjjjJJJtJJtJJJjjJJj..',
    ],
  },
  'Mara Sen': {
    colors: { h: '#252735', H: '#54516a', f: '#b97b58', s: '#85543f', l: '#daa078', e: '#332b32', t: '#eab469', j: '#3d5373', J: '#8096b1', a: '#96605a' },
    rows: [
      '........hhhhhhh.........',
      '......hhhHHHHHHhh.......',
      '....hhhHHHHHHHHHHh......',
      '...hHHHHHhhhhHHHHHh.....',
      '...hHHhhfffffhHHHhh.....',
      '..hHHhhffllfffhHHHhh....',
      '..hHhhffllfffffhHHHH....',
      '..hHhsfeefffeeffhHHh....',
      '..hhhsffefffefffsHHh....',
      '...HhsfflffflfffsHHh....',
      '...hhsffffssfsssshHh....',
      '....hhffsfflffffhhHh....',
      '....hhhsfffeeefshHh.....',
      '.....HHhsfffffshHHh.....',
      '......hhhssssshhhH......',
      '.......aatsffsta........',
      '.....aattattttaaa.......',
      '....jtattaaaaatjjj......',
      '..jjjjjaattaaajJJJjj....',
      '.jJJjjjjjtaajJJJtJJJj...',
      '.jJjjjjjjjtaJJJjtjJJj...',
      'jjJjjjjjjjjtJJJJJJJjjj..',
    ],
  },
  Pell: {
    colors: { h: '#3f4856', H: '#71899a', e: '#28343e', m: '#a4bdbe', f: '#d0e1d9', s: '#89a4a9', g: '#82d1d4', l: '#c7f3e2', t: '#efa772', j: '#405462', J: '#758d96' },
    rows: [
      '...............t........',
      '..............tt........',
      '..............h.........',
      '.......mmmmm.hh.........',
      '.....mmfffffmm..........',
      '....mfffffffssmm........',
      '...mffffffmmssssh.......',
      '...mfmmeeeeeemmsh.......',
      '..HmseegggggggeeshH.....',
      '..HseeegllgggleeshH.....',
      '..HseeeeggggggeeshH.....',
      '..HmseeeeeeeeeesshH.....',
      '...mffmsssssssmssh......',
      '....mfmmmmmmmmssh.......',
      '....mmffffttfssh........',
      '......mmsssssmm.........',
      '........hHHhh...........',
      '......jjHhhHHjj.........',
      '....jJjjJJJJJjjJj.......',
      '..jjJJJjJJJJjJJJJjj.....',
      '.jJJJjJJjJJjJJttJJJj....',
      '.jJJjjJJJjjJJJtJJJJj....',
    ],
  },
};

function portrait(name) {
  const picture = document.createElement('canvas');
  picture.className = 'wi-portrait';
  picture.width = 28;
  picture.height = 26;
  picture.setAttribute('aria-hidden', 'true');
  const ctx = picture.getContext('2d');
  const { colors, rows } = portraits[name];
  for (const [y, row] of rows.entries()) {
    for (const [x, pixel] of [...row].entries()) {
      if (!colors[pixel]) continue;
      ctx.fillStyle = colors[pixel];
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
  }
  return picture;
}

let nextConversation = Math.floor(Math.random() * conversations.length);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export default function mount(api) {
  const file = conversations[nextConversation];
  nextConversation = (nextConversation + 1) % conversations.length;
  const heard = [];
  let finished = false;

  const interview = element('article', '', 'wi-interview');
  const header = element('header', '', 'wi-header');
  const identity = element('div');
  identity.append(element('span', file.role, 'wi-role'), element('h3', file.title));
  header.append(portrait(file.name), identity);
  const record = element('div', '', 'wi-record');
  record.append(element('strong', 'On record'), element('span', file.record));
  const transcript = element('div', '', 'wi-transcript');
  function reply(text) {
    const line = element('div', '', 'wi-answer');
    line.append(element('strong', file.name), element('span', text));
    line.tabIndex = -1;
    transcript.append(line);
    return line;
  }
  reply(file.opening);
  interview.append(header, record, transcript);
  api.stage.append(interview);

  function renderChoices() {
    api.controls.replaceChildren();
    const remaining = 2 - heard.length;
    api.setHud(file.name + ' · ' + (remaining ? remaining + (remaining === 1 ? ' question left' : ' questions left') : 'Decision due'));
    if (remaining) {
      api.setStatus(remaining === 2 ? 'Choose two questions before deciding how to use the account.' : 'Read the reply and choose your last question.');
      const choices = file.questions.filter(question => !heard.includes(question));
      if (heard[0]?.follow) choices.unshift(heard[0].follow);
      for (const question of choices) {
        api.action(question.ask, () => {
          if (heard.length >= 2 || heard.includes(question)) return;
          api.sfx?.(question === heard[0]?.follow ? 'followup' : 'question');
          heard.push(question);
          transcript.append(element('p', question.ask, 'wi-question'));
          const answer = reply(question.answer);
          renderChoices();
          // Read the new testimony before tabbing on to questions or a verdict.
          answer.focus();
        });
      }
    } else {
      api.setStatus('Two answers are on record. Decide what you are prepared to stand behind.');
      for (const [decision, label] of decisions) {
        api.action(label, () => {
          if (finished) return;
          finished = true;
          const correct = decision === file.verdict;
          const hasEvidence = heard.some(answer => answer.grounded);
          const outcome = correct && hasEvidence ? 'complete' : correct || decision === 'hold' ? 'partial' : 'failed';
          const detail = correct && !hasEvidence ? 'Your judgment held, but your questions left the evidence untested. ' : '';
          api.finish(outcome, file.results[decision] + ' ' + detail + file.reason);
        });
      }
    }
  }
  renderChoices();
}
