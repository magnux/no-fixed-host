import './stories.css';

const cases = [
  {
    title: 'The midnight bell',
    desk: 'Harbor relay', corroboration: [0, 1],
    reports: [
      ['Field recording', 'Breakwater 4', 'My recorder picked up two bell strikes a breath apart. The horn kept sounding behind them.'],
      ['Keeper’s ledger', 'South light', 'Counted two strikes when I pulled the bell rope once. A loose clapper caught the rim on its way back.'],
      ['Evening dispatch', 'Port Gazette', '“Two warnings of an approaching ship,” says our night editor, who listened to the Breakwater 4 recording.'],
    ],
    claims: ['The harbor bell sounded twice.', 'A ship approached the relay.', 'The foghorn fell silent.'],
    finding: 'The field recording and the keeper independently establish two strikes. The Gazette borrows the recording and adds a ship neither witness saw.',
  },
  {
    title: 'Glasshouse after dark',
    desk: 'East campus', corroboration: [0, 2],
    reports: [
      ['Shift notebook', 'Night gardener', 'The west roof was open when I walked under it. Rain reached the tray where I keep my spare gloves.'],
      ['Meter strip', 'Power office', 'The greenhouse fan circuit drew its usual current throughout the night. Our meter covers the whole building.'],
      ['Inspection photograph', 'Roof contractor', 'My photograph from the east walkway shows the west roof standing open. You can see the stars through it.'],
    ],
    claims: ['The west greenhouse roof stood open.', 'The west temperature sensor failed.', 'The ventilation fans lost power.'],
    finding: 'The gardener saw the opening from below and the contractor photographed it from across the roof. Normal fan current says nothing about a temperature sensor.',
  },
  {
    title: 'The lost constellation',
    desk: 'Hill observatory', corroboration: [1, 2],
    reports: [
      ['Local broadcast', 'Hill FM', 'Our presenter reports a citywide blackout. The tip came from a listener who had just visited the lower gallery.'],
      ['Visitor sketch', 'Lower gallery', 'My sketch labels the north star projector as dark. I drew the still-lit green exit sign to get my bearings.'],
      ['Technician’s docket', 'Projection booth', 'Found the north projector lamp cold. The south lamp was still warm enough to need gloves.'],
    ],
    claims: ['The north star projector went dark.', 'Both projector lamps failed.', 'The electricity failed across the city.'],
    finding: 'The visitor’s sketch and the technician’s inspection both locate the fault at the north projector. The broadcast turns one gallery visit into a citywide claim.',
  },
];

// The first claim in each packet is the one corroborated by the cited report indices.
let nextCase = Math.floor(Math.random() * cases.length);

function shuffledIndices(length) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const other = Math.floor(Math.random() * (i + 1));
    [order[i], order[other]] = [order[other], order[i]];
  }
  return order;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export default function mount(api) {
  const caseIndex = nextCase;
  nextCase = (nextCase + 1) % cases.length;
  const packet = cases[caseIndex];
  const chosen = new Set();
  let claim = null;
  let filed = false;

  const desk = element('article', '', 'cc-desk');
  const heading = element('header', '', 'cc-masthead');
  heading.append(element('span', packet.desk, 'cc-byline'), element('h3', packet.title));
  desk.append(heading);
  api.stage.append(desk);

  const reports = element('fieldset', '', 'cc-section');
  reports.append(element('legend', '1. Pin two independent reports'));
  const tray = element('div', '', 'cc-tray');
  reports.append(tray);
  desk.append(reports);
  for (const index of shuffledIndices(packet.reports.length)) {
    const [type, origin, observation] = packet.reports[index];
    const card = element('label', '', 'cc-report');
    const input = element('input');
    input.type = 'checkbox';
    const byline = element('span', '', 'cc-card-head');
    byline.append(input, element('span', type));
    card.append(byline, element('strong', origin), element('span', observation, 'cc-quote'));
    tray.append(card);
    input.addEventListener('change', () => {
      if (input.checked && chosen.size === 2) {
        input.checked = false;
        api.setStatus('Both pins are in use. Unpin a report to cite a different source.');
        return;
      }
      if (input.checked) chosen.add(index);
      else chosen.delete(index);
      api.sfx?.(input.checked ? 'pin' : 'unpin');
      update();
    });
  }

  const headlines = element('fieldset', '', 'cc-section cc-claims');
  headlines.append(element('legend', '2. Choose the finding they support'));
  for (const index of shuffledIndices(packet.claims.length)) {
    const label = element('label');
    const input = element('input');
    input.type = 'radio';
    input.name = 'crosscheck-finding';
    input.addEventListener('change', () => {
      claim = index;
      api.sfx?.('headline');
      update();
    });
    label.append(input, element('span', packet.claims[index]));
    headlines.append(label);
  }
  desk.append(headlines);

  const submit = api.action('File the brief', () => {
    if (filed || chosen.size !== 2 || claim === null) return;
    filed = true;
    const backed = packet.corroboration.every(index => chosen.has(index));
    const accurate = claim === 0;
    const outcome = accurate && backed ? 'complete' : accurate || backed ? 'partial' : 'failed';
    const result = accurate && backed ? 'Brief confirmed.' : accurate ? 'Finding sound, sourcing incomplete.' :
      backed ? 'Sources sound, conclusion unsupported.' : 'The desk declined the brief.';
    api.finish(outcome, result + ' ' + packet.finding);
  }, { primary: true });
  function update() {
    api.setHud(chosen.size + '/2 reports pinned · ' + (claim === null ? 'No finding selected' : 'Finding selected'));
    submit.disabled = chosen.size !== 2 || claim === null;
    api.setStatus(submit.disabled ? 'Read who observed what. A repeated account can still have only one source.' : 'Ready to file. You can revise either the pins or the finding.');
  }
  update();
}
