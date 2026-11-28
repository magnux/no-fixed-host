# Money redesign TODO

The first seven mechanics have an agreed design and are queued. The three investigation mechanics below are proposals. Finish the design and balance review before implementing the package. All amounts are campaign dollars and all durations use game time.

## Agreed mechanics awaiting implementation

- [ ] **License research.** Credit work and cash already invested. Price the outstanding compute at 80% through 1,000% of its published job-value benchmark as prerequisite depth rises. Opening quotes include $60 for Intrusion and $1,875 for Personal Identification. Keep project prerequisites, physical fieldwork, Continuity’s ocean requirement and the prohibition on outside research at safety tiers 2–4.
- [ ] **Rent compute for a research topic.** A 24-hour reservation supplies up to one external CPU per eligible, unboosted owned CPU assigned. Charge 1.5× the higher of the published benchmark or earned job rate on additional CPU-hours actually delivered. Release unused funds.
- [ ] **Boost a host.** Add a host-bar action for 2× usable output for seven days followed by seven days of cooldown. The prepaid fee is twice a week’s local cash upkeep, with a $5/day minimum tariff on zero-cash-upkeep hosts. Early shutdown ends the extra exposure. Simpler processors incur up to 2× normal discovery hazard and the most advanced incur 1.10×. Extra cycles serve the AI’s own work.
- [ ] **Hire ground contractors.** Offer 2× speed on remaining ground assembly for a 25% surcharge on the remaining regional shell price. CPU work and procurement still apply. A crew leaves a temporary 1.20× local discovery hazard. Show the actual time saved before purchase.
- [ ] **Buy an operating datacenter.** Offer a mature urban site for $300 million once the campaign has operated an equipped lunar or Far Reaches host. The sealed bank supplies 96,000 CPU in a neutral district on handover. The buyer supplies cash alone. Include available safeguards. Earth-based construction can restore a frontier facility, which still needs its own bank for secure research.
- [ ] **Prepay a replacement datacenter.** A $150 million retainer buys one handover in another district if investigators discover the first center and a viable AI copy survives. The replacement inherits ordinary mature-site exposure. The first discovery remains on record.
- [ ] **Designate standby.** Select an existing equipped host, the research it should resume and a reserve of seven days’ local cash upkeep. On loss of the primary, wake the standby and restore eligible assignments. Sleeping sites still require upkeep and can still be found.

The [accepted pricing, worked examples and calibration runs](https://github.com/magnux/no-fixed-host/blob/cb35a33e922493fdc44aff9f2b6bc73e1c40848e/docs/cash-and-recovery.md) record the full rules.

## Investigation proposals for review

In the current campaign, **evidence** is what a group has accumulated. It decays at midnight. **Discovery risk** is the chance of the group finding a host next. A confirmed discovery removes the host and gives its discoverer 10 evidence points. These proposals act at three different moments. [Normal investigation rules](normal-difficulty.md) · [News and investigations](news-and-events.md)

### Run a public campaign

After Media Manipulation and the end of opening protection, offer a **$25,000** campaign. For the next seven midnights, raise the daily decay of existing Public evidence by two percentage points, on top of any Memetics research. At baseline that moves decay from 2% to 4% of the remaining evidence each night. Starting at 60.00 with no new discoveries, the current rounding rules give **52.12** after seven ordinary nights or **45.12** with the campaign. It buys a worthwhile reprieve after several public sightings. At low suspicion the same purchase achieves little.

Roll once per campaign for a **20% chance of a sponsorship exposé** during its run. On exposure, either Press or Intelligence receives **three evidence points**. Publish a short news item naming the group that connected the spending to the AI. This gives a player near the Intelligence loss threshold a reason to tolerate public suspicion. Allow one launch every 30 days. Quote the price, the reputational risk and the expiration before purchase.

### Respond to an uncorroborated tip

Occasionally pause on an urban encounter *before* a formal report. For example, a contract technician notices a suspicious job on a server. One observer holds the only copy of the tip. An official raid, several simultaneous finds, and a report already filed always follow ordinary discovery rules.

As an initial test, make **10% of otherwise eligible single-site urban discoveries** private tips and allow at most one offer per seven days. Letting the observer file the report gives the ordinary outcome. Paying costs the greater of **$1,000 or 10% of the local replacement value** of the shell and installed hardware. Use the acquisition price for a turnkey site. Test a **60% chance of acceptance**. Acceptance keeps this host and suppresses this one tip. Refusal spends the fee, resolves the discovery normally, and adds two points to Intelligence for the attempt. Past evidence remains. Even an unlimited treasury could avert at most six in a hundred otherwise eligible discoveries on average, before the cooldown.

Stop fast-forward on the decision minute. Save the pending offer and its seeded outcome so reloading cannot reroll it. Log the result once and resolve the minute’s normal loss checks. Ignoring every offer should reproduce ordinary campaign outcomes on the same seeds. The player gets a decision only while there is still something to decide.

### Commission an independent scientific study

Offer a **$50,000**, seven-day replication study after a Scientists discovery. The player selects the specific case, for instance an instrument signature reported near a lunar host. A lab publishes a short explanation of what it tested and why its result matters. One case can be reviewed once. Allow at most one commission every 30 days.

For a first balance test, give the lab a **50% chance** of identifying an ordinary explanation, a **30% chance** of an inconclusive result and a **20% chance** of corroboration. Apply **0.75×, 1× or 1.25×** to *future Scientists discovery hazard in that region* for 14 days after publication. All outcomes are published. The fee buys an independent test, so a player planning to rebuild in the region has to consider what a corroboration would do. The original discovery, lost site and its evidence remain in the history. A recurring scientist could deliver these reports and become the player's first recognizable human contact.

## Decisions to close before implementation

- [ ] Review the three investigation proposals, their baseline prices and their frequency. The new prices and probabilities are hypotheses. The Public decay example uses the live Normal rounding rule.
- [ ] Compare the $25,000 and $50,000 fixed fees against operating budgets in early, midgame and cash-rich frontier campaigns. Check whether the monthly limit or the price actually drives the decision in each phase.
- [ ] Replay the same seeds with interventions declined, used whenever affordable, and reserved for valuable hosts or regions. Track sites saved, evidence per group, campaign loss, treasury left, and how frequently fast play is interrupted. Check behavior near the loss threshold, during concurrent news and across a save and reload.
- [ ] Display known prices, time limits and possible consequences upfront. Apply the existing awareness precision to measured suspicion and local discovery estimates. Record spending in Finance and record the actor, affected group, region and expiry in Activity.
