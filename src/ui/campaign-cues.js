// Simultaneous discoveries and project completions share one announcement.
// A new danger may interrupt a recent research chime even in fast-forward.
const priority = { research: 1, discovery: 2, victory: 3, defeat: 3 };
const quietPeriodMs = 6000;

export function createCampaignCues(play, now = () => performance.now()) {
  let lastTime = -Infinity;
  let lastPriority = 0;

  return function announce({ status, discovered, researched }) {
    let cue;
    if (status === 'won') cue = 'victory';
    else if (status === 'lost') cue = 'defeat';
    else if (discovered) cue = 'discovery';
    else if (researched) cue = 'research';
    else return;

    const time = now();
    if (time - lastTime < quietPeriodMs && priority[cue] <= lastPriority) return;
    lastTime = time;
    lastPriority = priority[cue];
    play(cue);
  };
}
