# Normal difficulty and discovery

No Fixed Host uses one campaign baseline, Endgame: Singularity **v1.1 Normal**. A discovery adds 10 percentage points of evidence to the group that found the site. The previous browser campaign already applied that amount. Its economic curve made it possible to buy computing power and finish projects after far fewer exposed days. A win through that campaign did not require surviving the same length of investigation. [Original presets](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat) · [Evidence calculation](https://github.com/singularity/singularity/blob/v1.1/singularity/code/group.py)

## How the original presets scale

The relay column gives the probability of at least one discovery during one full exposed day for an active Server Access facility in a neutral region, with zero prior suspicion, research or news modifiers. Integer rounding happens separately for each investigator. These six rows document the reference. The browser uses the Normal row.

| Reference preset | Starting cash | Daily interest | Labor multiplier | Detection multiplier | Evidence per discovery | Site protection × quoted labor | Opening CPU-day limit | Relay risk/day |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Very easy | $5,000 | 0.05% | 0.25× | 0.875× | +8 points | 4× | Unlimited | 2.36% |
| Easy | $1,600 | 0.03% | 0.50× | 0.95× | +9.5 points | 3× | 10,000 | 2.57% |
| **Normal** | **$1,000** | **0.01%** | **1×** | **1×** | **+10 points** | **2×** | **5,000** | **2.71%** |
| Hard | $700 | 0.01% | 1.10× | 1.05× | +10.5 points | 1.8× | 2,500 | 2.84% |
| Ultra-hard | $500 | 0.01% | 1.50× | 1.125× | +11.5 points | 1.2× | 1,000 | 3.03% |
| Impossible | $0 | 0.01% | 2× | 1.20× | +12.5 points | 1× | 100 | 3.25% |

All six have a calendar deadline of 23 elapsed days. Easy starts with Socioanalytics and Very Easy also starts with Advanced Socioanalytics. Normal starts with neither. The original draws a university computer in an available urban region. A fresh browser campaign likewise starts on one PC in one of the six inhabited regions, selected from the campaign seed. [Difficulty data](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat) · [Starting host](https://github.com/singularity/singularity/blob/v1.1/singularity/code/g.py#L275-L290) · [Calendar and CPU limits](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py#L527-L563)

## What investigators do

1. Opening protection ends at 23 elapsed days or immediately after active compute exceeds 5,000 CPU-days. Idle cycles on an awake processor count. Sleeping processors do not. An advanced network can end protection early even while the player reserves all its CPU for jobs.
2. Each facility has its own protection through twice the labor time quoted when the order was placed. An unfinished facility may outlive that protection if it lacks cash or compute. A site with zero quoted labor becomes eligible on the next simulation minute after its order. The browser compares whole minutes to preserve the final protected minute when a purchase occurred partway through an hour.
3. Each group starts with the facility-specific discovery rate. It multiplies it first by one plus its own suspicion, then by its discovery multiplier adjusted for research and active news. Completed power and security items reduce the remaining exposure multiplicatively. The region of the last discovery receives a 1.2× multiplier, the previous one a 1.1× multiplier, and both can apply to the same region. Regional stealth divides the result. A sleeping, unequipped or unfinished host gets a final fourfold reduction. The simulation floors intermediate rates in basis points. A 30% concealment item applied to a rate of 90 basis points leaves exactly 63.
4. Each eligible investigator rolls once per host per simulation minute, stopping at the first success for that host. While rates are constant, the chance of surviving without a discovery for `d` days is `exp(-d × sum_of_daily_rates)`. The rates for a mature, neutral relay are 0.005 for Press, zero for Scientists, 0.010 for Intelligence and 0.0125 for Public. This gives **2.71%** risk in one exposed day and **17.51%** over an exposed week. Ten such relays face **24.04%** risk of at least one discovery in one day.
5. A success removes the host and construction on it. Only the discovering group gets the ten points. At midnight each group loses a percentage of its own evidence, floored to whole basis points with a minimum decrease of 0.01 points, stopping at zero. If a discovery occurs at midnight, the overnight decay applies before checking the loss threshold. The campaign ends if any one group **exceeds** 100%, or if there are no powered processors and no usable sleeping backup.

The browser shows Poisson probabilities in its numerical forecasts. The desktop map instead combines its individual displayed rates using `1 − product(1 − rate)`. The actual detection roll in both games uses the exponential calculation above. Graphics, game speed and research that reveals better estimates do not change those rolls. [Base rates and installed equipment](https://github.com/singularity/singularity/blob/v1.1/singularity/code/base.py) · [Region history](https://github.com/singularity/singularity/blob/v1.1/singularity/code/location.py#L158-L166) · [Interval probability](https://github.com/singularity/singularity/blob/v1.1/singularity/code/chance.py#L28-L44) · [Rolls and ordering](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py) · [Map estimates](https://github.com/singularity/singularity/blob/v1.1/singularity/code/screens/map.py#L841-L912)

| Group | Daily decay on current evidence | Evidence after a 10-point discovery followed by one midnight |
| --- | ---: | ---: |
| Press | 1.5% | 9.85% |
| Scientists | 0.5% | 9.95% |
| Intelligence | 1% | 9.90% |
| Public | 2% | 9.80% |

Advanced Intrusion improves Intelligence decay by 0.5 percentage points of accumulated evidence per day. Memetics and Advanced Memetics each add 0.5 points to the Public decay rate. Project: Impossibility Theorem removes 50 percentage points from every group's accumulated suspicion once. News changes detection multipliers, which affect how often groups earn evidence. [Group data](https://github.com/singularity/singularity/blob/v1.1/singularity/data/groups.dat) · [Technology](https://github.com/singularity/singularity/blob/v1.1/singularity/data/techs.dat) · [Effects](https://github.com/singularity/singularity/blob/v1.1/singularity/code/effect.py)

## Why the previous campaign felt easier

| Neutral-location example | Previous browser balance | v1.1 Normal baseline now used |
| --- | ---: | ---: |
| Storage unit purchase and daily upkeep | $200 and $6 | $4,500 and $50 |
| Subsea lab purchase | $950 | $2,000,000 |
| Subsea lab CPU construction work | 400 CPU-hours | 48,000 CPU-hours |
| Subsea lab minimum construction time | 3 days | 10 days |
| Subsea lab daily upkeep | $20 and 0.5 CPU | $2,500 and 30 CPU |
| Apotheosis research work | 150,000 CPU-hours | 72,000,000 CPU-hours |

A 100-CPU network could supply the previous lab's entire compute requirement in four hours. At the same allocation the Normal base requires 20 days, which gives investigators time to find operating hosts while it is being built. The player can change the outcome by expanding, improving a site's concealment, or concentrating research in a few safe facilities. A short or well-concealed campaign can still produce few incidents. [Facility catalog](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat) · [Research catalog](https://github.com/singularity/singularity/blob/v1.1/singularity/data/techs.dat)

## Checks

The automated regressions in [normal-difficulty.test.js](../test/normal-difficulty.test.js), [campaign.test.js](../test/campaign.test.js) and [normal-simulation.test.js](../test/normal-simulation.test.js) cover both protection boundaries, hazard composition, awake and sleeping hosts, investigator-specific decay, discoveries at midnight, the strict loss threshold and continuation on a sleeping backup.

A one-day experiment ran the minute simulation for 2,048 distinct starting RNG seeds on one neutral, mature, active relay with no net world-news modifier. It produced 45 discoveries, with 11 attributed to Press, 15 to Intelligence and 19 to Public. The analytical expectation is 55.55, with a standard deviation of 7.35. Scientists had zero exposure and found no relays. The experiment used seed `(i × 0x9e3779b1) modulo 2^32` for `i = 1…2048`, started at elapsed day 25 and ran each campaign until loss or 1,440 minutes. The probability tests use the analytical values so they stay deterministic across changes to random-number sequencing.
