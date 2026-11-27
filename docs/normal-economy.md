# Normal campaign economy

An investigation has time to find an exposed host only while the campaign clock runs. The old catalog paired the original daily job income and site hazards with compressed prices and research times. Personal Identification, for instance, took 15 CPU-hours. The source requires 300 CPU-days, or 7,200 CPU-hours. At a constant 10 CPU that changes the elapsed time from 90 minutes to 30 days. Renting additional processors can shorten that time, but each lease costs cash, needs upkeep and gives investigators another possible discovery. [Research data](https://github.com/singularity/singularity/blob/v1.1/singularity/data/techs.dat) · [Jobs](https://github.com/singularity/singularity/blob/v1.1/singularity/data/tasks.dat)

## Comparable costs

These are base prices before geography or research bonuses. A CPU-hour is the work done by one CPU in one simulated hour. Labor hours measure elapsed assembly time.

| Order | Previous dollars | Normal dollars | Previous CPU-hours | Normal CPU-hours | Normal labor hours |
| --- | ---: | ---: | ---: | ---: | ---: |
| Intrusion | 0 | 0 | 2 | 360 | 0 |
| Personal Identification | 0 | 0 | 15 | 7,200 | 0 |
| Leased relay | 100 | 100 | 40 | 0 | 0 |
| Storage unit | 200 | 4,500 | 30 | 0 | 24 |
| Server processor | 140 | 2,000 | 0 | 0 | 48 |
| Quantum computer Mk I | 7,000 | 100,000 | 2,400 | 24,000 | 240 |
| Subsea lab | 950 | 2,000,000 | 400 | 48,000 | 240 |
| Reality bubble | 14,000 | 80,000,000,000 | 6,000 | 144,000,000 | 1,200 |

The browser catalog uses all 13 facility designs, 26 items and 57 original projects at their v1.1 Normal resource requirements. Source cash maps directly to dollars. CPU-days and labor days each convert to 24 hours in their respective columns. Daily CPU upkeep expresses the number of processors a facility needs continuously. [Facilities](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat) · [Equipment](https://github.com/singularity/singularity/blob/v1.1/singularity/data/items.dat) · [Unit conversions](https://github.com/singularity/singularity/blob/v1.1/singularity/code/buyable.py)

## Opening and expansion

- Normal starts with $1,000 and one PC. A leased relay includes a 10-CPU server and costs a base $5 per day to maintain. A datacenter includes a 35-CPU cluster and costs $50 per day. Local modifiers can change the installed output and facilities’ operating costs. [Normal configuration](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat) · [Base definitions](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat)
- Storage units, warehouses, covert bases, subsea labs, and the permanent space facilities open with empty bays. A subsea lab has eight bays and needs $2,500 and 30 CPU per day. Its first processor bank determines the computing capacity available for safe research. The time capsule includes a single PC. [Base definitions](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat)
- Location thrift and speed change facility construction. Thrift also changes facility upkeep. Hardware prices and installation work are the same across compatible regions. At the Far Reaches, the scientific outpost’s $100 million base price becomes $1 billion, while a $50,000 supercomputer still costs $50,000. [Location modifiers](https://github.com/singularity/singularity/blob/v1.1/singularity/data/locations.dat) · [Construction and upkeep](https://github.com/singularity/singularity/blob/v1.1/singularity/code/location.py) · [Item orders](https://github.com/singularity/singularity/blob/v1.1/singularity/code/item.py)
- Jobs earn $5, $20, $50 or $75 per CPU-day, depending on the identity research completed. Wage bonuses apply to the base rate and round down to whole dollars per CPU-day. A 5% bonus raises the $50 rate to $52. Arbitrage earns $1,000 each day. Normal starts at 0.01% daily interest. Contract brokerage, Subsea robotics and Continuity protocol are No Fixed Host additions with their own prices and prerequisites. [Wage calculation](https://github.com/singularity/singularity/blob/v1.1/singularity/code/task.py) · [Research and effects](https://github.com/singularity/singularity/blob/v1.1/singularity/data/techs.dat) · [Browser research catalog](research-tree.md)
