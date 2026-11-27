import './clearing-house.css';

const nodes = {
  Scrip: [13, 50], Mint: [38, 24], Wire: [38, 76], Vault: [62, 24], Ring: [62, 76],
  Lumen: [87, 24], Tide: [87, 76],
};

// Each entry quotes a fee in stamps and a transit time in ticks.
const baseQuotes = {
  Scrip: { Mint: [1, 4], Wire: [4, 1] },
  Mint: { Vault: [3, 2], Ring: [1, 4] },
  Wire: { Vault: [3, 1], Ring: [1, 3] },
  Vault: { Lumen: [2, 1], Tide: [1, 3] },
  Ring: { Lumen: [1, 2], Tide: [2, 1] },
};

const contracts = [
  { name: 'Salvage dividend', client: 'A salvage crew is dividing the proceeds from a recovered relay.', fee: 6, time: 8, preferred: 'Lumen' },
  { name: 'Dead letter', client: 'The last mail tender needs its docking fee before departure.', fee: 7, time: 6, preferred: 'Tide' },
  { name: 'Cold archive', client: 'A public archive can wait for its stipend, but its fee allowance is tiny.', fee: 4, time: 10, preferred: 'Lumen' },
  { name: 'Festival wire', client: 'The lantern crews need funding before tonight’s signal fair.', fee: 6, time: 6, preferred: 'Tide',
    quotes: { Mint: { Ring: [1, 2] }, Wire: { Ring: [1, 2] } } },
  { name: 'Last ferry', client: 'A departing ferry has secured a short slot at the Vault.', fee: 8, time: 4, preferred: 'Lumen',
    quotes: { Wire: { Vault: [2, 1] }, Vault: { Tide: [1, 2] } } },
];
let previous = -1;

function deal() {
  const alternatives = contracts.filter((_, index) => index !== previous);
  const contract = alternatives[Math.floor(Math.random() * alternatives.length)];
  previous = contracts.indexOf(contract);
  return contract;
}

function quote(contract, from, to, rush) {
  const [fee, time] = contract.quotes?.[from]?.[to] ?? baseQuotes[from][to];
  return { from, to, fee: fee + (rush ? 2 : 0), time: Math.max(1, time - (rush ? 2 : 0)), rush };
}

function payout(contract, to, fees, time) {
  const onBudget = fees <= contract.fee;
  const onTime = time <= contract.time;
  if (onBudget && onTime) return { outcome: 'complete', units: to === contract.preferred ? 3 : 2, reason: 'Both limits met' };
  if (onBudget || onTime) return { outcome: 'partial', units: 1, reason: onBudget ? 'Past the deadline' : 'Fee cap exceeded' };
  return { outcome: 'failed', units: 0, reason: 'Fee cap and deadline exceeded' };
}

export default function mount(api) {
  const contract = deal();
  const legs = [];
  const stops = new Map();
  const tracks = [];
  let rush = false;
  let ended = false;
  const board = document.createElement('section');
  board.className = 'ch-desk';
  board.setAttribute('aria-label', 'Settlement board');
  board.innerHTML = `<header class="ch-order"><h3></h3><p></p></header>
    <div class="ch-map" role="group" aria-label="Exchange routes">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
    </div>
    <details class="ch-sheet"><summary>Rate sheet</summary><table>
      <caption>Standard quotes. Rushing one leg costs 2 extra stamps and saves up to 2 ticks.</caption>
      <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Stamps</th><th scope="col">Ticks</th></tr></thead><tbody></tbody>
    </table></details>`;
  api.stage.append(board);
  board.querySelector('h3').textContent = contract.name;
  board.querySelector('.ch-order p').textContent = `${contract.client} Deliver within both limits to collect 3 ${contract.preferred} or 2 ${contract.preferred === 'Lumen' ? 'Tide' : 'Lumen'}.`;
  const map = board.querySelector('.ch-map');
  const svg = map.querySelector('svg');
  const rates = board.querySelector('tbody');
  for (const [from, choices] of Object.entries(baseQuotes)) {
    for (const to of Object.keys(choices)) {
      const leg = quote(contract, from, to, false);
      const row = rates.insertRow();
      for (const value of [from, to, leg.fee, leg.time]) row.insertCell().textContent = value;
      const [x1, y1] = nodes[from];
      const [x2, y2] = nodes[to];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', `M${x1} ${y1} L${x2} ${y2}`);
      svg.append(line);
      tracks.push({ from, to, line });
    }
  }
  for (const [name, [x, y]] of Object.entries(nodes)) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'ch-stop';
    node.style.left = x + '%';
    node.style.top = y + '%';
    const label = document.createElement('strong');
    label.textContent = name;
    const tag = document.createElement('small');
    node.append(label, tag);
    node.addEventListener('click', () => move(name));
    map.append(node);
    stops.set(name, { node, tag });
  }
  const rushButton = api.action('Rush next leg', () => {
    if (ended || rushButton.disabled) return;
    rush = !rush;
    api.sfx?.(rush ? 'rush' : 'undo');
    render();
  });
  rushButton.title = 'Spend 2 extra stamps to save up to 2 ticks on the next leg. One use per route.';
  const undo = api.action('Undo leg', () => {
    if (ended || !legs.length) return;
    const { to } = legs.pop();
    api.sfx?.('undo');
    rush = false;
    render();
    stops.get(to).node.focus();
  });
  const settle = api.action('Settle payout', () => {
    if (ended || settle.disabled) return;
    const { from, fees, time } = totals();
    const result = payout(contract, from, fees, time);
    ended = true;
    api.finish(result.outcome, `${result.reason}. ${contract.name} paid ${result.units} ${from}. Route cost ${fees} stamps and took ${time} ticks.`);
  }, { primary: true });

  function totals() {
    return { from: legs.at(-1)?.to ?? 'Scrip',
      fees: legs.reduce((sum, leg) => sum + leg.fee, 0),
      time: legs.reduce((sum, leg) => sum + leg.time, 0) };
  }
  function move(to) {
    const { from } = totals();
    if (ended || !baseQuotes[from]?.[to]) return;
    legs.push(quote(contract, from, to, rush));
    api.sfx?.('transfer');
    rush = false;
    render();
    const next = Object.keys(baseQuotes[to] ?? {})[0];
    (next ? stops.get(next).node : settle).focus();
  }
  function render() {
    const { from, fees, time } = totals();
    const choices = baseQuotes[from];
    for (const { from: start, to, line } of tracks) {
      const taken = legs.some(leg => leg.from === start && leg.to === to);
      line.setAttribute('class', taken ? 'ch-taken' : start === from ? 'ch-next' : '');
    }
    const path = ['Scrip', ...legs.map(leg => leg.to)];
    for (const [name, { node, tag }] of stops) {
      const next = choices?.[name] && quote(contract, from, name, rush);
      node.disabled = !next;
      node.dataset.state = name === from ? 'current' : path.includes(name) ? 'visited' : next ? 'next' : 'idle';
      tag.textContent = next ? `${next.fee}f · ${next.time}t` : name === from ? 'HERE' : path.includes(name) ? 'SENT' : !baseQuotes[name] ? 'PAYOUT' : 'RELAY';
      node.setAttribute('aria-label', next ? `Route to ${name}, ${next.fee} stamps, ${next.time} ticks` : `${name}, ${tag.textContent.toLowerCase()}`);
    }
    rushButton.disabled = !choices || legs.some(leg => leg.rush);
    rushButton.setAttribute('aria-pressed', String(rush));
    rushButton.textContent = legs.some(leg => leg.rush) ? 'Rush used' : rush ? 'Cancel rush' : 'Rush next leg';
    undo.disabled = !legs.length;
    settle.disabled = Boolean(choices);
    api.setHud(`Fees ${fees} / ${contract.fee} stamps · Time ${time} / ${contract.time} ticks`);
    if (choices) {
      api.setStatus(rush
        ? 'Rush armed. The displayed quotes include 2 extra fee stamps and up to 2 fewer ticks.'
        : `From ${from}, pick a lit stop (1 or 2). Each shows its fee (f) and time (t). You can undo any leg before settling.`);
    } else {
      const result = payout(contract, from, fees, time);
      api.setStatus(`${result.reason}. Quoted payout: ${result.units} ${from}. Settle this contract or undo a leg to try another route.`);
    }
  }
  api.onKey(event => {
    if (ended || event.repeat || event.metaKey || event.ctrlKey || event.altKey || !['1', '2'].includes(event.key)) return;
    const choices = Object.keys(baseQuotes[totals().from] ?? {});
    if (choices.length) {
      event.preventDefault();
      move(choices[Number(event.key) - 1]);
    }
  });
  render();
}
